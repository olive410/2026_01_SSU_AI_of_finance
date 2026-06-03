---
name: build-consensus
description: "종목별 다중 리포트를 집계하여 컨센서스를 산출하는 스킬. 컨센서스 조회, 종목 종합 의견, 다중 애널리스트 분석 요청 시 사용."
---

# Build Consensus — 컨센서스 분석

## 워크플로우

### Step 1: 종목 리포트 수집
```javascript
// reportService.getRecentReportsByStock(stockCode, 90)
// 최근 90일 리포트 조회
```

### Step 2: 통계 집계 (JS 직접 계산)
```javascript
const total = reports.length
const buy  = reports.filter(r => r.ai_recommendation === 'Buy').length
const sell = reports.filter(r => r.ai_recommendation === 'Sell').length
const buyPct  = (buy  / total * 100).toFixed(1)
const sellPct = (sell / total * 100).toFixed(1)
```

### Step 3: 컨센서스 결정
```javascript
// decideConsensus(stats)
if (buyPct >= 60)  return 'Buy'
if (sellPct >= 60) return 'Sell'
if (buyPct >= 30 && sellPct >= 30) return 'Mixed'
return 'Hold'
```

### Step 4: Claude 질적 요약 (선택)
- 공통 리스크, 의견 분기점, 종합 요약 생성
- `callClaudeForSynthesis()` 호출

## 도구 사용법
- `Bash`: `curl http://localhost:3000/api/consensus/{stock_code}` 테스트
- `Read`: consensusService.js 확인
- `Edit`: 컨센서스 임계값 조정

## 출력 규칙
```json
{
  "consensus": "Buy"|"Hold"|"Sell"|"Mixed",
  "report_count": N,
  "buy_pct": N, "hold_pct": N, "sell_pct": N,
  "avg_gap_pct": N|null,
  "qualitative": { "common_risks", "divergence", "synthesized_summary" }
}
```
