CREATE TABLE IF NOT EXISTS reports (
  id            SERIAL PRIMARY KEY,
  filename      VARCHAR(255) NOT NULL UNIQUE,
  stock_name    VARCHAR(100),
  stock_code    VARCHAR(20),
  target_price  BIGINT,
  report_date   DATE,
  opinion       VARCHAR(20),
  author        VARCHAR(100),
  securities_firm VARCHAR(100),
  summary       TEXT,
  created_at    TIMESTAMP DEFAULT NOW()
);
