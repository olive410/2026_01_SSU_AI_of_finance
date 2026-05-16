<template>
  <div>
    <!-- 상단 통계 카드 -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">전체 리포트</div>
        <div class="stat-value">{{ stats.total }}</div>
      </div>
      <div class="stat-card buy">
        <div class="stat-label">매수 (Buy)</div>
        <div class="stat-value">{{ stats.buy }}</div>
      </div>
      <div class="stat-card hold">
        <div class="stat-label">중립 (Hold)</div>
        <div class="stat-value">{{ stats.hold }}</div>
      </div>
      <div class="stat-card sell">
        <div class="stat-label">매도 (Sell)</div>
        <div class="stat-value">{{ stats.sell }}</div>
      </div>
    </div>

    <!-- PDF 분석 섹션 -->
    <div class="card analyze-section">
      <div class="analyze-header">
        <div>
          <h2 class="section-title">PDF 리포트 분석</h2>
          <p class="section-desc">data_src 폴더의 PDF를 분석하여 종목 정보를 추출하고 DB에 저장합니다.</p>
        </div>
        <button class="btn btn-primary" :disabled="analyzing" @click="runAnalyze">
          <span v-if="analyzing">
            <span class="spinner"></span> 분석 중...
          </span>
          <span v-else>PDF 분석 시작</span>
        </button>
      </div>

      <!-- 분석 결과 -->
      <div v-if="analyzeResult" class="analyze-result">
        <div class="result-summary">
          총 {{ analyzeResult.total }}개 파일 처리 &nbsp;|&nbsp;
          성공 <strong>{{ analyzeResult.succeeded }}</strong>개 &nbsp;|&nbsp;
          실패 <span class="text-danger">{{ analyzeResult.failed }}</span>개
        </div>
        <div class="result-list">
          <div
            v-for="item in analyzeResult.results"
            :key="item.file"
            class="result-item"
            :class="item.success ? 'success' : 'fail'"
          >
            <span class="result-file">{{ item.file }}</span>
            <span v-if="item.success">
              {{ item.data.stock_name }} &middot;
              <span :class="opinionClass(item.data.opinion)" class="badge">{{ item.data.opinion }}</span>
              &middot; 목표주가 {{ formatPrice(item.data.target_price) }}
            </span>
            <span v-else class="text-danger">{{ item.error }}</span>
          </div>
        </div>
      </div>

      <div v-if="analyzeError" class="error-box">{{ analyzeError }}</div>
    </div>

    <!-- 최근 리포트 -->
    <div class="card">
      <div class="section-header">
        <h2 class="section-title">최근 분석 리포트</h2>
        <router-link to="/reports" class="view-all">전체 보기 &rarr;</router-link>
      </div>

      <div v-if="loading" class="loading-text">로딩 중...</div>
      <div v-else-if="fetchError" class="error-box">{{ fetchError }}</div>
      <div v-else-if="recentReports.length === 0" class="empty-text">
        분석된 리포트가 없습니다. PDF 분석을 먼저 실행해주세요.
      </div>
      <div v-else class="report-grid">
        <div v-for="r in recentReports" :key="r.id" class="report-card">
          <div class="report-card-top">
            <span class="stock-name">{{ r.stock_name || '-' }}</span>
            <span :class="opinionClass(r.opinion)" class="badge">{{ r.opinion || '-' }}</span>
          </div>
          <div class="target-price">
            목표주가 <strong>{{ formatPrice(r.target_price) }}</strong>
          </div>
          <div class="report-meta">
            <span>{{ r.author || '-' }}</span>
            <span>{{ r.securities_firm || '-' }}</span>
            <span>{{ formatDate(r.report_date) }}</span>
          </div>
          <div v-if="r.summary" class="report-summary">{{ r.summary }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'

const reports = ref([])
const loading = ref(false)
const fetchError = ref(null)
const analyzing = ref(false)
const analyzeResult = ref(null)
const analyzeError = ref(null)

const stats = computed(() => ({
  total: reports.value.length,
  buy:  reports.value.filter(r => r.opinion === 'Buy').length,
  hold: reports.value.filter(r => r.opinion === 'Hold').length,
  sell: reports.value.filter(r => r.opinion === 'Sell').length,
}))

const recentReports = computed(() => reports.value.slice(0, 6))

function opinionClass(opinion) {
  if (opinion === 'Buy')  return 'badge-buy'
  if (opinion === 'Hold') return 'badge-hold'
  if (opinion === 'Sell') return 'badge-sell'
  return 'badge-null'
}

function formatPrice(val) {
  if (val == null) return '-'
  return Number(val).toLocaleString('ko-KR') + '원'
}

function formatDate(val) {
  if (!val) return '-'
  return val.slice(0, 10)
}

async function fetchReports() {
  loading.value = true
  fetchError.value = null
  try {
    const res = await axios.get('/api/reports')
    reports.value = res.data.data || []
  } catch (e) {
    fetchError.value = e.response?.data?.error || e.message
  } finally {
    loading.value = false
  }
}

async function runAnalyze() {
  analyzing.value = true
  analyzeResult.value = null
  analyzeError.value = null
  try {
    const res = await axios.post('/api/analyze')
    analyzeResult.value = res.data
    await fetchReports()
  } catch (e) {
    analyzeError.value = e.response?.data?.error || e.message
  } finally {
    analyzing.value = false
  }
}

onMounted(fetchReports)
</script>

<style scoped>
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 20px;
}
.stat-card {
  background: #fff;
  border-radius: 12px;
  padding: 20px 24px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.08);
  border-left: 4px solid #ced4da;
}
.stat-card.buy  { border-left-color: #28a745; }
.stat-card.hold { border-left-color: #ffc107; }
.stat-card.sell { border-left-color: #dc3545; }
.stat-label { font-size: 13px; color: #6c757d; margin-bottom: 8px; }
.stat-value { font-size: 36px; font-weight: 700; color: #1a1a2e; }

.analyze-section { margin-bottom: 20px; }
.analyze-header {
  display: flex; align-items: flex-start;
  justify-content: space-between; gap: 16px;
  margin-bottom: 16px;
}
.section-title { font-size: 17px; font-weight: 700; margin-bottom: 4px; }
.section-desc  { font-size: 13px; color: #6c757d; }

.analyze-result {
  border: 1px solid #dee2e6;
  border-radius: 8px;
  overflow: hidden;
  margin-top: 12px;
}
.result-summary {
  background: #f8f9fa;
  padding: 10px 16px;
  font-size: 13px;
  border-bottom: 1px solid #dee2e6;
}
.result-list { }
.result-item {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 16px;
  font-size: 13px;
  border-bottom: 1px solid #f0f2f5;
}
.result-item:last-child { border-bottom: none; }
.result-item.success { background: #f6ffed; }
.result-item.fail    { background: #fff2f0; }
.result-file { color: #6c757d; min-width: 100px; }
.text-danger { color: #dc3545; }

.error-box {
  background: #fff2f0;
  border: 1px solid #ffa39e;
  border-radius: 8px;
  padding: 12px 16px;
  color: #cf1322;
  font-size: 13px;
  margin-top: 12px;
}

.section-header {
  display: flex; align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}
.view-all { font-size: 13px; color: #e94560; text-decoration: none; }
.view-all:hover { text-decoration: underline; }

.loading-text, .empty-text {
  text-align: center; color: #6c757d;
  padding: 40px 0; font-size: 14px;
}

.report-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}
.report-card {
  border: 1px solid #e9ecef;
  border-radius: 10px;
  padding: 16px;
  transition: box-shadow 0.2s;
}
.report-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
.report-card-top {
  display: flex; align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.stock-name { font-size: 15px; font-weight: 700; }
.target-price { font-size: 13px; color: #495057; margin-bottom: 8px; }
.target-price strong { color: #1a1a2e; }
.report-meta {
  display: flex; gap: 8px; flex-wrap: wrap;
  font-size: 12px; color: #6c757d;
  margin-bottom: 10px;
}
.report-meta span + span::before { content: '·'; margin-right: 8px; }
.report-summary {
  font-size: 12px; color: #495057;
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.spinner {
  display: inline-block;
  width: 14px; height: 14px;
  border: 2px solid rgba(255,255,255,0.4);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  vertical-align: middle;
}
@keyframes spin { to { transform: rotate(360deg); } }

@media (max-width: 900px) {
  .stats-grid { grid-template-columns: repeat(2, 1fr); }
  .report-grid { grid-template-columns: 1fr; }
  .analyze-header { flex-direction: column; }
}
</style>
