---
name: develop-backend
description: "금융 AI 투자 어드바이저 백엔드(Node.js/Express/PostgreSQL) 기능을 개발하고 디버깅하는 스킬. 백엔드 API 추가, DB 마이그레이션, 서버 오류 수정 요청 시 사용."
---

# Develop Backend — 백엔드 개발

## 워크플로우

### 신규 API 추가
1. `develop_src/backend/routes/{name}.js` 생성
2. `server.js`에 라우터 마운트: `app.use('/api/{path}', router)`
3. 필요 시 `services/reportService.js`에 DB 함수 추가
4. `db/init.sql`에 스키마 변경: `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`

### DB 마이그레이션
```sql
-- 새 컬럼 추가 패턴
ALTER TABLE reports ADD COLUMN IF NOT EXISTS new_col TYPE DEFAULT NULL;
-- init.sql에도 CREATE TABLE에 추가 (새 설치 대비)
```

### 서버 재시작
```powershell
# Windows
Get-Process -Name "node" | Stop-Process -Force
# 이후 bash에서:
cd develop_src/backend && node server.js &
```

### 디버깅
```bash
curl http://localhost:3000/api/health
curl http://localhost:3000/api/reports
cat /tmp/backend.log | tail -20
```

## 핵심 파일 위치
| 파일 | 역할 |
|------|------|
| `server.js` | 진입점, 라우터 마운트 |
| `config/database.js` | PostgreSQL pool 설정 |
| `routes/analyze.js` | PDF 분석 트리거 |
| `routes/reports.js` | 리포트 CRUD + /stock/:code |
| `routes/pdf.js` | PDF 파일 서빙 |
| `services/claudeService.js` | Claude CLI 래퍼 |
| `services/scoreCalculator.js` | 점수 산출 |
| `db/init.sql` | 스키마 |

## 출력 규칙
- 모든 API 응답: `{ success: true|false, data: ..., error: ... }`
- 오류: HTTP 4xx/5xx + 한국어 에러 메시지
- 서버 로그: `/tmp/backend.log`
