const { pool } = require('../config/database');

async function saveReport(filename, data) {
  const {
    stock_name, stock_code, target_price, report_date,
    opinion, author, securities_firm, summary,
    risk_types, risk_score, opinion_score, final_score, ai_recommendation,
  } = data;

  const query = `
    INSERT INTO reports
      (filename, stock_name, stock_code, target_price, report_date,
       opinion, author, securities_firm, summary,
       risk_types, risk_score, opinion_score, final_score, ai_recommendation)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    ON CONFLICT (filename) DO UPDATE SET
      stock_name        = EXCLUDED.stock_name,
      stock_code        = EXCLUDED.stock_code,
      target_price      = EXCLUDED.target_price,
      report_date       = EXCLUDED.report_date,
      opinion           = EXCLUDED.opinion,
      author            = EXCLUDED.author,
      securities_firm   = EXCLUDED.securities_firm,
      summary           = EXCLUDED.summary,
      risk_types        = EXCLUDED.risk_types,
      risk_score        = EXCLUDED.risk_score,
      opinion_score     = EXCLUDED.opinion_score,
      final_score       = EXCLUDED.final_score,
      ai_recommendation = EXCLUDED.ai_recommendation
    RETURNING *
  `;

  const result = await pool.query(query, [
    filename, stock_name, stock_code, target_price, report_date,
    opinion, author, securities_firm, summary,
    risk_types, risk_score, opinion_score, final_score, ai_recommendation,
  ]);
  return result.rows[0];
}

async function getAllReports() {
  const result = await pool.query(
    'SELECT * FROM reports ORDER BY report_date DESC NULLS LAST, created_at DESC'
  );
  return result.rows;
}

async function getReportById(id) {
  const result = await pool.query('SELECT * FROM reports WHERE id = $1', [id]);
  return result.rows[0] || null;
}

module.exports = { saveReport, getAllReports, getReportById };
