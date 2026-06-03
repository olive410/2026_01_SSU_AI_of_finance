---
name: financial-ai-advisor
description: "금융 AI 투자 어드바이저 전체 팀을 조율하는 오케스트레이터 스킬. 시나리오에 따라 적절한 에이전트와 스킬을 조합하여 작업을 완수한다."
---

# Financial AI Advisor — 팀 오케스트레이터

## 에이전트 팀 구성

| 에이전트 | 역할 | 담당 스킬 |
|---------|------|----------|
| `pdf-handler` | PDF 파일 관리 및 텍스트 추출 | `analyze-report` (Step 1-2) |
| `report-analyst` | Claude AI 리포트 분석 | `analyze-report` (Step 3-4) |
| `risk-scorer` | 리스크 점수 및 추천 산출 | `score-report` |
| `consensus-builder` | 종목별 컨센서스 집계 | `build-consensus` |
| `reflection-runner` | AI 반영 및 프롬프트 개선 | `run-reflection` |
| `backend-dev` | Node.js/Express/PostgreSQL | `develop-backend` |
| `frontend-dev` | Vue.js 3 UI | `develop-frontend` |

## 시나리오별 에이전트 구성

### 시나리오 1: 일일 PDF 분석 파이프라인
```
[pdf-handler] → [report-analyst] → [risk-scorer] → DB저장
     ↓                                              ↓
   텍스트 추출          JSON 분석              UPSERT 완료
```
사용 스킬: `analyze-report` → `score-report`

### 시나리오 2: 종목 컨센서스 조회
```
[consensus-builder]: DB 집계 → Claude 질적 요약
```
사용 스킬: `build-consensus`

### 시나리오 3: AI 반영 실행
```
[reflection-runner]: 통계 수집 → Claude 분석 → 힌트 생성
        ↓
[report-analyst]: prompt_hint를 다음 분석에 반영
```
사용 스킬: `run-reflection` → `analyze-report` (개선)

### 시나리오 4: 백엔드 기능 개발
```
[backend-dev]: API 추가 → DB 마이그레이션 → 테스트
```
사용 스킬: `develop-backend`

### 시나리오 5: 프론트엔드 UI 개발
```
[frontend-dev]: 컴포넌트 작성 → API 연동 → 스타일 적용
```
사용 스킬: `develop-frontend`

### 시나리오 6: 전체 시스템 실행/재시작
```
Phase 1 (병렬): 백엔드 시작(3000) + 프론트엔드 시작(5173)
Phase 2: 브라우저 오픈 → http://localhost:5173
```

## 데이터 흐름
```
PDF 파일 (data_src/)
    ↓ pdfParser.js
PDF 텍스트
    ↓ claudeService.js (Claude CLI)
분석 JSON (stock_name, risks[], opinion_analyst...)
    ↓ scoreCalculator.js
scored 객체 (final_score, ai_recommendation, price_gap_pct...)
    ↓ reportService.saveReport()
PostgreSQL reports 테이블
    ↓ /api/reports, /api/consensus, /api/reflection
Vue.js 대시보드 (5173)
```

## 서비스 실행 체크리스트
- [ ] PostgreSQL 실행 중 (포트 5432)
- [ ] `.env` 파일 존재 (DB_PASSWORD, ANTHROPIC_API_KEY 설정)
- [ ] 백엔드 정상: `curl http://localhost:3000/api/health`
- [ ] 프론트엔드 정상: `curl http://localhost:5173`
- [ ] data_src 폴더 존재: `C:\Users\user\ih_dev\ih_dev_01\data_src`

## 주요 환경 정보
- 백엔드: `develop_src/backend/` (Node.js, 포트 3000)
- 프론트엔드: `develop_src/frontend/` (Vue 3 + Vite, 포트 5173)
- DB: PostgreSQL 18 (`financial_ai` 데이터베이스)
- AI: Claude CLI (`C:\Users\user\AppData\Roaming\npm\...claude.exe`)
- git: `C:\Program Files\Git\bin\git.exe` (PATH 미등록, 전체경로 사용)
