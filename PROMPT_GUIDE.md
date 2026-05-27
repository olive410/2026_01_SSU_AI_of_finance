# 금융AI 투자 어드바이저 — 프롬프트 작성 가이드 (v2)

> 본 문서는 `develop_src/backend/services/claudeService.js`에서 사용되는 Claude AI 분석 프롬프트의 설계 가이드입니다.
>
> **v2 변경점**: 단일 정보 추출 프롬프트에서 → **리스크 분류 / 점수 산정 / 다중 애널리스트 종합 / KRX 사후검증** 파이프라인으로 확장.

---

## 목차

1. [현재 프롬프트 분석](#1-현재-프롬프트-분석)
2. [프롬프트 설계 원칙](#2-프롬프트-설계-원칙)
3. [확장된 분석 파이프라인 개요](#3-확장된-분석-파이프라인-개요)
4. [권장 프롬프트 — 정보 추출 + 리스크 분류 통합](#4-권장-프롬프트--정보-추출--리스크-분류-통합)
5. [필드별 추출 규칙](#5-필드별-추출-규칙)
6. [리스크 분류 및 점수 산정](#6-리스크-분류-및-점수-산정)
7. [다중 애널리스트 종합 프롬프트 (대시보드용)](#7-다중-애널리스트-종합-프롬프트-대시보드용)
8. [Few-shot 예시](#8-few-shot-예시)
9. [에러 케이스 대응](#9-에러-케이스-대응)
10. [성능 검증 — KRX Open API 연동](#10-성능-검증--krx-open-api-연동)
11. [DB 스키마 확장 제안](#11-db-스키마-확장-제안)
12. [대시보드 필터 / 시각화 지원](#12-대시보드-필터--시각화-지원)
13. [프롬프트 적용 방법](#13-프롬프트-적용-방법)
14. [검증 체크리스트](#14-검증-체크리스트)

---

## 1. 현재 프롬프트 분석

### 현재 사용 중인 프롬프트 (`claudeService.js:21-36`)

```text
당신은 한국 증권사 애널리스트 리포트를 분석하는 전문 AI입니다.
리포트 텍스트에서 아래 정보를 추출하여 반드시 JSON 객체만 반환하세요.

{
  "stock_name", "stock_code", "target_price", "report_date",
  "opinion", "author", "securities_firm", "summary"
}
```

### 한계점

| 문제 | 영향 |
|------|------|
| 위치/단위/정규화 힌트 없음 | 잘못된 숫자를 목표주가로 오인, "16.9만원" 처리 실패 |
| Few-shot 예시 부재 | 마크다운 래핑 / 잡설 포함 응답 |
| **리스크 정보 추출 안 함** | 신뢰도 평가 불가 |
| **점수 기반 의견 산정 없음** | 애널리스트 의견을 그대로 신뢰 |
| **목표가 변화 방향 추적 없음** | 상향/하향/유지 판단 불가 |
| **사후 성과 검증 없음** | 추천 신뢰도 측정 불가 |

---

## 2. 프롬프트 설계 원칙

1. **역할 → 작업 → 출력 스키마 → 추출 규칙 → 제약 → 입력** 순서
2. JSON-only 응답을 강제하는 4중 안전장치
   - 시스템 문구 명시
   - 출력 예시 제공
   - 마크다운 금지 명시
   - 파서가 정규식으로 첫/마지막 JSON만 추출
3. 한국 증권사 표기 관습 정규화 (단위, 날짜 형식, 의견 등급)
4. 모호하면 `null` 반환 — 추측 금지
5. 위치 힌트 제공 (표지 / 책임 고지)

---

## 3. 확장된 분석 파이프라인 개요

```
data_src/*.pdf
   │
   ▼ Stage 1: 텍스트 추출 (pdf-parse, 기존)
   │
   ▼ Stage 2: AI 분석 (claude -p) — 통합 프롬프트
   │   ├─ 기본 정보 추출 (종목/목표가/의견/작성자 등)
   │   ├─ 리스크 문장 발췌 + 유형 분류 (Macro/Industry/Company)
   │   └─ 목표가 변화 방향 추정 (up/flat/down)
   │
   ▼ Stage 3: 백엔드 점수 계산 (코드)
   │   final_score = TP변화점수 + Σ(리스크점수)
   │   opinion_computed = 점수 → Buy/Hold/Sell 매핑
   │
   ▼ Stage 4: DB 저장 (기존 reports 테이블 + 신규 컬럼)
   │
   ▼ Stage 5: KRX Open API 사후 검증
   │   판단일 D → D+5 종가 증감률 계산 → verification 테이블에 저장
   │
   ▼ Stage 6: 대시보드 시각화
       ├─ 필터: 종목 / 일자 / 의견
       └─ 종목별 다중 애널리스트 종합 보기
```

**핵심 설계 결정**: 리스크 분류는 **별도 호출이 아닌, 정보 추출 프롬프트 안에 통합**합니다. Claude CLI subprocess는 호출당 비용/지연이 크므로 1 PDF = 1 호출을 유지하는 것이 효율적입니다.

---

## 4. 권장 프롬프트 — 정보 추출 + 리스크 분류 통합

`develop_src/backend/services/claudeService.js`의 `SYSTEM_CONTEXT`를 다음으로 교체합니다.

```text
당신은 한국 증권사 애널리스트 리포트를 분석하는 전문 AI입니다.
아래 리포트 텍스트를 읽고 핵심 정보를 추출하여 **단일 JSON 객체**만 반환하세요.

# 출력 스키마 (필수)
{
  "stock_name": "종목명(한국어 정식 명칭)",
  "stock_code": "6자리 종목코드 문자열 (예: \"005930\")",
  "target_price": 정수(원 단위, 콤마 없음, 예: 169000),
  "previous_target_price": 직전 목표주가 정수 또는 null,
  "target_price_change": "up" | "flat" | "down" | null,
  "report_date": "YYYY-MM-DD",
  "opinion_analyst": "Buy" | "Hold" | "Sell",
  "author": "작성 애널리스트 이름",
  "securities_firm": "발행 증권사명",
  "summary": "투자 포인트 2~3문장 한국어 요약",
  "risks": [
    {
      "type": "Macro" | "Industry" | "Company",
      "sentence": "리포트에서 발췌한 원문 (50자 이내)"
    }
  ]
}

# 위치 힌트
- stock_name/stock_code/target_price/opinion_analyst: 리포트 첫 페이지 표지
- author/securities_firm: 표지 또는 마지막 페이지 책임 고지
- report_date: 표지의 발간일/작성일 (공시일 아님)
- risks: 본문 전체에서 발췌 — "리스크 요인", "투자 위험", "단점", "우려" 섹션 우선

# 정규화 규칙
1. target_price
   - "16.9만원" → 169000, "169,000원" → 169000, "169천원" → 169000
   - 범위(150,000~170,000) → 상단값 사용
2. previous_target_price / target_price_change
   - "TP 16.9만원 → 19만원" 패턴 발견 시:
     previous_target_price=169000, target_price=190000, change="up"
   - "유지", "Maintain"이면서 직전값 명시 없음: change="flat"
   - 명시 정보 없으면 둘 다 null
3. opinion_analyst (대소문자 무관)
   - 매수/BUY/Buy/비중확대/Overweight/Strong Buy → "Buy"
   - 중립/HOLD/Hold/Neutral/Marketperform → "Hold"
   - 매도/SELL/Sell/비중축소/Underweight/Reduce → "Sell"
4. report_date
   - "2026/05/14", "2026.5.14", "26-05-14" → "2026-05-14"
5. stock_code
   - 6자리 zero-padding ("5930" → "005930")

# 리스크 분류 기준
- Macro (거시경제): 금리, 환율, 인플레이션, 경기침체, 지정학, 원자재가, 정책/규제 등 시장 전체 영향
- Industry (산업): 업황 둔화, 경쟁 심화, 기술 변화, 공급망, 산업 사이클 등 해당 산업 한정
- Company (기업): 실적 부진, 비용 증가, 경영진/지배구조, 소송, 특정 사업부 문제 등 기업 내부

# 리스크 추출 규칙
- 본문에서 리스크/우려/단점/주의/위험 관련 문장만 추출
- 최대 5개까지 — 중요도 순
- 호재/긍정 문장은 제외
- 동일 유형 중복 시 가장 구체적인 1개만 유지
- 리스크가 명시되지 않은 리포트면 빈 배열 []

# 절대 금지
- 마크다운 코드블럭(```)으로 감싸지 마세요
- 설명, 인사말, 접두어("분석 결과:") 금지
- 추측 금지: 명시되지 않은 항목은 null
- 여러 종목 비교 리포트면 표지 대표 종목 1개만

# 출력 예시
{"stock_name":"한국금융지주","stock_code":"071050","target_price":365000,"previous_target_price":340000,"target_price_change":"up","report_date":"2026-05-14","opinion_analyst":"Buy","author":"조아해","securities_firm":"메리츠증권","summary":"2026년 실적 호조와 카카오뱅크 가치 재평가로 목표가 상향. 다만 금리 인하 시 NIM 축소 가능성 존재.","risks":[{"type":"Macro","sentence":"기준금리 인하 시 순이자마진 축소 우려"},{"type":"Industry","sentence":"증권업 위탁수수료 경쟁 심화"},{"type":"Company","sentence":"부동산 PF 익스포저 관련 충당금 증가 가능"}]}
```

> **점수 계산은 백엔드 코드에서 수행**합니다. AI에게 점수까지 시키면 환각으로 인한 계산 오류 위험이 큽니다. AI는 "분류"만, 점수는 "코드"가 담당.

---

## 5. 필드별 추출 규칙

### 5.1 `stock_name` / `stock_code`
- 한국어 정식 명칭. 우선주는 "삼성전자우" 유지
- stock_code는 항상 6자리 문자열 (zero-padding)

### 5.2 `target_price` / `previous_target_price` / `target_price_change`
- 모두 원 단위 정수 또는 null
- `target_price_change`는 백엔드 검증용 보조 필드
  - 신규 발견 시(처음 분석되는 종목) "flat"으로 간주
  - DB에 이전 분석 결과가 있으면 백엔드에서 재계산 가능

### 5.3 `report_date`
- `YYYY-MM-DD` 문자열
- 표지의 발간일 1순위, 공시일/기준일과 구분

### 5.4 `opinion_analyst`
- **애널리스트가 명시한 원본 의견**
- 점수 기반 계산 의견(`opinion_computed`)은 백엔드에서 별도 생성 → DB에 두 컬럼 모두 저장

### 5.5 `risks` 배열
- 0~5개
- 각 항목: `{type, sentence}`
- `type`은 정확히 `Macro` / `Industry` / `Company` 셋 중 하나
- `sentence`는 원문 발췌 (50자 이내, 윤문 금지)

### 5.6 `summary`
- 2~3문장, 100~200자
- 핵심 투자 포인트 + 리스크 1개 포함 권장

---

## 6. 리스크 분류 및 점수 산정

### 6.1 채점 표

| 항목 | 점수 |
|------|-----:|
| Macro 리스크 1건 | −1 |
| Industry 리스크 1건 | −2 |
| Company 리스크 1건 | −2 |
| 목표가 상향 (`up`) | +2 |
| 목표가 유지 (`flat`) |  0 |
| 목표가 하향 (`down`) | −2 |

### 6.2 최종 점수 공식

```
final_score = tp_change_score + Σ(risk_type_score for each risk)
```

### 6.3 점수 → 의견 매핑 (제안 임계값, 튜닝 필요)

| `final_score` 범위 | `opinion_computed` |
|---:|---|
| ≥ +1 | Buy |
| −3 ≤ score ≤ 0 | Hold |
| ≤ −4 | Sell |

> 임계값은 초기 PDF 샘플 30~50건으로 실험 후 조정합니다.
> "애널리스트 의견 vs 계산 의견 불일치율"을 모니터링하여 보정.

### 6.4 백엔드 점수 계산 구현 위치

`develop_src/backend/services/` 에 신규 파일 추가 권장:

```javascript
// services/scoreCalculator.js
const RISK_SCORE = { Macro: -1, Industry: -2, Company: -2 };
const TP_SCORE   = { up: 2, flat: 0, down: -2 };

function calculateScore(analysis) {
  const tp = TP_SCORE[analysis.target_price_change] ?? 0;
  const risk = (analysis.risks || []).reduce(
    (sum, r) => sum + (RISK_SCORE[r.type] ?? 0), 0
  );
  const score = tp + risk;

  let opinion_computed;
  if (score >= 1)         opinion_computed = 'Buy';
  else if (score >= -3)   opinion_computed = 'Hold';
  else                    opinion_computed = 'Sell';

  return { score, opinion_computed };
}

module.exports = { calculateScore };
```

이후 `routes/analyze.js`에서 AI 분석 결과에 점수를 덧붙여 저장합니다.

```javascript
const analysis = await analyzeReport(text);
const { score, opinion_computed } = calculateScore(analysis);
const saved = await saveReport(file, { ...analysis, score, opinion_computed });
```

---

## 7. 다중 애널리스트 종합 프롬프트 (대시보드용)

같은 종목에 대해 여러 증권사 리포트가 쌓이면, 대시보드에서 **종합 의견**을 제공합니다.

### 7.1 데이터 수집 (DB 조회)

```sql
SELECT securities_firm, author, report_date, opinion_analyst,
       opinion_computed, target_price, score, summary, risks
FROM reports
WHERE stock_code = $1
  AND report_date >= NOW() - INTERVAL '90 days'
ORDER BY report_date DESC;
```

### 7.2 종합 프롬프트

```text
당신은 여러 증권사 애널리스트 리포트를 종합 분석하는 전문 AI입니다.
아래는 동일 종목에 대한 최근 N건의 리포트입니다.

# 입력 데이터 (JSON 배열)
[
  {"securities_firm":"메리츠증권","author":"조아해","report_date":"2026-05-14",
   "opinion":"Buy","target_price":365000,"score":2,"summary":"..."},
  ...
]

# 작업
다음 형식의 JSON으로 종합 의견을 반환하세요.

{
  "stock_name": "종목명",
  "stock_code": "6자리",
  "report_count": 정수,
  "buy_count": 정수,
  "hold_count": 정수,
  "sell_count": 정수,
  "avg_target_price": 정수(원),
  "max_target_price": 정수,
  "min_target_price": 정수,
  "avg_score": 소수점 둘째자리,
  "consensus": "Buy" | "Hold" | "Sell" | "Mixed",
  "common_risks": ["여러 리포트에서 공통적으로 언급된 리스크 2~3개"],
  "divergence": "의견이 갈리는 핵심 쟁점 1~2문장 (없으면 null)",
  "synthesized_summary": "전체 종합 요약 3~4문장 한국어"
}

# 합의 판정 규칙
- consensus는 단순 다수결이 아닌, opinion_computed 기준 비율로 판단:
  - Buy 비율 ≥ 60% → "Buy"
  - Sell 비율 ≥ 60% → "Sell"
  - Hold 비율 ≥ 60% 또는 Buy/Sell 모두 40% 미만 → "Hold"
  - Buy 30~60% AND Sell 30~60% (의견 분산) → "Mixed"

# 절대 금지
- 마크다운 래핑 금지
- 입력에 없는 정보 추측 금지
- 통계 값은 정확히 계산 (Claude가 헷갈리면 백엔드에서 별도 계산해도 됨)
```

> **권장 분리**: 통계 값(평균/최대/최소/카운트)은 **SQL/JS로 계산**, AI는 `consensus`, `common_risks`, `divergence`, `synthesized_summary`만 생성하도록 분리하는 것이 더 안정적입니다.

### 7.3 분리 버전 (권장)

```javascript
// services/consensusService.js
async function buildConsensus(stockCode) {
  const reports = await getRecentReportsByStock(stockCode);

  // 1. 통계는 코드로
  const stats = {
    report_count: reports.length,
    buy_count: reports.filter(r => r.opinion_computed === 'Buy').length,
    hold_count: reports.filter(r => r.opinion_computed === 'Hold').length,
    sell_count: reports.filter(r => r.opinion_computed === 'Sell').length,
    avg_target_price: avg(reports.map(r => r.target_price)),
    max_target_price: Math.max(...reports.map(r => r.target_price)),
    min_target_price: Math.min(...reports.map(r => r.target_price)),
    avg_score: avg(reports.map(r => r.score)),
  };

  // 2. consensus 라벨은 코드로
  stats.consensus = decideConsensus(stats);

  // 3. 정성적 요약만 AI로
  const qualitative = await callClaudeForSynthesis(reports, stats);

  return { ...stats, ...qualitative };
}
```

AI에게는 `common_risks`, `divergence`, `synthesized_summary` 3개 필드만 생성하도록 좁힌 짧은 프롬프트를 보냅니다 — 비용/오류 모두 감소.

---

## 8. Few-shot 예시

토큰 예산이 허락하면 §4 프롬프트 끝에 2~3개의 입출력 예시를 추가합니다.

```text
# 예시 1
[입력 발췌]
"한국금융지주 (071050)
목표주가 365,000원 (340,000원 → 상향)
투자의견 Buy (유지)
2026.05.14 / 메리츠증권 조아해
... 다만 기준금리 인하 시 NIM 축소 우려 존재. 증권업 경쟁 심화..."

[출력]
{"stock_name":"한국금융지주","stock_code":"071050",...,"risks":[{"type":"Macro","sentence":"금리 인하 시 NIM 축소"},{"type":"Industry","sentence":"증권업 경쟁 심화"}]}

# 예시 2 — 신규 커버리지 (직전 목표가 없음)
[입력] "TP 신규 산정 19만원, BUY 의견 개시"
[출력 발췌] {"target_price":190000,"previous_target_price":null,"target_price_change":null,...}
```

> 현재 입력 한도가 8,500자(`claudeService.js:39`)이므로, Few-shot 추가 시 7,500자로 축소 권장.

---

## 9. 에러 케이스 대응

| 케이스 | 대응 |
|--------|------|
| 스캔 PDF (텍스트 추출 실패) | 백엔드에서 명시 에러, AI 호출 안 함 |
| 텍스트 200자 미만 | 모든 필드 null + `risks: []` 응답 강제 |
| 다중 종목 비교 리포트 | 표지 대표 종목 1개만 |
| 영어 리포트 | stock_name은 한국어로 매핑, summary는 한국어로 작성 |
| 리스크 섹션 부재 | `risks: []` (점수 계산 시 리스크 점수 0) |

응답 파서 강화 — Few-shot 추가 시:

```javascript
// claudeService.js: 마지막 JSON 매칭으로 변경 (예시 JSON 오인 방지)
const matches = stdout.match(/\{[\s\S]*?\}/g);
if (!matches) return reject(new Error('JSON 없음'));
resolve(JSON.parse(matches[matches.length - 1]));
```

---

## 10. 성능 검증 — KRX Open API 연동

### 10.1 검증 가설

> "리포트 작성일(D) 기준 5거래일 후(D+5) 종가 증감률을 측정하여 AI/애널리스트 판단의 사후 신뢰도를 평가한다."

### 10.2 KRX 데이터 소스

- **API**: KRX Open API — 유가증권 일별매매정보
- **URL**: https://openapi.krx.co.kr/contents/OPP/USES/service/OPPUSES002_S2.cmd?BO_ID=JvJFzlAENzZlPBDNGAWC
- **주요 필드**:
  - `BAS_DD`: 기준일자 (YYYYMMDD)
  - `ISU_CD` / `ISU_SRT_CD`: 종목 단축 코드 (6자리) — `reports.stock_code`와 직접 매핑 가능
  - `ISU_NM`: 종목명
  - `TDD_CLSPRC`: 종가
  - `FLUC_RT`: 등락률

> **매핑 가능성**: 우리 DB의 `stock_code`(6자리 zero-padded)와 KRX의 `ISU_SRT_CD`(단축코드 6자리)가 동일 형식이라 **1:1 매핑 가능**합니다. 우선주(예: 005935)도 동일 체계입니다.

### 10.3 검증 데이터 파이프라인

```
1. reports 테이블에서 report_date가 D+5 거래일 이전인 리포트 조회
2. 각 종목의 D 종가 / D+5 거래일 종가 조회 (KRX API)
3. 증감률 = (close_d5 - close_d0) / close_d0 × 100
4. verification 테이블에 저장
5. 대시보드에서 의견별 평균 수익률 / 적중률 표시
```

> "D+5 거래일"은 휴일 보정 필수 — 영업일 기준으로 셉니다. KRX API 응답에서 `BAS_DD`가 있는 행만 영업일이므로, D 이후 5개 행을 카운트하는 방식이 안전합니다.

### 10.4 검증 테이블 스키마 (제안)

```sql
CREATE TABLE IF NOT EXISTS report_verifications (
  id              SERIAL PRIMARY KEY,
  report_id       INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  d0_date         DATE NOT NULL,       -- 판단일(영업일 보정)
  d0_close        BIGINT,              -- D 종가
  d5_date         DATE,                -- D+5 거래일
  d5_close        BIGINT,              -- D+5 종가
  return_pct      NUMERIC(8, 4),       -- 증감률 (%)
  hit             BOOLEAN,             -- Buy & return>0, Sell & return<0 → true
  verified_at     TIMESTAMP DEFAULT NOW(),
  UNIQUE(report_id)
);
```

### 10.5 적중률 계산 SQL

```sql
SELECT
  r.opinion_computed,
  COUNT(*) AS n,
  AVG(v.return_pct) AS avg_return,
  AVG(CASE WHEN v.hit THEN 1 ELSE 0 END) * 100 AS hit_rate_pct
FROM reports r
JOIN report_verifications v ON v.report_id = r.id
WHERE v.d5_close IS NOT NULL
GROUP BY r.opinion_computed;
```

> 프롬프트와 무관한 단계이지만, **AI 추출 정확도 → 점수 모델 정합도 → 사후 적중률**이라는 검증 사이클을 완성하는 핵심 단계입니다.

---

## 11. DB 스키마 확장 제안

기존 `reports` 테이블에 컬럼을 추가합니다.

```sql
ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS previous_target_price  BIGINT,
  ADD COLUMN IF NOT EXISTS target_price_change    VARCHAR(10),   -- 'up'/'flat'/'down'
  ADD COLUMN IF NOT EXISTS opinion_analyst        VARCHAR(20),   -- AI 추출한 원본 의견
  ADD COLUMN IF NOT EXISTS opinion_computed       VARCHAR(20),   -- 점수 기반 계산 의견
  ADD COLUMN IF NOT EXISTS score                  INTEGER;       -- 최종 점수

-- 기존 opinion 컬럼은 opinion_analyst로 마이그레이션
UPDATE reports SET opinion_analyst = opinion WHERE opinion_analyst IS NULL;
```

리스크는 별도 테이블로 정규화하는 것이 권장입니다 — 1 리포트 N 리스크 관계이고, 유형별 집계가 잦기 때문.

```sql
CREATE TABLE IF NOT EXISTS report_risks (
  id          SERIAL PRIMARY KEY,
  report_id   INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  risk_type   VARCHAR(20) NOT NULL CHECK (risk_type IN ('Macro','Industry','Company')),
  sentence    TEXT,
  created_at  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_report_risks_report_id ON report_risks(report_id);
CREATE INDEX IF NOT EXISTS idx_report_risks_type ON report_risks(risk_type);
```

> 기존 init.sql은 자동 실행되므로, ALTER 문은 `db/migrations/001_add_risk_score.sql` 형태로 분리해 별도 실행 또는 `init.sql`에 IF NOT EXISTS 패턴으로 추가하는 것이 안전합니다.

---

## 12. 대시보드 필터 / 시각화 지원

### 12.1 필터 API 확장 제안

`GET /api/reports` 에 쿼리 파라미터 추가:

```
?stock_code=005930
&date_from=2026-04-01
&date_to=2026-05-23
&opinion=Buy           # opinion_computed 기준
&securities_firm=메리츠증권
&min_score=0
```

### 12.2 종목별 종합 뷰 API (신규)

```
GET /api/consensus/:stock_code
```

응답: §7.3에서 정의한 종합 객체.

### 12.3 적중률 뷰 API (신규)

```
GET /api/performance?opinion=Buy&days=5
```

응답:
```json
{
  "opinion": "Buy",
  "horizon_days": 5,
  "sample_size": 42,
  "avg_return_pct": 1.84,
  "hit_rate_pct": 64.3
}
```

### 12.4 프론트엔드 화면 추가

| 화면 | 내용 |
|------|------|
| `/reports` 필터 패널 | 종목/기간/의견/증권사/최소점수 |
| `/consensus/:stock_code` | 종목 종합 뷰 — 의견 분포, 공통 리스크, 통합 요약 |
| `/performance` | 점수 구간별 적중률 그래프 |

---

## 13. 프롬프트 적용 방법

### 13.1 코드 수정 순서

1. `develop_src/backend/services/claudeService.js`의 `SYSTEM_CONTEXT`를 §4 프롬프트로 교체
2. `services/scoreCalculator.js` 신규 작성 (§6.4)
3. `services/reportService.js`에 신규 컬럼 처리 추가
4. `routes/analyze.js`에서 점수 계산 호출 및 risks 저장 추가
5. `db/init.sql`에 ALTER 문 / 신규 테이블 IF NOT EXISTS 추가
6. (선택) `services/consensusService.js` 신규 작성 (§7.3)
7. (선택) `services/krxVerificationService.js` 신규 작성 (§10)

### 13.2 입력 한도 조정

```javascript
// claudeService.js 변경
const MAX_INPUT_CHARS = 7500;  // Few-shot 추가 시 8500 → 7500
const prompt = `${SYSTEM_CONTEXT}\n\n===분석 대상 리포트===\n${pdfText.slice(0, MAX_INPUT_CHARS)}`;
```

### 13.3 응답 파서 강화

```javascript
const matches = stdout.match(/\{[\s\S]*?\}/g);
if (!matches) return reject(new Error('JSON 없음'));
resolve(JSON.parse(matches[matches.length - 1]));
```

---

## 14. 검증 체크리스트

### 14.1 추출 정확도

- [ ] PDF 30건 이상 분석 후 필드별 null 비율 측정
- [ ] `opinion_analyst` 값이 정확히 Buy/Hold/Sell 셋 중 하나
- [ ] `risks[].type` 값이 정확히 Macro/Industry/Company 셋 중 하나
- [ ] `target_price`가 모두 원 단위 정수

### 14.2 점수 모델 정합도

- [ ] `opinion_analyst` vs `opinion_computed` 일치율 측정
- [ ] 불일치 케이스 샘플 검토 → 임계값 튜닝
- [ ] 동일 PDF 재분석 시 동일 점수 (재현성)

### 14.3 사후 성과 검증 (KRX 연동 후)

- [ ] `opinion_computed = Buy`인 리포트의 평균 D+5 수익률
- [ ] 점수 구간별 적중률 (score ≥ 2 / 0~1 / 음수)
- [ ] 애널리스트 의견 적중률 vs AI 계산 의견 적중률 비교

### 14.4 SQL 점검 쿼리

```sql
-- 분류값 일관성
SELECT DISTINCT opinion_analyst, opinion_computed FROM reports;
SELECT DISTINCT risk_type FROM report_risks;

-- null 비율
SELECT
  COUNT(*) FILTER (WHERE stock_code IS NULL)::float / COUNT(*) AS null_code_pct,
  COUNT(*) FILTER (WHERE target_price IS NULL)::float / COUNT(*) AS null_price_pct,
  COUNT(*) FILTER (WHERE score IS NULL)::float / COUNT(*) AS null_score_pct
FROM reports;

-- 점수 분포
SELECT score, COUNT(*) FROM reports GROUP BY score ORDER BY score;

-- 의견 일치율
SELECT
  COUNT(*) FILTER (WHERE opinion_analyst = opinion_computed)::float / COUNT(*) AS match_rate
FROM reports
WHERE opinion_analyst IS NOT NULL AND opinion_computed IS NOT NULL;
```

---

## 참고 파일

- 시스템 프롬프트: `develop_src/backend/services/claudeService.js:21-36`
- AI 호출 방식: Claude Code CLI subprocess (`claude -p`)
- 입력 한도: 현재 8,500자 (`claudeService.js:39`) → 권장 7,500자
- 응답 타임아웃: 90초 (`claudeService.js:51`)
- DB 스키마: `develop_src/backend/db/init.sql`
- 라우트: `routes/analyze.js`, `routes/reports.js`

---

## 부록 A — 리스크 분류 단독 프롬프트 (참고)

§4 통합 프롬프트가 신뢰성이 떨어진다면 분류만 별도 호출하는 대안:

```text
다음 문장을 아래 기준 중 하나로 분류하시오. JSON 객체 {"type": "..."}만 반환.

1. Macro (거시경제 리스크): 금리, 환율, 경기침체 등 시장 전체 리스크
2. Industry (산업 리스크): 업황 둔화, 경쟁 심화 등 산업 관련 리스크
3. Company (기업 리스크): 실적 감소, 비용 증가 등 기업 내부 리스크

문장: "{sentence}"
```

> 단, PDF 1건당 N+1회 Claude 호출이 되므로 비용/지연 증가. 통합 프롬프트가 안정화될 때까지의 임시 폴백 용도로만 권장.
