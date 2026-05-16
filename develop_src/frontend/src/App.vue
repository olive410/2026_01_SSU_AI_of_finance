<template>
  <div id="app">
    <header class="header">
      <div class="header-inner">
        <div class="logo">
          <span class="logo-icon">AI</span>
          <div>
            <div class="logo-title">금융AI 투자 어드바이저</div>
            <div class="logo-sub">애널리스트 리포트 기반 투자 판단 시스템</div>
          </div>
        </div>
      </div>
    </header>

    <nav class="nav">
      <div class="nav-inner">
        <router-link to="/" class="nav-link">대시보드</router-link>
        <router-link to="/reports" class="nav-link">리포트 목록</router-link>
      </div>
    </nav>

    <main class="main">
      <router-view />
    </main>
  </div>
</template>

<style>
* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: 'Noto Sans KR', -apple-system, BlinkMacSystemFont, sans-serif;
  background: #f0f2f5;
  color: #1a1a2e;
  min-height: 100vh;
}

.header {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  color: white;
  padding: 0 24px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.3);
}
.header-inner {
  max-width: 1280px;
  margin: 0 auto;
  padding: 16px 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.logo { display: flex; align-items: center; gap: 14px; }
.logo-icon {
  width: 44px; height: 44px;
  background: #e94560;
  border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 15px; letter-spacing: 0.5px;
}
.logo-title { font-size: 18px; font-weight: 700; }
.logo-sub { font-size: 12px; color: rgba(255,255,255,0.6); margin-top: 2px; }

.nav {
  background: #16213e;
  border-bottom: 1px solid rgba(255,255,255,0.08);
}
.nav-inner {
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 24px;
  display: flex;
  gap: 4px;
}
.nav-link {
  color: rgba(255,255,255,0.55);
  text-decoration: none;
  padding: 13px 18px;
  font-size: 14px;
  font-weight: 500;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
}
.nav-link:hover { color: rgba(255,255,255,0.85); }
.nav-link.router-link-active {
  color: #fff;
  border-bottom-color: #e94560;
}

.main {
  max-width: 1280px;
  margin: 0 auto;
  padding: 28px 24px;
}

/* 공통 카드 */
.card {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.08);
  padding: 24px;
}

/* 공통 버튼 */
.btn {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 10px 20px;
  border: none; border-radius: 8px;
  font-size: 14px; font-weight: 600;
  cursor: pointer; transition: all 0.2s;
}
.btn-primary {
  background: #e94560; color: #fff;
}
.btn-primary:hover:not(:disabled) { background: #d03a52; }
.btn-primary:disabled { background: #c1c7cd; cursor: not-allowed; }

/* 의견 배지 */
.badge {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 20px;
  font-size: 12px; font-weight: 700;
}
.badge-buy   { background: #d4edda; color: #155724; }
.badge-hold  { background: #fff3cd; color: #856404; }
.badge-sell  { background: #f8d7da; color: #721c24; }
.badge-null  { background: #e9ecef; color: #6c757d; }
</style>
