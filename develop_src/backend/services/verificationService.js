const { pool } = require('../config/database');
const { getClosingPrice, getD5ClosingPrice } = require('./krxService');

// 검증 가능한 미검증 리포트 조회 (report_date + 7일 이상 경과, stock_code 존재)
async function getUnverifiedReports() {
  const result = await pool.query(`
    SELECT r.id, r.stock_code, r.stock_name, r.report_date,
           r.ai_recommendation
    FROM reports r
    WHERE r.stock_code IS NOT NULL
      AND r.report_date IS NOT NULL
      AND r.report_date <= NOW() - INTERVAL '7 days'
      AND r.id NOT IN (SELECT report_id FROM report_verifications)
    ORDER BY r.report_date ASC
  `);
  return result.rows;
}

// 검증 결과 저장 (UPSERT)
async function upsertVerification(reportId, data) {
  const { d0Date, d0Close, d5Date, d5Close, returnPct, hit } = data;
  await pool.query(`
    INSERT INTO report_verifications (report_id, d0_date, d0_close, d5_date, d5_close, return_pct, hit)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (report_id) DO UPDATE SET
      d0_close    = EXCLUDED.d0_close,
      d5_date     = EXCLUDED.d5_date,
      d5_close    = EXCLUDED.d5_close,
      return_pct  = EXCLUDED.return_pct,
      hit         = EXCLUDED.hit,
      verified_at = NOW()
  `, [reportId, d0Date, d0Close, d5Date, d5Close, returnPct, hit]);
}

// 검증 현황 요약 조회
async function getVerificationStats() {
  const result = await pool.query(`
    SELECT
      COUNT(*)                                            AS total_verified,
      COUNT(*) FILTER (WHERE hit = true)                 AS total_hit,
      ROUND(AVG(return_pct)::numeric, 4)                 AS avg_return_pct,
      ROUND(100.0 * COUNT(*) FILTER (WHERE hit = true)
            / NULLIF(COUNT(*), 0), 2)                    AS overall_hit_rate,
      ROUND(100.0 * COUNT(*) FILTER (WHERE hit = true AND rec = 'Buy')
            / NULLIF(COUNT(*) FILTER (WHERE rec = 'Buy'), 0), 2) AS buy_hit_rate,
      ROUND(100.0 * COUNT(*) FILTER (WHERE hit = true AND rec = 'Hold')
            / NULLIF(COUNT(*) FILTER (WHERE rec = 'Hold'), 0), 2) AS hold_hit_rate,
      ROUND(100.0 * COUNT(*) FILTER (WHERE hit = true AND rec = 'Sell')
            / NULLIF(COUNT(*) FILTER (WHERE rec = 'Sell'), 0), 2) AS sell_hit_rate
    FROM (
      SELECT v.hit, v.return_pct,
             COALESCE(r.ai_recommendation, r.opinion) AS rec
      FROM report_verifications v
      JOIN reports r ON r.id = v.report_id
      WHERE v.d5_close IS NOT NULL
    ) t
  `);
  return result.rows[0];
}

// 적중 여부 판단
function calcHit(recommendation, returnPct) {
  if (returnPct == null) return null;
  if (recommendation === 'Buy')  return returnPct > 0;
  if (recommendation === 'Sell') return returnPct < 0;
  if (recommendation === 'Hold') return Math.abs(returnPct) <= 3;
  return null;
}

// 미검증 리포트 전체 실행
async function runVerification() {
  const reports = await getUnverifiedReports();
  if (reports.length === 0) {
    return { processed: 0, succeeded: 0, failed: 0, details: [] };
  }

  const details = [];

  for (const r of reports) {
    const stockCode  = r.stock_code;
    const reportDate = r.report_date instanceof Date
      ? r.report_date.toISOString().slice(0, 10)
      : String(r.report_date).slice(0, 10);

    try {
      // D+0 종가
      const d0Close = await getClosingPrice(stockCode, reportDate);

      // D+5 영업일 종가
      const d5Result = await getD5ClosingPrice(stockCode, reportDate);

      let returnPct = null;
      let hit = null;

      if (d0Close && d5Result?.price) {
        returnPct = parseFloat(
          (((d5Result.price - d0Close) / d0Close) * 100).toFixed(4)
        );
        hit = calcHit(r.ai_recommendation, returnPct);
      }

      await upsertVerification(r.id, {
        d0Date:    reportDate,
        d0Close:   d0Close || null,
        d5Date:    d5Result?.date || null,
        d5Close:   d5Result?.price || null,
        returnPct,
        hit,
      });

      details.push({
        id: r.id, stock_name: r.stock_name, stock_code: stockCode,
        report_date: reportDate,
        d0_close: d0Close, d5_date: d5Result?.date, d5_close: d5Result?.price,
        return_pct: returnPct, hit,
        success: true,
      });
    } catch (e) {
      console.error(`[Verify] 실패 ${r.id} ${r.stock_name}:`, e.message);
      details.push({ id: r.id, stock_name: r.stock_name, success: false, error: e.message });
    }
  }

  const succeeded = details.filter(d => d.success).length;
  return {
    processed: reports.length,
    succeeded,
    failed: reports.length - succeeded,
    details,
  };
}

// reflectionService에서 사용: 검증 완료 건수
async function getVerifiedCount() {
  const result = await pool.query(
    'SELECT COUNT(*) FROM report_verifications WHERE d5_close IS NOT NULL'
  );
  return parseInt(result.rows[0].count, 10);
}

module.exports = { runVerification, getVerificationStats, getVerifiedCount };
