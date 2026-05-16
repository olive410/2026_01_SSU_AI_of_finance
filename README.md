# 금융AI 투자 어드바이저

> 애널리스트 리포트 PDF를 자동 분석하여 종목별 투자 판단 정보를 추출·저장·시각화하는 AI 시스템

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
11. [AI 분석 흐름](#11-ai-분석-흐름)
12. [개발 참고사항](#12-개발-참고사항)

---

## 1. 프로젝트 개요

### 배경

증권사 애널리스트 리포트는 신뢰도 높은 투자 정보원이지만, 대량의 장문 PDF로 제공되어 분석에 많은 시간이 소요됩니다. 리포트 간 투자 의견이 불일치하거나 핵심 리스크 정보가 분산되어 판단이 어렵다는 문제도 있습니다.

### 목적

Claude AI를 활용하여 다수의 애널리스트 리포트 PDF를 자동으로 수집·분석하고, 핵심 투자 정보(목표주가, 투자의견, 작성자 등)를 구조적으로 추출하여 일관된 투자 판단을 신속하게 제공합니다.

### 핵심 기능

| 기능 | 설명 |
|------|------|
| PDF 자동 분석 | `data_src` 폴더의 PDF 파일을 일괄 텍스트 추출 후 AI 분석 |
| 정보 구조화 | 종목명·목표주가·시점·의견·작성자를 JSON으로 추출 |
| DB 저장 | 추출 결과를 PostgreSQL에 저장 (중복 파일 자동 업데이트) |
| 웹 대시보드 | Buy/Hold/Sell 통계, 리포트 목록, 상세 모달을 웹에서 시각화 |

---

## 2. 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────┐
│                      사용자 브라우저                        │
│              http://localhost:5173 (Vue.js)              │
└──────────────────────────┬──────────────────────────────┘
                           │ HTTP (Vite Proxy)
┌──────────────────────────▼──────────────────────────────┐
│                  Node.js 백엔드 서버                        │
│                  http://localhost:3000                    │
│                                                          │
│  ┌─────────────────┐      ┌──────────────────────────┐  │
│  │  PDF 전처리      │      │      AI Agent            │  │
│  │  (pdf-parse)    │─────▶│  (Claude Code CLI -p)    │  │
│  └─────────────────┘      └──────────┬───────────────┘  │
│                                      │                   │
│  ┌───────────────────────────────────▼───────────────┐  │
│  │              PostgreSQL DB                         │  │
│  │              (reports 테이블)                       │  │
│  └────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│           ~/.claude/.credentials.json                    │
│           (Claude.ai Pro OAuth 인증 — 자동 참조)           │
└─────────────────────────────────────────────────────────┘
```

### 데이터 처리 파이프라인

```
data_src/*.pdf
      │
      ▼ 1. 텍스트 추출 (pdf-parse)
      │
      ▼ 2. Claude AI 분석 (claude -p 명령)
         → 종목명 / 목표주가 / 시점 / 의견 / 작성자 / 증권사 / 요약 추출
      │
      ▼ 3. PostgreSQL 저장 (UPSERT)
      │
      ▼ 4. Vue.js 대시보드 표시
```

---

## 3. 기술 스택

| 영역 | 기술 | 버전 |
|------|------|------|
| 백엔드 | Node.js + Express | v18+ |
| 프론트엔드 | Vue.js 3 (Composition API) | v3.5 |
| 빌드 도구 | Vite | v6 |
| 데이터베이스 | PostgreSQL | v18 |
| AI 엔진 | Claude Code CLI (`claude -p`) | v2.x |
| PDF 파싱 | pdf-parse | v1.1 |
| HTTP 클라이언트 | axios | v1.7 |

---

## 4. 사전 요구사항

### 필수 소프트웨어

- **Node.js** v18 이상
- **PostgreSQL** 18 (로컬 실행)
- **Claude Code CLI** — Claude.ai Pro 계정으로 로그인된 상태
  ```bash
  npm install -g @anthropic-ai/claude-code
  ```

### Claude.ai 인증 방식

이 프로젝트는 별도의 Anthropic API 키 없이 **Claude.ai Pro 구독 계정**을 그대로 활용합니다.

Claude Code CLI가 설치되면 `~/.claude/.credentials.json`에 OAuth 토큰이 저장됩니다. 백엔드는 이 파일을 통해 Claude CLI를 자동 인증합니다.

```
# 인증 확인 방법
claude -p "안녕"
# 정상 응답이 오면 인증 완료
```

> **주의:** `.credentials.json`은 개인 인증 파일입니다. 절대 외부에 공유하거나 커밋하지 마세요.

---

## 5. 설치 및 환경 설정

### 1) 저장소 클론

```bash
git clone <repository-url>
cd <project-root>
```

### 2) 백엔드 패키지 설치

```bash
cd develop_src/backend
npm install
```

### 3) 프론트엔드 패키지 설치

```bash
cd develop_src/frontend
npm install
```

### 4) 환경 변수 설정

```bash
cd develop_src/backend
cp .env.example .env
```

`.env` 파일을 열어 본인 환경에 맞게 수정합니다:

```env
# Claude.ai Pro 사용 시 불필요 (비워두면 자동으로 Claude CLI 인증 사용)
ANTHROPIC_API_KEY=

# PostgreSQL 연결 정보
DB_HOST=localhost
DB_PORT=5432
DB_NAME=financial_ai
DB_USER=postgres
DB_PASSWORD=your_db_password_here

# 서버 포트 (기본값: 3000)
PORT=3000

# PDF 파일 경로 (기본값: 프로젝트 루트의 data_src 폴더)
# DATA_SRC_PATH=/your/custom/path/to/data_src
```

### 5) PostgreSQL 데이터베이스 생성

```bash
psql -U postgres -c "CREATE DATABASE financial_ai ENCODING='UTF8';"
```

> 테이블은 서버 최초 실행 시 `db/init.sql`에 의해 자동으로 생성됩니다.

### 6) 분석할 PDF 파일 배치

```
project-root/
└── data_src/
    ├── report1.pdf
    ├── report2.pdf
    └── ...
```

---

## 6. 실행 방법

### 백엔드 서버 시작

```bash
cd develop_src/backend
npm start          # 일반 실행
npm run dev        # 파일 변경 감지 자동 재시작
```

서버가 정상 실행되면:
```
데이터베이스 초기화 완료
[Claude] CLI 경로: C:\...\claude.exe
백엔드 서버 실행 중: http://localhost:3000
```

### 프론트엔드 서버 시작

```bash
cd develop_src/frontend
npm run dev
```

### 브라우저 접속

```
http://localhost:5173
```

### PDF 분석 실행

웹 대시보드의 **"PDF 분석 시작"** 버튼 클릭 → `data_src` 폴더의 모든 PDF 자동 분석

---

## 7. 프로젝트 구조

```
project-root/
├── data_src/                        # 분석 대상 PDF 저장 폴더
│   └── *.pdf
│
├── develop_src/
│   ├── backend/
│   │   ├── server.js                # Express 서버 진입점
│   │   ├── .env                     # 환경 변수 (Git 제외)
│   │   ├── .env.example             # 환경 변수 템플릿
│   │   ├── config/
│   │   │   └── database.js          # PostgreSQL 연결 설정
│   │   ├── db/
│   │   │   └── init.sql             # 테이블 DDL (자동 실행)
│   │   ├── routes/
│   │   │   ├── reports.js           # GET /api/reports
│   │   │   └── analyze.js           # POST /api/analyze
│   │   └── services/
│   │       ├── pdfParser.js         # PDF 텍스트 추출
│   │       ├── claudeService.js     # Claude AI 호출 (CLI subprocess)
│   │       └── reportService.js     # DB CRUD
│   │
│   └── frontend/
│       ├── index.html
│       ├── vite.config.js           # Vite 설정 + /api 프록시
│       └── src/
│           ├── main.js
│           ├── App.vue              # 공통 레이아웃 + 전역 스타일
│           ├── router/
│           │   └── index.js
│           └── views/
│               ├── DashboardView.vue  # 통계 카드 + 분석 버튼 + 최근 리포트
│               └── ReportsView.vue   # 전체 목록 + 정렬/필터 + 상세 모달
│
└── README.md
```

---

## 8. 주요 기능 및 화면

### 대시보드 (`/`)

- **통계 카드**: 전체 리포트 수, Buy/Hold/Sell 건수
- **PDF 분석 버튼**: 클릭 시 `data_src` 폴더 전체 일괄 분석 및 결과 표시
- **최근 리포트 카드**: 분석 완료된 최신 6개 리포트 요약 표시

### 리포트 목록 (`/reports`)

- **전체 목록 테이블**: 종목명, 종목코드, 목표주가, 날짜, 의견, 작성자, 증권사
- **컬럼 정렬**: 종목명·목표주가·날짜 기준 오름차순/내림차순 정렬
- **의견 필터**: Buy / Hold / Sell 필터링
- **상세 모달**: 행 클릭 시 핵심 요약 포함 상세 정보 팝업

### 의견 색상 코드

| 의견 | 색상 |
|------|------|
| Buy (매수) | 초록 |
| Hold (중립) | 노랑 |
| Sell (매도) | 빨강 |

---

## 9. API 명세

### `GET /api/health`

서버 상태 확인

**응답**
```json
{ "status": "ok", "timestamp": "2026-05-17T00:00:00.000Z" }
```

---

### `GET /api/reports`

저장된 전체 리포트 목록 조회 (최신순)

**응답**
```json
{
  "success": true,
  "data": [
    {
      "id": 6,
      "filename": "649403.pdf",
      "stock_name": "한국금융지주",
      "stock_code": "071050",
      "target_price": 365000,
      "report_date": "2026-05-14",
      "opinion": "Buy",
      "author": "조아해",
      "securities_firm": "메리츠증권",
      "summary": "...",
      "created_at": "2026-05-16T16:47:20.121Z"
    }
  ]
}
```

---

### `GET /api/reports/:id`

특정 리포트 단건 조회

---

### `POST /api/analyze`

`data_src` 폴더의 PDF 전체 분석 및 DB 저장

**응답**
```json
{
  "success": true,
  "total": 6,
  "succeeded": 5,
  "failed": 1,
  "results": [
    { "file": "649403.pdf", "success": true, "data": { ... } },
    { "file": "invalid.pdf", "success": false, "error": "..." }
  ]
}
```

> 동일 파일명 재분석 시 DB 데이터가 자동으로 업데이트됩니다 (UPSERT).

---

## 10. 데이터베이스 스키마

```sql
CREATE TABLE IF NOT EXISTS reports (
  id              SERIAL PRIMARY KEY,
  filename        VARCHAR(255) NOT NULL UNIQUE,  -- PDF 파일명 (중복 방지 기준)
  stock_name      VARCHAR(100),                  -- 종목명
  stock_code      VARCHAR(20),                   -- 종목코드
  target_price    BIGINT,                        -- 목표주가 (원)
  report_date     DATE,                          -- 리포트 작성일
  opinion         VARCHAR(20),                   -- 투자의견: Buy / Hold / Sell
  author          VARCHAR(100),                  -- 작성 애널리스트
  securities_firm VARCHAR(100),                  -- 증권사명
  summary         TEXT,                          -- AI 요약 (2~3문장)
  created_at      TIMESTAMP DEFAULT NOW()
);
```

---

## 11. AI 분석 흐름

### Claude CLI 호출 방식

별도 API 키 없이 **Claude.ai Pro 계정**을 그대로 사용합니다. 백엔드는 시스템에 설치된 `claude` CLI 실행 파일을 subprocess로 호출합니다.

```
Node.js (analyze.js)
  └─▶ pdfParser.js     : PDF → 텍스트 추출 (pdf-parse)
  └─▶ claudeService.js : claude.exe -p "프롬프트" 실행
                          ↳ stdout에서 JSON 파싱
  └─▶ reportService.js : PostgreSQL UPSERT
```

### Claude 실행 파일 자동 탐색 순서

```javascript
// claudeService.js
const candidates = [
  '%APPDATA%/npm/node_modules/@anthropic-ai/claude-code/bin/claude.exe',  // Windows
  '%APPDATA%/npm/claude.cmd',
  'claude',  // PATH에 등록된 경우
];
```

### AI 추출 프롬프트 구조

```
[시스템 지시]
- 역할: 한국 증권사 리포트 분석 전문 AI
- 출력 형식: JSON 객체만 반환
- opinion 변환 규칙: 매수/BUY → "Buy", 중립/HOLD → "Hold", 비중축소/SELL → "Sell"

[리포트 텍스트]
(PDF에서 추출한 텍스트, 최대 8,500자)
```

---

## 12. 개발 참고사항

### 새 PDF 추가 방법

1. `data_src/` 폴더에 PDF 파일 복사
2. 웹 대시보드에서 **"PDF 분석 시작"** 클릭 (기존 파일은 자동 스킵 없음, 재분석 후 UPSERT)

### PDF 분석 실패 시 확인 사항

- PDF가 텍스트 기반인지 확인 (스캔 이미지 PDF는 텍스트 추출 불가)
- `claude -p "테스트"` 명령으로 CLI 인증 상태 확인
- PostgreSQL 연결 정보 (`.env`) 재확인

### Claude CLI 인증 만료 시

```bash
# Claude Code 재로그인
claude
# 대화형 화면에서 로그인 진행 후 Ctrl+C로 종료
```

### 환경별 PDF 경로 지정

기본값은 프로젝트 루트의 `data_src/` 폴더입니다. 다른 경로를 사용하려면 `.env`에서 설정합니다:

```env
DATA_SRC_PATH=/home/user/reports/pdf
```

### 포트 변경

```env
# 백엔드 포트 변경
PORT=8080

# 프론트엔드 포트 변경 (vite.config.js)
server: { port: 3001 }
```

---

## 라이선스

본 프로젝트는 내부 연구 목적으로 개발되었습니다.

---

*본 README는 함께 연구하는 팀원을 위한 가이드입니다. 문의사항은 프로젝트 담당자에게 연락해주세요.*
