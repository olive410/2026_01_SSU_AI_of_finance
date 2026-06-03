# 금융AI 투자 어드바이저

> 애널리스트 리포트 PDF를 자동 분석하여 종목별 투자 판단·리스크 점수·컨센서스를 제공하고,  
> KRX D+5 실제 수익률로 AI 성능을 검증·개선하는 자기진화형 투자 분석 시스템

---

## 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [시스템 아키텍처](#2-시스템-아키텍처)
3. [기술 스택](#3-기술-스택)
4. [사전 요구사항](#4-사전-요구사항)
5. [설치 및 환경 설정](#5-설치-및-환경-설정)
6. [실행 방법](#6-실행-방법)
7. [프로젝트 구조](#7-프로젝트-구조)
8. [주요 기능 및 화면](#8-주요-기능-및-화면)
9. [API 명세](#9-api-명세)
10. [데이터베이스 스키마](#10-데이터베이스-스키마)
11. [AI 분석 파이프라인](#11-ai-분석-파이프라인)
12. [KRX D+5 성능 지표](#12-krx-d5-성능-지표)
13. [Claude Code 하네스](#13-claude-code-하네스)
14. [개발 참고사항](#14-개발-참고사항)

---

## 1. 프로젝트 개요

### 배경

증권사 애널리스트 리포트는 신뢰도 높은 투자 정보원이지만, 대량의 장문 PDF로 제공되어 분석에 많은 시간이 소요됩니다. 리포트 간 투자 의견이 불일치하거나 핵심 리스크 정보가 분산되어 판단이 어렵다는 문제도 있습니다.

### 목적

Claude AI를 활용하여 다수의 애널리스트 리포트 PDF를 자동으로 수집·분석하고, 핵심 투자 정보를 구조적으로 추출합니다. 리스크 점수 산출과 다중 리포트 컨센서스 분석을 통해 일관된 투자 판단을 신속하게 제공합니다. KRX 실제 수익률 검증을 통해 AI 추천 품질을 지속적으로 개선합니다.

### 핵심 기능 요약

| 기능 | 설명 |
|------|------|
| PDF 자동 분석 | data_src 폴더의 당일 수정 PDF를 AI로 일괄 분석·저장 |
| v2 프롬프트 | 목표주가 변화, 리스크 유형·원문, 현재주가 동시 추출 |
| 리스크 스코어링 | Macro/Industry/Company 유형별 가중치로 Buy/Hold/Sell 산출 |
| 컨센서스 분석 | 종목별 다중 리포트 집계 + Claude 질적 요약 |
| 목표주가 추이 차트 | 종목별 시계열 꺾은선 차트 (Chart.js) |
| 원문 PDF 뷰어 | 리포트 상세 모달 내 iframe PDF 임베드 |
| AI Reflection | 예비/KRX 검증 모드의 자기반성·프롬프트 개선 |
| KRX D+5 검증 | 실제 주가 수익률 기반 AI 추천 적중률 산출 |
| PDF 저장소 이동 | Downloads → data_src 폴더 원클릭 이동 |

---

## 2. 시스템 아키텍처

```
┌──────────────────────────────────────────────────────────────────┐
│                        사용자 브라우저                              │
│                  http://localhost:5173 (Vue.js 3)                │
│    대시보드 | 리포트 목록 | AI Reflection                          │
└──────────────────────────┬───────────────────────────────────────┘
                           │ HTTP / Vite Proxy (/api → :3000)
┌──────────────────────────▼───────────────────────────────────────┐
│                    Node.js / Express 백엔드                        │
│                    http://localhost:3000                          │
│                                                                  │
│  /api/analyze     → PDF 분석 트리거 (당일 파일·미분석 대상만)       │
│  /api/reports     → 리포트 CRUD + /stock/:code 차트 데이터        │
│  /api/consensus   → 종목별 컨센서스 집계                           │
│  /api/reflection  → AI 반영 실행·이력 조회                        │
│  /api/verify      → KRX D+5 검증 실행·현황 조회                   │
│  /api/pdf         → data_src PDF 파일 서빙 (iframe 뷰어용)        │
│  /api/utils       → Downloads → data_src PDF 이동                │
│                                                                  │
│  ┌─────────────┐   ┌──────────────────┐   ┌──────────────────┐  │
│  │ pdf-parse   │──▶│  Claude Code CLI │──▶│  scoreCalculator │  │
│  │ (텍스트 추출) │   │  claude.exe -p   │   │  (리스크 점수)    │  │
│  └─────────────┘   └──────────────────┘   └────────┬─────────┘  │
│                                                     │            │
│  ┌──────────────────────────────────────────────────▼─────────┐  │
│  │                  PostgreSQL 18                              │  │
│  │   reports | report_risks | report_verifications            │  │
│  │   reflection_logs                                          │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────┐                                    │
│  │  KRX Open API            │  (D+5 종가 조회)                   │
│  │  data-dbg.krx.co.kr      │──▶ verificationService            │
│  └──────────────────────────┘                                    │
└──────────────────────────────────────────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────────┐
│           ~/.claude/.credentials.json                             │
│           (Claude.ai Pro OAuth 인증 — 자동 참조)                   │
└──────────────────────────────────────────────────────────────────┘
```

### 데이터 처리 파이프라인

```
data_src/*.pdf (당일 수정 파일)
      │
      ▼ 1. 텍스트 추출 (pdf-parse)
      │
      ▼ 2. Claude AI 분석 (claude.exe -p, v2 프롬프트)
         → stock_name / stock_code / target_price / previous_target_price
         → target_price_change / current_price / opinion_analyst
         → risks[{type, sentence}] / author / securities_firm / summary
      │
      ▼ 3. 리스크 스코어링 (scoreCalculator.js)
         → opinion_score(목표가 변화) + risk_score(리스크 합산)
         → final_score → ai_recommendation (Buy/Hold/Sell)
         → price_gap_pct (괴리율)
      │
      ▼ 4. PostgreSQL UPSERT (ON CONFLICT filename)
         → reports 테이블 + report_risks 테이블
      │
      ▼ 5. Vue.js 대시보드 시각화
```

---

## 3. 기술 스택

| 영역 | 기술 | 버전 |
|------|------|------|
| 백엔드 | Node.js + Express | v18+ |
| 프론트엔드 | Vue.js 3 (Composition API) | v3.5 |
| 빌드 도구 | Vite | v6 |
| 데이터베이스 | PostgreSQL | v18 |
| AI 엔진 | Claude Code CLI (`claude.exe -p`) | 최신 |
| PDF 파싱 | pdf-parse | v1.1 |
| HTTP 클라이언트 | axios | v1.7 |
| 차트 | Chart.js | v4.4 |
| 라우팅 | Vue Router | v4 |
| KRX 연동 | KRX Open API (유가증권 일별매매정보) | - |

---

## 4. 사전 요구사항

### 필수 소프트웨어

- **Node.js** v18 이상
- **PostgreSQL** 18 (로컬 실행)
- **Claude Code CLI** — Claude.ai Pro 계정으로 로그인된 상태

```bash
npm install -g @anthropic-ai/claude-code
claude   # 최초 실행 시 로그인 진행
```

### 필수 API 키

| 키 | 용도 | 발급처 |
|----|------|--------|
| KRX_API_KEY | D+5 종가 조회 (성능 지표) | https://data-dbg.krx.co.kr |

### Claude.ai 인증 방식

별도의 Anthropic API 키 없이 **Claude.ai Pro 구독 계정**을 활용합니다. Claude Code CLI 설치 후 로그인하면 `~/.claude/.credentials.json`에 OAuth 토큰이 저장되며, 백엔드가 이를 자동으로 참조합니다.

```bash
# 인증 확인
claude -p "안녕"
# 정상 응답이 오면 인증 완료
```

> **주의:** `.credentials.json`은 개인 인증 파일입니다. 절대 외부에 공유하거나 커밋하지 마세요.

---

## 5. 설치 및 환경 설정

### 1) 저장소 클론

```bash
git clone https://github.com/olive410/2026_01_SSU_AI_of_finance.git
cd 2026_01_SSU_AI_of_finance
```

### 2) 패키지 설치

```bash
# 백엔드
cd develop_src/backend && npm install

# 프론트엔드
cd develop_src/frontend && npm install
```

### 3) 환경 변수 설정

```bash
cd develop_src/backend
cp .env.example .env
```

`.env` 파일 내용:

```env
# Claude.ai Pro 사용 시 불필요 (자동 인증)
ANTHROPIC_API_KEY=****

# PostgreSQL 연결 정보
DB_HOST=localhost
DB_PORT=5432
DB_NAME=financial_ai
DB_USER=postgres
DB_PASSWORD=****          # 실제 PostgreSQL 비밀번호 입력

# 서버 포트
PORT=3000

# KRX Open API 인증키 (https://data-dbg.krx.co.kr 에서 발급)
KRX_API_KEY=****          # 실제 인증키 입력
```

> **보안:** `.env` 파일은 `.gitignore`에 의해 git 추적에서 제외됩니다. 실제 키 값을 커밋하지 마세요.

### 4) PostgreSQL 데이터베이스 생성

```bash
psql -U postgres -c "CREATE DATABASE financial_ai ENCODING='UTF8';"
```

> 테이블(4개)은 서버 최초 실행 시 `db/init.sql`에 의해 자동 생성됩니다.

### 5) data_src 폴더 생성

```bash
mkdir data_src
```

분석할 증권사 리포트 PDF를 이 폴더에 저장합니다.

---

## 6. 실행 방법

### 백엔드 서버 시작

```bash
cd develop_src/backend
node server.js
```

정상 실행 확인:
```
데이터베이스 초기화 완료
[Claude] CLI 경로: C:\...\claude.exe
백엔드 서버 실행 중: http://localhost:3000
```

### 프론트엔드 서버 시작

```bash
cd develop_src/frontend
npm run dev -- --port 5173
```

### 브라우저 접속

```
http://localhost:5173
```

### PDF 분석 실행 흐름

1. **PDF 내려받기** 버튼 → 한국경제 컨센서스 사이트에서 PDF 다운로드
2. **PDF파일 저장소로 옮기기** 버튼 → Downloads 폴더 PDF를 data_src로 자동 이동
3. **PDF 분석 시작** 버튼 → 당일 수정된 미분석 PDF 일괄 분석

---

## 7. 프로젝트 구조

```
project-root/
├── .claude/
│   ├── agents/                      # Claude Code 하네스 에이전트 정의
│   │   ├── pdf-handler.md
│   │   ├── report-analyst.md
│   │   ├── risk-scorer.md
│   │   ├── consensus-builder.md
│   │   ├── reflection-runner.md
│   │   ├── backend-dev.md
│   │   └── frontend-dev.md
│   ├── skills/                      # 하네스 스킬 정의
│   │   ├── harness/                 # 메타 스킬
│   │   ├── analyze-report/
│   │   ├── score-report/
│   │   ├── build-consensus/
│   │   ├── run-reflection/
│   │   ├── develop-backend/
│   │   ├── develop-frontend/
│   │   └── financial-ai-advisor/    # 오케스트레이터
│   └── settings.json
│
├── data_src/                        # 분석 대상 PDF (git 제외)
│
├── develop_src/
│   ├── backend/
│   │   ├── server.js                # Express 진입점 + 라우터 마운트
│   │   ├── .env                     # 환경 변수 (git 제외)
│   │   ├── .env.example             # 환경 변수 템플릿
│   │   ├── config/
│   │   │   └── database.js          # PostgreSQL pool
│   │   ├── db/
│   │   │   └── init.sql             # DDL (4개 테이블 자동 생성)
│   │   ├── routes/
│   │   │   ├── analyze.js           # POST /api/analyze
│   │   │   ├── reports.js           # GET /api/reports, /api/reports/stock/:code
│   │   │   ├── consensus.js         # GET /api/consensus/:stock_code
│   │   │   ├── reflection.js        # GET/POST /api/reflection
│   │   │   ├── verification.js      # GET/POST /api/verify
│   │   │   ├── pdf.js               # GET /api/pdf/:filename
│   │   │   └── utils.js             # POST /api/utils/move-pdfs
│   │   └── services/
│   │       ├── pdfParser.js         # PDF 텍스트 추출
│   │       ├── claudeService.js     # Claude CLI 래퍼 + v2 프롬프트
│   │       ├── scoreCalculator.js   # 리스크 점수 산출
│   │       ├── reportService.js     # DB CRUD
│   │       ├── consensusService.js  # 컨센서스 집계
│   │       ├── reflectionService.js # AI 반영 실행
│   │       ├── krxService.js        # KRX Open API 종가 조회
│   │       └── verificationService.js # D+5 검증 로직
│   │
│   └── frontend/
│       ├── vite.config.js           # Vite 설정 + /api 프록시 (→ :3000)
│       └── src/
│           ├── App.vue              # 공통 레이아웃 + 전역 스타일
│           ├── router/index.js
│           └── views/
│               ├── DashboardView.vue   # 통계 + PDF 버튼 3개 + 최근 리포트
│               ├── ReportsView.vue     # 목록·필터·차트 모달·PDF 뷰어
│               └── ReflectionView.vue  # AI 반영 + KRX D+5 성능 지표
│
├── PROMPT_GUIDE.md                  # v2 프롬프트 엔지니어링 가이드
└── README.md
```

---

## 8. 주요 기능 및 화면

### 대시보드 (`/`)

- **통계 카드(2행)**: 애널리스트 투자의견(Buy/Hold/Sell) + AI 리스크 분석 추천
- **PDF 버튼 3개**:
  - `PDF 내려받기` → 한국경제 컨센서스 사이트 열기
  - `PDF파일 저장소로 옮기기` → Downloads → data_src 자동 이동 (확인 다이얼로그)
  - `PDF 분석 시작` → 당일 수정 파일 AI 분석 (기분석 파일 자동 스킵)
- **최근 분석 리포트**: 최신 6건 카드 + 괴리율 칩

### 리포트 목록 (`/reports`)

- **필터**: 종목명·날짜 범위·투자의견·AI 추천·증권사·최소 점수
- **테이블**: 종목명(📈 차트 버튼) · 코드 · 목표주가 · 날짜 · 애널리스트 의견 · 목표가 변화(▲/▼/—) · 괴리율 · 최종점수 · AI 추천 · 작성자 · 증권사
- **목표주가 추이 차트**: 📈 버튼 → 종목별 Chart.js 꺾은선 차트 모달 (현재주가 점선, Buy/Hold/Sell 색상 포인트)
- **리포트 상세 모달**: 투자정보 + 괴리율 배너 + 리스크 점수 + `▼ 원문 PDF 보기` (iframe 임베드)

### AI Reflection (`/reflection`)

- **KRX D+5 검증** 버튼 → KRX API로 D+5 실제 종가 조회, 적중률 산출 후 상단 성능 지표 업데이트
- **성능 지표 카드**: 검증 완료 건수 · 전체/Buy/Hold/Sell 적중률 · 평균 수익률(D+5)
- **반영** 버튼 → 예비 반영 모드(의견 불일치 분석) 또는 KRX 검증 모드(수익률 기반, 5건 이상 시 자동 전환)
- **반영 결과**: 반성 분석 · 발견된 편향 · 개선 제안 · 프롬프트 개선 힌트
- **반영 이력** 테이블 + 상세 모달

### 의견 색상 코드

| 의견 | 색상 | 조건 |
|------|------|------|
| Buy (매수) | 초록 | final_score ≥ +1 |
| Hold (중립) | 노랑 | -3 ≤ final_score ≤ 0 |
| Sell (매도) | 빨강 | final_score ≤ -4 |

---

## 9. API 명세

### 공통 응답 형식

```json
{ "success": true, "data": { ... } }
{ "success": false, "error": "오류 메시지" }
```

---

### `GET /api/health`

서버 상태 확인

```json
{ "status": "ok", "timestamp": "2026-06-03T00:00:00.000Z" }
```

---

### `POST /api/analyze`

data_src 폴더의 당일 수정 PDF 분석 및 DB 저장

- 당일 수정 파일(mtime ≥ 오늘 00:00)만 대상
- DB에 stock_name이 있는 파일은 스킵 (null이면 재분석)

```json
{
  "success": true,
  "total": 4,
  "succeeded": 3,
  "failed": 0,
  "skipped": 1,
  "results": [
    { "file": "649696.pdf", "success": true, "skipped": false, "data": { ... } },
    { "file": "649403.pdf", "success": true, "skipped": true, "reason": "기분석 완료" }
  ]
}
```

---

### `GET /api/reports`

전체 리포트 목록 조회 (최신순)

```json
{
  "success": true,
  "data": [
    {
      "id": 21,
      "filename": "649696.pdf",
      "stock_name": "삼성전기",
      "stock_code": "009150",
      "target_price": 1900000,
      "previous_target_price": 1690000,
      "target_price_change": "up",
      "current_price": 1572000,
      "report_date": "2026-05-26",
      "opinion": "Buy",
      "opinion_analyst": "Buy",
      "opinion_computed": "Buy",
      "author": "양승수",
      "securities_firm": "메리츠증권",
      "summary": "...",
      "risk_score": -2,
      "opinion_score": 2,
      "final_score": 0,
      "ai_recommendation": "Hold",
      "price_gap_pct": 20.90,
      "gap_interpretation": "강한 매수 신호"
    }
  ]
}
```

---

### `GET /api/reports/stock/:code`

종목코드별 전체 리포트 (목표주가 추이 차트용)

---

### `GET /api/consensus/:stock_code`

종목별 컨센서스 집계 (최근 90일, Buy/Hold/Sell 비율 + Claude 질적 요약)

```json
{
  "success": true,
  "data": {
    "consensus": "Buy",
    "report_count": 5,
    "buy_pct": 60.0,
    "hold_pct": 40.0,
    "sell_pct": 0.0,
    "qualitative": {
      "common_risks": "...",
      "divergence": "...",
      "synthesized_summary": "..."
    }
  }
}
```

---

### `GET /api/reflection`

최근 AI 반영 이력 조회 (최신 5건)

### `POST /api/reflection/run`

AI 반영 실행 (예비/KRX 검증 모드 자동 선택)

---

### `POST /api/verify/run`

KRX D+5 검증 실행 (미검증·7일 경과 리포트 대상)

```json
{
  "success": true,
  "data": {
    "processed": 5,
    "succeeded": 4,
    "failed": 1,
    "details": [
      {
        "stock_name": "삼성전자",
        "report_date": "2026-05-14",
        "d5_date": "2026-05-21",
        "d0_close": 74000,
        "d5_close": 76200,
        "return_pct": 2.97,
        "hit": true
      }
    ]
  }
}
```

### `GET /api/verify/status`

KRX 검증 현황 요약 (전체/Buy/Hold/Sell 적중률, 평균 수익률)

---

### `GET /api/pdf/:filename`

data_src 폴더의 PDF 파일 직접 서빙 (리포트 상세 모달 iframe용)

### `POST /api/utils/move-pdfs`

Downloads 폴더의 PDF 파일을 data_src로 이동

---

## 10. 데이터베이스 스키마

### reports — 메인 리포트 테이블

```sql
CREATE TABLE IF NOT EXISTS reports (
  id                    SERIAL PRIMARY KEY,
  filename              VARCHAR(255) NOT NULL UNIQUE,
  stock_name            VARCHAR(100),
  stock_code            VARCHAR(20),
  target_price          BIGINT,
  previous_target_price BIGINT,
  target_price_change   VARCHAR(10),    -- 'up' / 'flat' / 'down'
  current_price         BIGINT,
  report_date           DATE,
  opinion               VARCHAR(20),    -- 하위 호환
  opinion_analyst       VARCHAR(20),    -- AI 추출 원본 의견
  opinion_computed      VARCHAR(20),    -- 점수 기반 계산 의견
  author                VARCHAR(100),
  securities_firm       VARCHAR(100),
  summary               TEXT,
  risk_types            TEXT,           -- JSON 배열
  risk_score            INTEGER,
  opinion_score         INTEGER,
  final_score           INTEGER,
  score                 INTEGER,
  ai_recommendation     VARCHAR(20),
  price_gap_pct         NUMERIC(6,2),
  gap_interpretation    TEXT,
  created_at            TIMESTAMP DEFAULT NOW()
);
```

### report_risks — 리스크 정규화 테이블 (1:N)

```sql
CREATE TABLE IF NOT EXISTS report_risks (
  id         SERIAL PRIMARY KEY,
  report_id  INTEGER REFERENCES reports(id) ON DELETE CASCADE,
  risk_type  VARCHAR(20) CHECK (risk_type IN ('Macro','Industry','Company')),
  sentence   TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### report_verifications — KRX D+5 검증 테이블

```sql
CREATE TABLE IF NOT EXISTS report_verifications (
  id          SERIAL PRIMARY KEY,
  report_id   INTEGER REFERENCES reports(id) ON DELETE CASCADE,
  d0_date     DATE NOT NULL,
  d0_close    BIGINT,
  d5_date     DATE,
  d5_close    BIGINT,
  return_pct  NUMERIC(8,4),
  hit         BOOLEAN,
  verified_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(report_id)
);
```

### reflection_logs — AI 반영 이력 테이블

```sql
CREATE TABLE IF NOT EXISTS reflection_logs (
  id                    SERIAL PRIMARY KEY,
  mode                  VARCHAR(20),     -- 'preliminary' / 'verified'
  sample_size           INTEGER,
  overall_hit_rate      NUMERIC(5,2),
  buy_hit_rate          NUMERIC(5,2),
  hold_hit_rate         NUMERIC(5,2),
  sell_hit_rate         NUMERIC(5,2),
  avg_return_pct        NUMERIC(8,4),
  opinion_match_rate    NUMERIC(5,2),
  reflection            TEXT,
  bias_found            TEXT,
  adjustment_suggestions TEXT,           -- JSON 배열
  prompt_hint           TEXT,
  created_at            TIMESTAMP DEFAULT NOW()
);
```

---

## 11. AI 분석 파이프라인

### v2 프롬프트 추출 스키마

`claudeService.js`의 SYSTEM_CONTEXT가 Claude에게 아래 JSON을 반환하도록 지시합니다:

```json
{
  "stock_name": "삼성전기",
  "stock_code": "009150",
  "target_price": 1900000,
  "previous_target_price": 1690000,
  "target_price_change": "up",
  "current_price": 1572000,
  "report_date": "2026-05-26",
  "opinion_analyst": "Buy",
  "author": "양승수",
  "securities_firm": "메리츠증권",
  "summary": "MLCC 가격 인상 사이클 본격 진입...",
  "risks": [
    { "type": "Macro", "sentence": "기준금리 인하 시 NIM 축소 우려" },
    { "type": "Industry", "sentence": "MLCC 공급 과잉 리스크" },
    { "type": "Company", "sentence": "부동산 PF 충당금 증가 가능" }
  ]
}
```

### 리스크 점수 산출 기준

| 구분 | 점수 |
|------|------|
| Macro 리스크 | -1 |
| Industry 리스크 | -2 |
| Company 리스크 | -2 |
| 목표가 상향(up) | +2 |
| 목표가 유지(flat) | 0 |
| 목표가 하향(down) | -2 |

**최종 추천 기준**: final_score = opinion_score + risk_score

| final_score | 추천 |
|-------------|------|
| ≥ +1 | **Buy** |
| -3 ~ 0 | **Hold** |
| ≤ -4 | **Sell** |

### JSON 파싱 방식

Claude 응답에서 중괄호 깊이를 추적하여 최상위 JSON 객체를 정확히 추출합니다 (비탐욕적 정규식의 내부 객체 오인 방지):

```javascript
function extractTopLevelJson(text) {
  let depth = 0, start = -1, lastValid = null;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{') { if (depth === 0) start = i; depth++; }
    else if (text[i] === '}') {
      depth--;
      if (depth === 0 && start !== -1) {
        try { lastValid = JSON.parse(text.slice(start, i + 1)); } catch (_) {}
        start = -1;
      }
    }
  }
  return lastValid;
}
```

---

## 12. KRX D+5 성능 지표

AI 투자 판단의 신뢰성을 평가하기 위해 리포트 작성일 기준 5 영업일 후의 실제 종가 증감률로 적중 여부를 산출합니다.

### 적중 판정 기준

| AI 추천 | 적중 조건 |
|---------|----------|
| Buy | D+5 수익률 > 0% |
| Sell | D+5 수익률 < 0% |
| Hold | D+5 수익률 ±3% 이내 |

### KRX API 정보

- **엔드포인트**: `https://data-dbg.krx.co.kr/svc/apis/sto/stk_bydd_trd`
- **파라미터**: `AUTH_KEY`, `ISU_CD`(종목코드), `TRD_DD`(YYYYMMDD)
- **D+5 산출 방식**: 달력 +7일부터 시작해 최대 +11일까지 첫 번째 거래일 데이터 사용

### 반영 모드 자동 전환

| 조건 | 반영 모드 |
|------|----------|
| 검증 완료 건수 < 5 | 예비 반영 모드 (애널리스트 vs AI 의견 불일치 분석) |
| 검증 완료 건수 ≥ 5 | KRX 검증 모드 (실제 수익률 기반 적중률 분석) |

---

## 13. Claude Code 하네스

이 프로젝트는 Claude Code 하네스로 전문 에이전트 팀을 구성합니다.

### 에이전트 팀

| 에이전트 | 역할 | 담당 스킬 |
|---------|------|----------|
| `pdf-handler` | PDF 파일 관리·추출 | `analyze-report` |
| `report-analyst` | Claude AI 리포트 분석 | `analyze-report` |
| `risk-scorer` | 리스크 점수 산출 | `score-report` |
| `consensus-builder` | 컨센서스 집계 | `build-consensus` |
| `reflection-runner` | AI 반영 실행 | `run-reflection` |
| `backend-dev` | Node.js 백엔드 개발 | `develop-backend` |
| `frontend-dev` | Vue.js 프론트엔드 개발 | `develop-frontend` |

### 오케스트레이터

`financial-ai-advisor` 스킬이 시나리오별로 에이전트를 조율합니다. 예) 일일 분석 파이프라인, 컨센서스 조회, AI 반영 실행, 개발 작업.

---

## 14. 개발 참고사항

### 서버 재시작 (포트 충돌 방지)

```powershell
# Windows — 기존 node 프로세스 완전 종료
Get-Process -Name "node" | Stop-Process -Force

# 5173 포트 점유 프로세스 종료
$pids = (netstat -ano | Select-String ":5173" | ForEach-Object { ($_ -split '\s+')[-1] })
foreach ($p in $pids) { Stop-Process -Id $p -Force -ErrorAction SilentlyContinue }
```

### PDF 분석 실패 시 점검 사항

1. PDF가 텍스트 기반인지 확인 (스캔 이미지 PDF는 추출 불가)
2. `claude -p "테스트"` 로 CLI 인증 상태 확인
3. `/tmp/backend.log` 에서 오류 로그 확인
4. `.env` 파일의 DB 연결 정보 재확인

### Claude CLI 인증 만료 시

```bash
claude   # 대화형 화면에서 재로그인 후 Ctrl+C
```

### git 커밋 시 민감정보 처리

`.env` 파일은 `.gitignore`에 의해 자동 제외됩니다. `.env.example`에는 모든 키가 `****`로 마스킹됩니다.

```
# .gitignore 핵심 항목
develop_src/backend/.env    # 실제 키 값 보호
data_src/                   # 원본 PDF 파일
.claude/projects/           # 대화 이력
.claude/settings.local.json # 로컬 설정
```

---

## 라이선스

본 프로젝트는 내부 연구 목적으로 개발되었습니다.

---

*숭실대학교 정보과학대학원 IH 프로젝트 — 2026*
