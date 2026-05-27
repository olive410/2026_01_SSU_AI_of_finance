-- reports 메인 테이블
CREATE TABLE IF NOT EXISTS reports (
  id                    SERIAL PRIMARY KEY,
  filename              VARCHAR(255) NOT NULL UNIQUE,
  stock_name            VARCHAR(100),
  stock_code            VARCHAR(20),
  target_price          BIGINT,
  previous_target_price BIGINT,
  target_price_change   VARCHAR(10),       -- 'up' / 'flat' / 'down'
  current_price         BIGINT,
  report_date           DATE,
  opinion               VARCHAR(20),       -- 하위 호환
  opinion_analyst       VARCHAR(20),       -- AI 추출 원본 의견
  opinion_computed      VARCHAR(20),       -- 점수 기반 계산 의견
  author                VARCHAR(100),
  securities_firm       VARCHAR(100),
  summary               TEXT,
  risk_types            TEXT,              -- JSON 배열 (하위 호환)
  risk_score            INTEGER,
  opinion_score         INTEGER,
  final_score           INTEGER,           -- 하위 호환
  score                 INTEGER,           -- 최종 점수 (= final_score)
  ai_recommendation     VARCHAR(20),       -- 하위 호환
  price_gap_pct         NUMERIC(6,2),
  gap_interpretation    TEXT,
  created_at            TIMESTAMP DEFAULT NOW()
);

-- 기존 설치 환경을 위한 컬럼 추가 (이미 존재하면 무시)
ALTER TABLE reports ADD COLUMN IF NOT EXISTS previous_target_price BIGINT;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS target_price_change   VARCHAR(10);
ALTER TABLE reports ADD COLUMN IF NOT EXISTS opinion_analyst       VARCHAR(20);
ALTER TABLE reports ADD COLUMN IF NOT EXISTS opinion_computed      VARCHAR(20);
ALTER TABLE reports ADD COLUMN IF NOT EXISTS score                 INTEGER;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS risk_types            TEXT;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS risk_score            INTEGER;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS opinion_score         INTEGER;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS final_score           INTEGER;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS ai_recommendation     VARCHAR(20);
ALTER TABLE reports ADD COLUMN IF NOT EXISTS current_price         BIGINT;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS price_gap_pct         NUMERIC(6,2);
ALTER TABLE reports ADD COLUMN IF NOT EXISTS gap_interpretation    TEXT;

-- §11 리스크 정규화 테이블 (1 리포트 N 리스크)
CREATE TABLE IF NOT EXISTS report_risks (
  id          SERIAL PRIMARY KEY,
  report_id   INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  risk_type   VARCHAR(20) NOT NULL CHECK (risk_type IN ('Macro','Industry','Company')),
  sentence    TEXT,
  created_at  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_report_risks_report_id ON report_risks(report_id);
CREATE INDEX IF NOT EXISTS idx_report_risks_type      ON report_risks(risk_type);

-- §10.4 KRX 사후 검증 테이블
CREATE TABLE IF NOT EXISTS report_verifications (
  id          SERIAL PRIMARY KEY,
  report_id   INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  d0_date     DATE NOT NULL,
  d0_close    BIGINT,
  d5_date     DATE,
  d5_close    BIGINT,
  return_pct  NUMERIC(8,4),
  hit         BOOLEAN,
  verified_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(report_id)
);

-- Reflection 반성 로그 테이블
CREATE TABLE IF NOT EXISTS reflection_logs (
  id                      SERIAL PRIMARY KEY,
  mode                    VARCHAR(20),       -- 'preliminary' (예비) / 'verified' (검증)
  sample_size             INTEGER,
  overall_hit_rate        NUMERIC(5,2),
  buy_hit_rate            NUMERIC(5,2),
  hold_hit_rate           NUMERIC(5,2),
  sell_hit_rate           NUMERIC(5,2),
  avg_return_pct          NUMERIC(8,4),
  opinion_match_rate      NUMERIC(5,2),      -- 애널리스트 vs AI 일치율
  reflection              TEXT,
  bias_found              TEXT,
  adjustment_suggestions  TEXT,              -- JSON 배열
  prompt_hint             TEXT,
  created_at              TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reflection_logs_created ON reflection_logs(created_at DESC);
