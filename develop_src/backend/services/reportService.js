const { pool } = require('../config/database');

async function saveReport(filename, data) {
  const {
    stock_name, stock_code, target_price, previous_target_price, target_price_change,
    current_price, report_date,
    opinion_analyst, opinion_computed, author, securities_firm, summary,
    risk_types, risk_score, opinion_score, final_score, score, ai_recommendation,
    price_gap_pct, gap_interpretation,
  } = data;

  // opinion_analyst → opinion 동기화 (하위 호환)
  const opinion = opinion_analyst || data.opinion || null;

  const query = `
    INSERT INTO reports (
      filename, stock_name, stock_code,
      target_price, previous_target_price, target_price_change,
      current_price, report_date,
      opinion, opinion_analyst, opinion_computed,
      author, securities_firm, summary,
      risk_types, risk_score, opinion_score,
      final_score, score, ai_recommendation,
      price_gap_pct, gap_interpretation
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
    ON CONFLICT (filename) DO UPDATE SET
      stock_name            = EXCLUDED.stock_name,
      stock_code            = EXCLUDED.stock_code,
      target_price          = EXCLUDED.target_price,
      previous_target_price = EXCLUDED.previous_target_price,
      target_price_change   = EXCLUDED.target_price_change,
      current_price         = EXCLUDED.current_price,
      report_date           = EXCLUDED.report_date,
      opinion               = EXCLUDED.opinion,
      opinion_analyst       = EXCLUDED.opinion_analyst,
      opinion_computed      = EXCLUDED.opinion_computed,
      author                = EXCLUDED.author,
      securities_firm       = EXCLUDED.securities_firm,
      summary               = EXCLUDED.summary,
      risk_types            = EXCLUDED.risk_types,
      risk_score            = EXCLUDED.risk_score,
      opinion_score         = EXCLUDED.opinion_score,
      final_score           = EXCLUDED.final_score,
      score                 = EXCLUDED.score,
      ai_recommendation     = EXCLUDED.ai_recommendation,
      price_gap_pct         = EXCLUDED.price_gap_pct,
      gap_interpretation    = EXCLUDED.gap_interpretation
    RETURNING *
  `;

  const result = await pool.query(query, [
    filename, stock_name, stock_code,
    target_price, previous_target_price, target_price_change,
    current_price, report_date,
    opinion, opinion_analyst, opinion_computed,
    author, securities_firm, summary,
    risk_types, risk_score, opinion_score,
    final_score, score, ai_recommendation,
    price_gap_pct, gap_interpretation,
  ]);

  return result.rows[0];
}

// report_risks 정규화 테이블에 리스크 저장 (§11)
async function saveRisks(reportId, risks) {
  if (!Array.isArray(risks) || risks.length === 0) return;

  await pool.query('DELETE FROM report_risks WHERE report_id = $1', [reportId]);

  for (const r of risks) {
    if (!['Macro', 'Industry', 'Company'].includes(r.type)) continue;
    await pool.query(
      'INSERT INTO report_risks (report_id, risk_type, sentence) VALUES ($1, $2, $3)',
      [reportId, r.type, r.sentence || null]
    );
  }
}

async function getAllReports() {
  const result = await pool.query(
    'SELECT * FROM reports ORDER BY report_date DESC NULLS LAST, created_at DESC'
  );
  return result.rows;
}

// 종목별 최근 90일 리포트 조회 (§7.1)
async function getRecentReportsByStock(stockCode, days = 90) {
  const result = await pool.query(
    `SELECT r.*, COALESCE(
       (SELECT json_agg(json_build_object('type', rr.risk_type, 'sentence', rr.sentence))
        FROM report_risks rr WHERE rr.report_id = r.id), '[]'
     ) AS risk_details
     FROM reports r
     WHERE r.stock_code = $1
       AND r.report_date >= NOW() - INTERVAL '${days} days'
     ORDER BY r.report_date DESC`,
    [stockCode]
  );
  return result.rows;
}

async function getReportById(id) {
  const result = await pool.query('SELECT * FROM reports WHERE id = $1', [id]);
  return result.rows[0] || null;
}

module.exports = { saveReport, saveRisks, getAllReports, getRecentReportsByStock, getReportById };
