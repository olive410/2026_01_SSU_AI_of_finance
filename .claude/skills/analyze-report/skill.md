---
name: analyze-report
description: "PDF 애널리스트 리포트를 Claude AI로 분석하여 종목 정보를 추출하는 스킬. PDF 분석, 리포트 추출, Claude 프롬프트 실행 요청 시 사용."
---

# Analyze Report — 리포트 AI 분석

## 워크플로우

### Step 1: 입력 검증
- `data_src/` 폴더에서 당일 수정(mtime ≥ 오늘 00:00) PDF 파일 필터
- DB에 stock_name이 있는 파일은 스킵 (재분석 불필요)
- stock_name이 null인 기존 레코드 → 재분석 대상 포함

### Step 2: PDF 텍스트 추출
```javascript
// develop_src/backend/services/pdfParser.js
const text = await extractTextFromPdf(filePath)
// 추출 실패 시 → 실패 로그 기록, 다음 파일 진행
```

### Step 3: Claude AI 분석
```javascript
// claudeService.js
const prompt = `${SYSTEM_CONTEXT}\n\n===분석 대상 리포트===\n${text.slice(0, 7500)}`
// claude.exe -p "프롬프트" 서브프로세스 실행
// 응답: extractTopLevelJson(stdout) → JSON 파싱
```

### Step 4: JSON 검증
필수 필드 확인: `stock_name`, `stock_code`, `opinion_analyst`
- null이면 분석 실패로 처리
- stock_code: 6자리 zero-padding 확인

## 도구 사용법
- `Read`: claudeService.js, pdfParser.js 확인
- `Edit`: 프롬프트 수정, extractTopLevelJson 개선
- `Bash`: node server.js 재시작, curl로 /api/analyze 테스트

## 출력 규칙
- 성공: `{ file, success: true, data: saved }`
- 실패: `{ file, success: false, error: 메시지 }`
- 스킵: `{ file, success: true, skipped: true, reason: '기분석 완료' }`
