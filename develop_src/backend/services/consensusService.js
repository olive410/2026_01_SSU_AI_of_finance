// §7 다중 애널리스트 종합 분석 (PROMPT_GUIDE.md)
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { getRecentReportsByStock } = require('./reportService');

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

// §7.3 통계는 코드로, 정성적 요약만 AI에 위임
function decideConsensus(stats) {
  const total = stats.report_count || 1;
  const buyPct  = (stats.buy_count  / total) * 100;
  const sellPct = (stats.sell_count / total) * 100;
  if (buyPct  >= 60) return 'Buy';
  if (sellPct >= 60) return 'Sell';
  if (buyPct >= 30 && sellPct >= 30) return 'Mixed';
  return 'Hold';
}

function avg(arr) {
  const valid = arr.filter(v => v != null && !isNaN(v));
  if (valid.length === 0) return null;
  return Math.round(valid.reduce((s, v) => s + Number(v), 0) / valid.length);
}

async function callClaudeForSynthesis(reports, stats) {
  const snippets = reports.slice(0, 6).map(r => ({
    securities_firm: r.securities_firm,
    author: r.author,
    report_date: r.report_date ? String(r.report_date).slice(0, 10) : null,
    opinion: r.opinion_analyst || r.opinion,
    target_price: r.target_price,
    score: r.score ?? r.final_score,
    summary: r.summary,
  }));

  const prompt = `당신은 여러 증권사 애널리스트 리포트를 종합 분석하는 전문 AI입니다.
아래 동일 종목 리포트 데이터를 읽고 다음 JSON 객체**만** 반환하세요. 다른 텍스트 금지.

{
  "common_risks": ["여러 리포트에서 공통적으로 언급된 리스크 2~3개 한국어"],
  "divergence": "의견이 갈리는 핵심 쟁점 1~2문장 한국어 (없으면 null)",
  "synthesized_summary": "전체 종합 요약 3~4문장 한국어"
}

# 통계 참고 (이미 계산됨)
- 리포트 수: ${stats.report_count}건
- 의견 분포: Buy ${stats.buy_count} / Hold ${stats.hold_count} / Sell ${stats.sell_count}
- 평균 목표주가: ${stats.avg_target_price?.toLocaleString('ko-KR')}원
- 종합 의견: ${stats.consensus}

# 리포트 데이터
${JSON.stringify(snippets, null, 2)}`;

  return new Promise((resolve) => {
    const child = spawn(CLAUDE_BIN, ['-p', prompt], {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: CLAUDE_BIN.endsWith('.cmd'),
    });
    let stdout = '';
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      resolve({ common_risks: [], divergence: null, synthesized_summary: '종합 분석 시간 초과.' });
    }, 90000);

    child.stdout.on('data', d => { stdout += d.toString(); });
    child.on('close', () => {
      clearTimeout(timer);
      const matches = stdout.match(/\{[\s\S]*?\}/g);
      if (!matches) return resolve({ common_risks: [], divergence: null, synthesized_summary: null });
      try {
        resolve(JSON.parse(matches[matches.length - 1]));
      } catch {
        resolve({ common_risks: [], divergence: null, synthesized_summary: null });
      }
    });
    child.on('error', () => {
      clearTimeout(timer);
      resolve({ common_risks: [], divergence: null, synthesized_summary: null });
    });
  });
}

async function buildConsensus(stockCode) {
  const reports = await getRecentReportsByStock(stockCode, 90);

  if (reports.length === 0) return null;

  // §7.3 통계 계산 (코드)
  const stats = {
    stock_name:  reports[0].stock_name,
    stock_code:  stockCode,
    report_count: reports.length,
    buy_count:   reports.filter(r => (r.opinion_computed || r.ai_recommendation) === 'Buy').length,
    hold_count:  reports.filter(r => (r.opinion_computed || r.ai_recommendation) === 'Hold').length,
    sell_count:  reports.filter(r => (r.opinion_computed || r.ai_recommendation) === 'Sell').length,
    avg_target_price: avg(reports.map(r => r.target_price)),
    max_target_price: Math.max(...reports.map(r => r.target_price).filter(Boolean)),
    min_target_price: Math.min(...reports.map(r => r.target_price).filter(Boolean)),
    avg_score: (() => {
      const scores = reports.map(r => r.score ?? r.final_score).filter(v => v != null);
      return scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100 : null;
    })(),
  };
  stats.consensus = decideConsensus(stats);

  // §7.3 정성적 요약만 AI에 위임
  const qualitative = await callClaudeForSynthesis(reports, stats);

  return { ...stats, ...qualitative, reports };
}

module.exports = { buildConsensus };
