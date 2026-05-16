const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'financial_ai',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function initDatabase() {
  const sql = fs.readFileSync(path.join(__dirname, '../db/init.sql'), 'utf8');
  await pool.query(sql);
  console.log('데이터베이스 초기화 완료');
}

module.exports = { pool, initDatabase };
