<template>
  <div>
    <!-- 상단 통계 카드 -->
    <div class="stats-section-label">애널리스트 투자의견 <span class="label-note">(리포트 원문 기준)</span></div>
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

    <!-- AI 리스크 점수 기반 추천 통계 -->
    <div class="stats-section-label">AI 리스크 분석 추천 <span class="label-note">(의견점수 + 리스크점수 합산)</span></div>
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">분석 완료</div>
        <div class="stat-value">{{ aiStats.analyzed }}</div>
      </div>
      <div class="stat-card buy">
        <div class="stat-label">AI 매수 추천</div>
        <div class="stat-value">{{ aiStats.buy }}</div>
      </div>
      <div class="stat-card hold">
        <div class="stat-label">AI 중립</div>
        <div class="stat-value">{{ aiStats.hold }}</div>
      </div>
      <div class="stat-card sell">
        <div class="stat-label">AI 매도 추천</div>
        <div class="stat-value">{{ aiStats.sell }}</div>
      </div>
    </div>

    <!-- PDF 분석 섹션 -->
    <div class="card analyze-section">
      <div class="analyze-header">
        <div>
          <h2 class="section-title">PDF 리포트 분석</h2>
          <p class="section-desc">data_src 폴더의 PDF를 분석하여 종목 정보를 추출하고 DB에 저장합니다.</p>
        </div>
        <div class="btn-group">
          <a
            href="https://consensus.hankyung.com/analysis/list?skinType=business"
            target="_blank"
            rel="noopener noreferrer"
            class="btn btn-outline"
          >PDF 내려받기</a>
          <button class="btn btn-outline" :disabled="moving" @click="movePdfs">
            <span v-if="moving"><span class="spinner spinner-dark"></span> 이동 중...</span>
            <span v-else>PDF파일 저장소로 옮기기</span>
          </button>
          <button class="btn btn-primary" :disabled="analyzing" @click="runAnalyze">
            <span v-if="analyzing">
              <span class="spinner"></span> 분석 중...
            </span>
            <span v-else>PDF 분석 시작</span>
          </button>
        </div>
      </div>

      <!-- PDF 이동 결과 -->
      <div v-if="moveResult" class="analyze-result">
        <div class="result-summary">{{ moveResult.message }}</div>
        <div v-if="moveResult.moved && moveResult.moved.length" class="result-list">
          <div v-for="f in moveResult.moved" :key="f" class="result-item success">
            <span class="result-file">{{ f }}</span>
            <span>저장소로 이동 완료</span>
          </div>
        </div>
        <div v-if="moveResult.errors && moveResult.errors.length" class="result-list">
          <div v-for="e in moveResult.errors" :key="e.file" class="result-item fail">
            <span class="result-file">{{ e.file }}</span>
            <span class="text-danger">{{ e.error }}</span>
          </div>
        </div>
      </div>
      <div v-if="moveError" class="error-box">{{ moveError }}</div>

      <!-- 분석 결과 -->
      <div v-if="analyzeResult" class="analyze-result">
        <div class="result-summary">
          당일 파일 {{ analyzeResult.total }}개 &nbsp;|&nbsp;
          신규 분석 <strong>{{ analyzeResult.succeeded }}</strong>개 &nbsp;|&nbsp;
          기분석 스킵 <span class="text-muted">{{ analyzeResult.skipped }}</span>개 &nbsp;|&nbsp;
          실패 <span class="text-danger">{{ analyzeResult.failed }}</span>개
        </div>
        <div class="result-list">
          <div
            v-for="item in analyzeResult.results"
            :key="item.file"
            class="result-item"
            :class="item.skipped ? 'skip' : item.success ? 'success' : 'fail'"
          >
            <span class="result-file">{{ item.file }}</span>
            <span v-if="item.skipped" class="text-muted">기분석 완료 (스킵)</span>
            <span v-else-if="item.success">
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
            <span v-if="r.price_gap_pct != null" :class="gapClass(r.price_gap_pct)" class="gap-chip">
              {{ r.price_gap_pct > 0 ? '+' : '' }}{{ r.price_gap_pct }}%
            </span>
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
const moving = ref(false)
const moveResult = ref(null)
const moveError = ref(null)

const stats = computed(() => ({
  total: reports.value.length,
  buy:  reports.value.filter(r => r.opinion === 'Buy').length,
  hold: reports.value.filter(r => r.opinion === 'Hold').length,
  sell: reports.value.filter(r => r.opinion === 'Sell').length,
}))

const aiStats = computed(() => {
  const analyzed = reports.value.filter(r => r.ai_recommendation != null)
  return {
    analyzed: analyzed.length,
    buy:  analyzed.filter(r => r.ai_recommendation === 'Buy').length,
    hold: analyzed.filter(r => r.ai_recommendation === 'Hold').length,
    sell: analyzed.filter(r => r.ai_recommendation === 'Sell').length,
  }
})

const recentReports = computed(() => reports.value.slice(0, 6))

function opinionClass(opinion) {
  if (opinion === 'Buy')  return 'badge-buy'
  if (opinion === 'Hold') return 'badge-hold'
  if (opinion === 'Sell') return 'badge-sell'
  return 'badge-null'
}

function gapClass(gap) {
  if (gap == null) return ''
  if (gap >= 15)  return 'gap-positive'
  if (gap >= 5)   return 'gap-neutral'
  if (gap >= 0)   return 'gap-low'
  return 'gap-negative'
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

async function movePdfs() {
  const ok = confirm('다운로드 폴더의 PDF 파일을 저장소(data_src)로 이동합니다.\n계속하시겠습니까?')
  if (!ok) return
  moving.value = true
  moveResult.value = null
  moveError.value = null
  try {
    const res = await axios.post('/api/utils/move-pdfs')
    moveResult.value = res.data
  } catch (e) {
    moveError.value = e.response?.data?.error || e.message
  } finally {
    moving.value = false
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
.stats-section-label {
  font-size: 13px;
  font-weight: 700;
  color: #495057;
  margin-bottom: 8px;
  margin-top: 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.label-note { font-size: 12px; color: #6c757d; font-weight: 400; text-transform: none; letter-spacing: 0; }
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 16px;
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
.btn-group { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.btn-outline {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 10px 20px;
  border: 1px solid #ced4da; border-radius: 8px;
  font-size: 14px; font-weight: 600;
  cursor: pointer; transition: all 0.2s;
  background: #fff; color: #495057;
  text-decoration: none;
}
.btn-outline:hover { background: #f8f9fa; border-color: #adb5bd; }
.btn-outline:disabled { opacity: 0.6; cursor: not-allowed; }
.spinner-dark {
  border-color: rgba(0,0,0,0.2);
  border-top-color: #495057;
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
.result-item.skip    { background: #f8f9fa; }
.text-muted          { color: #adb5bd; }
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
.target-price { font-size: 13px; color: #495057; margin-bottom: 8px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.target-price strong { color: #1a1a2e; }
.gap-chip { font-size: 12px; font-weight: 700; padding: 1px 7px; border-radius: 10px; }
.gap-positive { background: #d4edda; color: #155724; }
.gap-neutral  { background: #fff3cd; color: #856404; }
.gap-low      { background: #e9ecef; color: #495057; }
.gap-negative { background: #f8d7da; color: #721c24; }
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
