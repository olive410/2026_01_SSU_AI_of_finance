---
name: score-report
description: "리포트 분석 결과에서 리스크 점수를 산출하고 AI 투자 추천을 결정하는 스킬. 스코어 계산, 리스크 분류, Buy/Hold/Sell 결정 요청 시 사용."
---

# Score Report — 리스크 점수 산출

## 워크플로우

### Step 1: 목표가 변화 점수
```javascript
const TP_SCORE = { up: 2, flat: 0, down: -2 }
const opinion_score = TP_SCORE[analysis.target_price_change] ?? 0
```

### Step 2: 리스크 점수
```javascript
const RISK_SCORE = { Macro: -1, Industry: -2, Company: -2 }
const risk_score = (analysis.risks || [])
  .reduce((sum, r) => sum + (RISK_SCORE[r.type] ?? 0), 0)
```

### Step 3: 최종 점수 → 추천
```javascript
const score = opinion_score + risk_score
const ai_recommendation =
  score >= 1  ? 'Buy' :
  score >= -3 ? 'Hold' : 'Sell'
```

### Step 4: 괴리율 계산
```javascript
const gap = target_price && current_price
  ? ((target_price - current_price) / current_price * 100).toFixed(2)
  : null
// gap_interpretation: ≥20%→강한 매수, 10~20%→적정, 0~10%→제한적, <0%→하락위험
```

### Step 5: DB 저장
- `reports` 테이블 UPSERT (ON CONFLICT filename)
- `report_risks` 테이블: DELETE 후 재삽입

## 도구 사용법
- `Read`: scoreCalculator.js 확인
- `Edit`: 점수 기준 수정 시 RISK_SCORE, TP_SCORE 상수 변경

## 출력 규칙
scoreCalculator.js의 `calculateScore()` 반환값:
`{ score, opinion_computed, final_score, ai_recommendation, risk_types, risk_score, opinion_score, price_gap_pct, gap_interpretation }`
