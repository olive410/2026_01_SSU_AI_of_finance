/**
 * Reflection 서비스 — AI 투자 판단의 자기 반성 및 개선 피드백 루프
 *
 * 모드 1 (preliminary): KRX 검증 데이터 없을 때
 *   → 애널리스트 의견 vs AI 계산 의견 불일치 패턴 분석
 * 모드 2 (verified): KRX D+5 검증 데이터 충분할 때
 *   → 실제 수익률 기준 적중률 분석
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { pool } = require('../config/database');

function getClaudePath() {
  const candidates = [
    path.join(process.env.APPDATA || '', 'npm', 'node_modules', '@anthropic-ai', 'claude-code', 'bin', 'claude.exe'),
    path.join(process.env.APPDATA || '', 'npm', 'claude.cmd'),
    'claude',
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return 'claude';
}
const CLAUDE_BIN = getClaudePath();

// ---------- DB 조회 ----------

async function getVerifiedCount() {
  const r = await pool.query(
    "SELECT COUNT(*) FROM report_verifications WHERE d5_close IS NOT NULL"
  );
  return parseInt(r.rows[0].count, 10);
}

async function getVerifiedCases() {
  const r = await pool.query(`
    SELECT
      rp.stock_name, rp.stock_code, rp.report_date,
      rp.opinion_analyst, rp.opinion_computed, rp.score,
      rp.target_price_change,
      rv.return_pct, rv.hit,
      rv.d0_date, rv.d5_date
    FROM report_verifications rv
    JOIN reports rp ON rp.id = rv.report_id
    WHERE rv.d5_close IS NOT NULL
    ORDER BY rv.verified_at DESC
    LIMIT 50
  `);
  return r.rows;
}

async function getAllReportStats() {
  const r = await pool.query(`
    SELECT
      COUNT(*)                                                       AS total,
      COUNT(*) FILTER (WHERE opinion_analyst = 'Buy')               AS analyst_buy,
      COUNT(*) FILTER (WHERE opinion_analyst = 'Hold')              AS analyst_hold,
      COUNT(*) FILTER (WHERE opinion_analyst = 'Sell')              AS analyst_sell,
      COUNT(*) FILTER (WHERE opinion_computed = 'Buy')              AS ai_buy,
      COUNT(*) FILTER (WHERE opinion_computed = 'Hold')             AS ai_hold,
      COUNT(*) FILTER (WHERE opinion_computed = 'Sell')             AS ai_sell,
      COUNT(*) FILTER (WHERE opinion_analyst = opinion_computed)    AS match_count,
      COUNT(*) FILTER (WHERE target_price_change = 'up')            AS tp_up,
      COUNT(*) FILTER (WHERE target_price_change = 'flat')          AS tp_flat,
      COUNT(*) FILTER (WHERE target_price_change = 'down')          AS tp_down,
      AVG(score)                                                     AS avg_score,
      AVG(price_gap_pct)                                            AS avg_gap_pct
    FROM reports
    WHERE opinion_analyst IS NOT NULL
  `);
  return r.rows[0];
}

async function getMismatchSamples() {
  const r = await pool.query(`
    SELECT stock_name, opinion_analyst, opinion_computed, score,
           target_price_change, price_gap_pct, report_date, securities_firm
    FROM reports
    WHERE opinion_analyst IS NOT NULL
      AND opinion_computed IS NOT NULL
      AND opinion_analyst <> opinion_computed
    ORDER BY created_at DESC
    LIMIT 10
  `);
  return r.rows;
}

// ---------- AI 반성 호출 ----------

function callClaude(prompt) {
  return new Promise((resolve) => {
    const child = spawn(CLAUDE_BIN, ['-p', prompt], {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: CLAUDE_BIN.endsWith('.cmd'),
    });
    let stdout = '';
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      resolve(null);
    }, 90000);

    child.stdout.on('data', d => { stdout += d.toString(); });
    child.on('close', () => {
      clearTimeout(timer);
      const matches = stdout.match(/\{[\s\S]*?\}/g);
      if (!matches) return resolve(null);
      try { resolve(JSON.parse(matches[matches.length - 1])); }
      catch { resolve(null); }
    });
    child.on('error', () => { clearTimeout(timer); resolve(null); });
  });
}

// ---------- 예비 반성 (검증 데이터 없을 때) ----------

async function runPreliminaryReflection() {
  const stats = await getAllReportStats();
  const mismatches = await getMismatchSamples();

  const total = parseInt(stats.total, 10) || 0;
  const matchCount = parseInt(stats.match_count, 10) || 0;
  const matchRate = total > 0 ? Math.round((matchCount / total) * 1000) / 10 : null;

  const prompt = `당신은 AI 투자 판단 시스템의 자기 반성(Reflection) 에이전트입니다.
KRX 실제 수익률 검증 데이터가 아직 없으므로, 현재 수집된 분석 데이터를 기반으로 예비 반성을 수행합니다.

# 현재 분석 통계 (총 ${total}건)
- 애널리스트 의견: Buy ${stats.analyst_buy} / Hold ${stats.analyst_hold} / Sell ${stats.analyst_sell}
- AI 계산 의견:   Buy ${stats.ai_buy} / Hold ${stats.ai_hold} / Sell ${stats.ai_sell}
- 의견 일치율: ${matchRate}%
- 목표가 변화: 상향 ${stats.tp_up} / 유지 ${stats.tp_flat} / 하향 ${stats.tp_down}
- 평균 AI 점수: ${stats.avg_score ? Number(stats.avg_score).toFixed(2) : 'N/A'}
- 평균 괴리율: ${stats.avg_gap_pct ? Number(stats.avg_gap_pct).toFixed(1) + '%' : 'N/A'}

# 애널리스트-AI 의견 불일치 샘플 (최근 ${mismatches.length}건)
${JSON.stringify(mismatches, null, 2)}

# 작업
아래 JSON 형식으로 반성 내용을 반환하세요. 마크다운 래핑 금지.
{
  "reflection": "현재 AI 판단 모델의 패턴 분석 (2~3문장)",
  "bias_found": "발견된 체계적 편향 또는 null",
  "adjustment_suggestions": ["개선 제안 1", "개선 제안 2", "개선 제안 3"],
  "prompt_hint": "다음 리포트 분석 시 추가할 컨텍스트 힌트 (1~2문장)"
}`;

  const ai = await callClaude(prompt);

  return {
    mode: 'preliminary',
    sample_size: total,
    overall_hit_rate: null,
    buy_hit_rate: null,
    hold_hit_rate: null,
    sell_hit_rate: null,
    avg_return_pct: null,
    opinion_match_rate: matchRate,
    stats,
    mismatches,
    ...(ai || {
      reflection: 'AI 반성 분석을 완료할 수 없었습니다.',
      bias_found: null,
      adjustment_suggestions: [],
      prompt_hint: null,
    }),
  };
}

// ---------- 검증 반성 (KRX D+5 데이터 있을 때) ----------

async function runVerifiedReflection() {
  const cases = await getVerifiedCases();
  const stats = await getAllReportStats();

  const byOpinion = { Buy: [], Hold: [], Sell: [] };
  for (const c of cases) {
    const op = c.opinion_computed || c.opinion_analyst;
    if (byOpinion[op]) byOpinion[op].push(c);
  }

  function hitRate(arr) {
    if (!arr.length) return null;
    return Math.round((arr.filter(c => c.hit).length / arr.length) * 1000) / 10;
  }
  function avgReturn(arr) {
    const vals = arr.map(c => Number(c.return_pct)).filter(v => !isNaN(v));
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 100) / 100 : null;
  }

  const overallHit = hitRate(cases);
  const buyHit   = hitRate(byOpinion.Buy);
  const holdHit  = hitRate(byOpinion.Hold);
  const sellHit  = hitRate(byOpinion.Sell);
  const avgRet   = avgReturn(cases);

  const total = parseInt(stats.total, 10) || 0;
  const matchCount = parseInt(stats.match_count, 10) || 0;
  const matchRate = total > 0 ? Math.round((matchCount / total) * 1000) / 10 : null;

  const prompt = `당신은 AI 투자 판단 시스템의 자기 반성(Reflection) 에이전트입니다.
리포트 발행일 기준 D+5 거래일 종가 증감률을 활용해 AI 판단의 적중률을 분석하고 개선 방향을 제시하세요.

# 성과 통계 (KRX D+5 검증, ${cases.length}건)
- 전체 적중률: ${overallHit}%
- Buy 적중률: ${buyHit}% (${byOpinion.Buy.length}건)
- Hold 적중률: ${holdHit}% (${byOpinion.Hold.length}건)
- Sell 적중률: ${sellHit}% (${byOpinion.Sell.length}건)
- 평균 수익률: ${avgRet}%
- 애널리스트-AI 의견 일치율: ${matchRate}%

# 개별 케이스 (최근 20건)
${JSON.stringify(cases.slice(0, 20), null, 2)}

# 작업
아래 JSON 형식으로 반성 내용을 반환하세요. 마크다운 래핑 금지.
{
  "reflection": "성과 패턴 분석 (2~3문장, 적중률/수익률 수치 포함)",
  "bias_found": "발견된 체계적 편향 (예: Buy 과잉 판정, 특정 업종 과소평가) 또는 null",
  "adjustment_suggestions": ["개선 제안 1", "개선 제안 2", "개선 제안 3"],
  "prompt_hint": "다음 분석 프롬프트에 추가할 컨텍스트 힌트 (1~2문장)"
}`;

  const ai = await callClaude(prompt);

  return {
    mode: 'verified',
    sample_size: cases.length,
    overall_hit_rate: overallHit,
    buy_hit_rate: buyHit,
    hold_hit_rate: holdHit,
    sell_hit_rate: sellHit,
    avg_return_pct: avgRet,
    opinion_match_rate: matchRate,
    ...(ai || {
      reflection: 'AI 반성 분석을 완료할 수 없었습니다.',
      bias_found: null,
      adjustment_suggestions: [],
      prompt_hint: null,
    }),
  };
}

// ---------- 반성 저장 ----------

async function saveReflection(result) {
  await pool.query(
    `INSERT INTO reflection_logs
       (mode, sample_size, overall_hit_rate, buy_hit_rate, hold_hit_rate, sell_hit_rate,
        avg_return_pct, opinion_match_rate, reflection, bias_found, adjustment_suggestions, prompt_hint)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [
      result.mode, result.sample_size,
      result.overall_hit_rate, result.buy_hit_rate, result.hold_hit_rate, result.sell_hit_rate,
      result.avg_return_pct, result.opinion_match_rate,
      result.reflection, result.bias_found,
      JSON.stringify(result.adjustment_suggestions || []),
      result.prompt_hint,
    ]
  );
}

async function getLatestReflections(limit = 5) {
  const r = await pool.query(
    'SELECT * FROM reflection_logs ORDER BY created_at DESC LIMIT $1', [limit]
  );
  return r.rows;
}

// ---------- 메인 진입점 ----------

async function runReflection() {
  const verifiedCount = await getVerifiedCount();
  const result = verifiedCount >= 5
    ? await runVerifiedReflection()
    : await runPreliminaryReflection();

  await saveReflection(result);
  return result;
}

module.exports = { runReflection, getLatestReflections };
