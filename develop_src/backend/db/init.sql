CREATE TABLE IF NOT EXISTS reports (
  id              SERIAL PRIMARY KEY,
  filename        VARCHAR(255) NOT NULL UNIQUE,
  stock_name      VARCHAR(100),
  stock_code      VARCHAR(20),
  target_price    BIGINT,
  report_date     DATE,
  opinion         VARCHAR(20),
  author          VARCHAR(100),
  securities_firm VARCHAR(100),
  summary         TEXT,
  risk_types        TEXT,
  risk_score        INTEGER,
  opinion_score     INTEGER,
  final_score       INTEGER,
  ai_recommendation VARCHAR(20),
  current_price     BIGINT,
  price_gap_pct     NUMERIC(6,2),
  gap_interpretation TEXT,
  created_at        TIMESTAMP DEFAULT NOW()
);

-- 기존 설치 환경을 위한 컬럼 추가 (이미 존재하면 무시)
ALTER TABLE reports ADD COLUMN IF NOT EXISTS risk_types TEXT;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS risk_score INTEGER;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS opinion_score INTEGER;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS final_score INTEGER;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS ai_recommendation VARCHAR(20);
ALTER TABLE reports ADD COLUMN IF NOT EXISTS current_price BIGINT;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS price_gap_pct NUMERIC(6,2);
ALTER TABLE reports ADD COLUMN IF NOT EXISTS gap_interpretation TEXT;
