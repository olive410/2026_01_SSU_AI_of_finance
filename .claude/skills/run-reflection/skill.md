---
name: run-reflection
description: "AI 반영을 실행하여 투자 판단 패턴의 편향을 발견하고 프롬프트 개선 힌트를 생성하는 스킬. AI 반영 실행, 적중률 분석, 프롬프트 개선 요청 시 사용."
---

# Run Reflection — AI 반영 실행

## 워크플로우

### Step 1: 모드 자동 선택
```javascript
const verifiedCount = await getVerifiedCount()
const mode = verifiedCount >= 5 ? 'verified' : 'preliminary'
```

### Step 2-A: preliminary 모드 (검증 데이터 부족)
- `getAllReportStats()`: 전체 리포트 통계
- `getMismatchSamples()`: 애널리스트 vs AI 의견 불일치 샘플
- Claude 분석: 불일치 패턴, 편향 유형 식별
- `opinion_match_rate` 계산

### Step 2-B: verified 모드 (KRX D+5 수익률 기반)
- `report_verifications` 테이블에서 D+5 수익률 조회
- Buy/Hold/Sell 별 적중률 계산 (수익률 > 0 = 적중)
- Claude 분석: 의견 유형별 성과 분석

### Step 3: 반영 결과 생성
Claude 출력 JSON:
```json
{
  "reflection": "패턴 분석 텍스트",
  "bias_found": "발견된 편향",
  "adjustment_suggestions": ["제안1", "제안2", "제안3"],
  "prompt_hint": "다음 분석 시 적용할 프롬프트 개선 힌트"
}
```

### Step 4: DB 저장
`reflection_logs` 테이블에 저장: `saveReflection(mode, stats, result)`

## 도구 사용법
- `Bash`: `curl -X POST http://localhost:3000/api/reflection/run` 실행
- `Read`: reflectionService.js 확인
- `Edit`: 반영 프롬프트 또는 모드 임계값 수정

## 출력 규칙
- 성공: 반영 결과 객체 반환 + DB 저장
- 실패: 오류 메시지 (Claude 응답 없음, DB 오류 등)
- `prompt_hint`는 다음 `analyze-report` 실행 시 claudeService.js에 반영 검토
