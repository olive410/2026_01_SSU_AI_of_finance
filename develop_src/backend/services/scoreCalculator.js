// §6 리스크 분류 및 점수 산정 (PROMPT_GUIDE.md)
const RISK_SCORE = { Macro: -1, Industry: -2, Company: -2 };
const TP_SCORE   = { up: 2, flat: 0, down: -2 };

// 괴리율 계산 (§ 이전 claudeService에서 이동)
const GAP_THRESHOLDS = [
  { min: 30,   label: pct => `목표주가까지 상승 여력 ${pct}%, 시장 기대치가 높은 상황` },
  { min: 15,   label: pct => `적정 수준의 상승 여력 보유 (${pct}%)` },
  { min: 5,    label: pct => `목표주가에 근접, 보수적 접근 권장 (${pct}%)` },
  { min: 0.01, label: pct => `목표주가 거의 도달, 추가 상승 여력 제한적 (${pct}%)` },
  { min: -Infinity, label: pct => `현재주가가 목표주가 초과, 하락 리스크 구간 (${pct}%)` },
];

function calcPriceGap(targetPrice, currentPrice) {
  if (!targetPrice || !currentPrice || currentPrice === 0) {
    return { price_gap_pct: null, gap_interpretation: null };
  }
  const gap = ((targetPrice - currentPrice) / currentPrice) * 100;
  const pct = Math.round(gap * 10) / 10;
  const { label } = GAP_THRESHOLDS.find(t => pct >= t.min);
  return { price_gap_pct: pct, gap_interpretation: label(pct) };
}

// §6.2 최종 점수 공식: final_score = tp_change_score + Σ(risk_type_score)
// §6.3 점수 → 의견 매핑
function calculateScore(analysis) {
  const tpScore   = TP_SCORE[analysis.target_price_change] ?? 0;
  const riskScore = (analysis.risks || []).reduce(
    (sum, r) => sum + (RISK_SCORE[r.type] ?? 0), 0
  );
  const score = tpScore + riskScore;

  let opinion_computed;
  if (score >= 1)       opinion_computed = 'Buy';
  else if (score >= -3) opinion_computed = 'Hold';
  else                  opinion_computed = 'Sell';

  // 괴리율
  const { price_gap_pct, gap_interpretation } = calcPriceGap(
    analysis.target_price, analysis.current_price
  );

  return {
    score,
    opinion_computed,
    // 기존 컬럼 호환 유지
    final_score: score,
    ai_recommendation: opinion_computed,
    risk_types: JSON.stringify((analysis.risks || []).map(r => r.type)),
    risk_score: riskScore,
    opinion_score: tpScore,
    price_gap_pct,
    gap_interpretation,
  };
}

module.exports = { calculateScore };
