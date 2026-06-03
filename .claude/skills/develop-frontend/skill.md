---
name: develop-frontend
description: "금융 AI 투자 어드바이저 프론트엔드(Vue.js 3/Vite) UI를 개발하고 디버깅하는 스킬. UI 기능 추가, 스타일 수정, 컴포넌트 개선, 화면 오류 수정 요청 시 사용."
---

# Develop Frontend — 프론트엔드 개발

## 워크플로우

### 신규 뷰/컴포넌트 추가
1. `src/views/{Name}View.vue` 생성
2. `src/router/index.js`에 라우트 추가
3. `src/App.vue` 네비게이션에 `<router-link>` 추가

### API 연동 패턴
```javascript
import axios from 'axios'
const data = ref([])
async function fetchData() {
  const res = await axios.get('/api/endpoint')
  data.value = res.data.data || []
}
onMounted(fetchData)
```

### Chart.js 차트 추가
```javascript
import Chart from 'chart.js/auto'
const canvasRef = ref(null)
let chartInstance = null
// nextTick() 후 new Chart(canvasRef.value, config)
// 닫을 때: chartInstance.destroy()
```

### 서버 재시작
```bash
# 5173 포트 프로세스 종료 후:
npm run dev -- --port 5173
```

## 핵심 UI 규칙
| 항목 | 값 |
|------|-----|
| 주색 | `#e94560` (버튼, 강조) |
| 배경 | `#1a1a2e` (헤더), `#f0f2f5` (본문) |
| 배지 Buy | `background: #d4edda; color: #155724` |
| 배지 Hold | `background: #fff3cd; color: #856404` |
| 배지 Sell | `background: #f8d7da; color: #721c24` |
| 모달 최대폭 | 580px (일반), 720px (차트) |

## Vite 프록시
`vite.config.js`: `/api` → `http://localhost:3000`
프론트에서 `/api/...` 호출 시 자동으로 백엔드 포워딩

## 출력 규칙
- 빈 상태: `<div class="empty-text">메시지</div>`
- 로딩: `<div class="loading-text">로딩 중...</div>`
- 에러: `<div class="error-box">{{ error }}</div>`
- 변경 후 Vite HMR 자동 반영 (재시작 불필요)
