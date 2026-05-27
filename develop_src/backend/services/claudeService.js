const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Claude Code CLI 실행 파일 경로 (Claude.ai Pro 인증 공유)
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
console.log(`[Claude] CLI 경로: ${CLAUDE_BIN}`);

// 리스크 유형별 가중치
const RISK_WEIGHTS = { Macro: -1, Industry: -2, Company: -2 };
// 애널리스트 의견별 점수
const OPINION_SCORES = { Buy: 2, Hold: 0, Sell: -2 };

// 괴리율 해석 기준 (Few-shot 가이드라인 — 프롬프트에도 동일하게 사용)
const GAP_GUIDE = `[괴리율 해석 가이드]
- 괴리율 >= 30%: 목표주가까지 상승 여력이 크며 시장 기대치가 높은 상황
- 15% <= 괴리율 < 30%: 적정 수준의 상승 여력 보유
- 5% <= 괴리율 < 15%: 목표주가에 근접하여 보수적 접근 권장
- 0% < 괴리율 < 5%: 목표주가 거의 도달, 추가 상승 여력 제한적
- 괴리율 <= 0%: 현재주가가 목표주가 초과, 하락 리스크 구간`;

const SYSTEM_CONTEXT = `당신은 한국 증권사 애널리스트 리포트를 분석하는 전문 AI입니다.
리포트 텍스트에서 아래 정보를 추출하여 반드시 JSON 객체만 반환하세요. 다른 텍스트는 포함하지 마세요.

{
  "stock_name": "종목명(회사명)",
  "stock_code": "종목코드(숫자만, 예:272210)",
  "target_price": 목표주가숫자(원단위정수, 예:169000),
  "current_price": 현재주가숫자(리포트에 명시된 기준주가/현재가, 없으면 null),
  "report_date": "YYYY-MM-DD 형식 날짜",
  "opinion": "Buy 또는 Hold 또는 Sell 중 하나",
  "author": "작성 애널리스트 이름",
  "securities_firm": "발행 증권사명",
  "summary": "핵심 투자 포인트 2~3문장 한국어. 괴리율 정보가 있으면 상승 여력을 명시하여 투자 매력도를 표현하세요.",
  "risk_factors": [
    {"description": "리스크 내용 한국어", "type": "Macro 또는 Industry 또는 Company 중 하나"},
    ...
  ]
}

opinion 변환: 매수/BUY/비중확대→Buy, 중립/HOLD/Neutral→Hold, 비중축소/SELL→Sell
current_price 탐색: 리포트 상단 현재가, 기준가, 주가 등의 항목에서 추출
risk_factors 분류 기준:
  - Macro: 금리, 환율, 경기침체 등 시장 전체 리스크
  - Industry: 업황 둔화, 경쟁 심화 등 산업 관련 리스크
  - Company: 실적 감소, 비용 증가 등 기업 내부 리스크
찾을 수 없는 항목은 null로 표기, risk_factors가 없으면 빈 배열 []

${GAP_GUIDE}
위 가이드라인을 참고하여 summary 작성 시 괴리율 맥락을 반영하세요.`;

// 괴리율 계산 및 해석 (Node.js에서 확정 계산)
function calcPriceGap(targetPrice, currentPrice) {
  if (!targetPrice || !currentPrice || currentPrice === 0) {
    return { price_gap_pct: null, gap_interpretation: null };
  }
  const gap = ((targetPrice - currentPrice) / currentPrice) * 100;
  const gapRounded = Math.round(gap * 10) / 10;

  let interp;
  if (gapRounded >= 30)        interp = `목표주가까지 상승 여력 ${gapRounded}%, 시장 기대치가 높은 상황`;
  else if (gapRounded >= 15)   interp = `적정 수준의 상승 여력 보유 (${gapRounded}%)`;
  else if (gapRounded >= 5)    interp = `목표주가에 근접, 보수적 접근 권장 (${gapRounded}%)`;
  else if (gapRounded > 0)     interp = `목표주가 거의 도달, 추가 상승 여력 제한적 (${gapRounded}%)`;
  else                         interp = `현재주가가 목표주가 초과, 하락 리스크 구간 (${gapRounded}%)`;

  return { price_gap_pct: gapRounded, gap_interpretation: interp };
}

// 리스크 점수 산출 (Node.js에서 계산 — 확정적 결과 보장)
function calcScores(data) {
  const factors = Array.isArray(data.risk_factors) ? data.risk_factors : [];
  const riskTypes = factors.map(f => f.type).filter(t => RISK_WEIGHTS[t] !== undefined);
  const riskScore = riskTypes.reduce((sum, t) => sum + RISK_WEIGHTS[t], 0);
  const opinionScore = OPINION_SCORES[data.opinion] ?? 0;
  const finalScore = opinionScore + riskScore;
  const aiRecommendation = finalScore >= 2 ? 'Buy' : finalScore >= 0 ? 'Hold' : 'Sell';

  const { price_gap_pct, gap_interpretation } = calcPriceGap(data.target_price, data.current_price);

  return {
    risk_types: JSON.stringify(riskTypes),
    risk_score: riskScore,
    opinion_score: opinionScore,
    final_score: finalScore,
    ai_recommendation: aiRecommendation,
    current_price: data.current_price ?? null,
    price_gap_pct,
    gap_interpretation,
  };
}

async function analyzeReport(pdfText) {
  const prompt = `${SYSTEM_CONTEXT}\n\n===리포트 텍스트===\n${pdfText.slice(0, 8500)}`;

  return new Promise((resolve, reject) => {
    const child = spawn(CLAUDE_BIN, ['-p', prompt], {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: CLAUDE_BIN.endsWith('.cmd'),
    });

    let stdout = '';
    let stderr = '';

    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error('Claude 응답 시간 초과 (90초)'));
    }, 90000);

    child.stdout.on('data', d => { stdout += d.toString(); });
    child.stderr.on('data', d => { stderr += d.toString(); });

    child.on('close', () => {
      clearTimeout(timer);
      if (!stdout.trim()) {
        return reject(new Error('Claude 응답 없음: ' + stderr.slice(0, 200)));
      }
      const match = stdout.match(/\{[\s\S]*\}/);
      if (!match) {
        return reject(new Error('JSON 없음: ' + stdout.slice(0, 300)));
      }
      try {
        const parsed = JSON.parse(match[0]);
        const scores = calcScores(parsed);
        resolve({ ...parsed, ...scores });
      } catch (e) {
        reject(new Error('JSON 파싱 실패: ' + e.message));
      }
    });

    child.on('error', err => {
      clearTimeout(timer);
      reject(new Error(`claude 실행 오류 (${CLAUDE_BIN}): ${err.message}`));
    });
  });
}

module.exports = { analyzeReport };
