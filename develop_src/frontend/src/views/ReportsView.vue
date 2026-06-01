<template>
  <div>
    <div class="page-header">
      <div>
        <h1 class="page-title">리포트 목록</h1>
        <p class="page-desc">분석된 애널리스트 리포트 전체 목록입니다. <span class="label-note">투자의견은 애널리스트 리포트 기준입니다.</span></p>
      </div>
    </div>

    <!-- 필터 영역 -->
    <div class="card filter-card">
      <div class="filter-row">
        <div class="filter-item">
          <label class="filter-label">종목명 검색</label>
          <input v-model="filterStock" class="input" type="text" placeholder="종목명 입력..." />
        </div>
        <div class="filter-item">
          <label class="filter-label">날짜 (시작)</label>
          <input v-model="filterDateFrom" class="input" type="date" />
        </div>
        <div class="filter-item">
          <label class="filter-label">날짜 (종료)</label>
          <input v-model="filterDateTo" class="input" type="date" />
        </div>
        <div class="filter-item">
          <label class="filter-label">투자의견</label>
          <select v-model="filterOpinion" class="select">
            <option value="">전체</option>
            <option value="Buy">매수 (Buy)</option>
            <option value="Hold">중립 (Hold)</option>
            <option value="Sell">매도 (Sell)</option>
          </select>
        </div>
        <div class="filter-item">
          <label class="filter-label">AI 추천</label>
          <select v-model="filterAiRec" class="select">
            <option value="">전체</option>
            <option value="Buy">Buy</option>
            <option value="Hold">Hold</option>
            <option value="Sell">Sell</option>
          </select>
        </div>
        <div class="filter-item">
          <label class="filter-label">증권사</label>
          <input v-model="filterFirm" class="input" type="text" placeholder="증권사명..." />
        </div>
        <div class="filter-item">
          <label class="filter-label">최소 점수</label>
          <select v-model="filterMinScore" class="select">
            <option value="">전체</option>
            <option value="1">1 이상</option>
            <option value="0">0 이상</option>
            <option value="-3">-3 이상</option>
          </select>
        </div>
        <button class="btn btn-reset" @click="resetFilters">초기화</button>
      </div>
    </div>

    <div class="card">
      <div v-if="loading" class="loading-text">로딩 중...</div>
      <div v-else-if="error" class="error-box">{{ error }}</div>
      <div v-else-if="filtered.length === 0" class="empty-text">
        표시할 리포트가 없습니다.
      </div>
      <div v-else>
        <div class="table-meta">총 {{ filtered.length }}개 리포트</div>
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th @click="setSort('stock_name')" class="sortable">
                  종목명 <span class="sort-icon">{{ sortIcon('stock_name') }}</span>
                </th>
                <th>종목코드</th>
                <th @click="setSort('target_price')" class="sortable">
                  목표주가 <span class="sort-icon">{{ sortIcon('target_price') }}</span>
                </th>
                <th @click="setSort('report_date')" class="sortable">
                  리포트 날짜 <span class="sort-icon">{{ sortIcon('report_date') }}</span>
                </th>
                <th>투자의견<br><span class="th-sub">(애널리스트)</span></th>
                <th>목표가 변화</th>
                <th @click="setSort('price_gap_pct')" class="sortable">
                  괴리율 <span class="sort-icon">{{ sortIcon('price_gap_pct') }}</span>
                </th>
                <th @click="setSort('final_score')" class="sortable">
                  최종점수 <span class="sort-icon">{{ sortIcon('final_score') }}</span>
                </th>
                <th>AI 추천</th>
                <th>작성자</th>
                <th>증권사</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="r in filtered"
                :key="r.id"
                class="table-row"
                @click="openDetail(r)"
              >
                <td class="bold">
                  <span class="stock-name-text">{{ r.stock_name || '-' }}</span>
                  <button
                    v-if="r.stock_code"
                    class="chart-btn"
                    title="목표주가 추이 차트"
                    @click.stop="openChart(r.stock_code, r.stock_name)"
                  >📈</button>
                </td>
                <td class="mono">{{ r.stock_code || '-' }}</td>
                <td class="price">{{ formatPrice(r.target_price) }}</td>
                <td>{{ formatDate(r.report_date) }}</td>
                <td>
                  <span :class="opinionClass(r.opinion_analyst || r.opinion)" class="badge">
                    {{ r.opinion_analyst || r.opinion || '-' }}
                  </span>
                </td>
                <td>
                  <span :class="tpChangeClass(r.target_price_change)" class="tp-change">
                    {{ tpChangeLabel(r.target_price_change) }}
                  </span>
                </td>
                <td class="gap-cell">
                  <span v-if="r.price_gap_pct != null" :class="gapClass(r.price_gap_pct)" class="gap-val">
                    {{ r.price_gap_pct > 0 ? '+' : '' }}{{ r.price_gap_pct }}%
                  </span>
                  <span v-else class="text-muted">-</span>
                </td>
                <td class="score-cell">
                  <span :class="scoreClass(r.final_score)">
                    {{ r.final_score != null ? (r.final_score > 0 ? '+' : '') + r.final_score : '-' }}
                  </span>
                </td>
                <td>
                  <span v-if="r.ai_recommendation" :class="opinionClass(r.ai_recommendation)" class="badge">
                    {{ r.ai_recommendation }}
                  </span>
                  <span v-else class="text-muted">-</span>
                </td>
                <td>{{ r.author || '-' }}</td>
                <td>{{ r.securities_firm || '-' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- 리포트 상세 모달 -->
    <div v-if="selected" class="modal-backdrop" @click.self="selected = null">
      <div class="modal">
        <div class="modal-header">
          <div>
            <h2 class="modal-title">{{ selected.stock_name || '-' }}</h2>
            <span class="modal-code">{{ selected.stock_code ? `(${selected.stock_code})` : '' }}</span>
          </div>
          <button class="modal-close" @click="selected = null">&times;</button>
        </div>
        <div class="modal-body">
          <div class="detail-grid">
            <div class="detail-item">
              <span class="detail-label">투자의견 (애널리스트)</span>
              <span :class="opinionClass(selected.opinion)" class="badge">{{ selected.opinion || '-' }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">목표주가</span>
              <span class="detail-val price-large">{{ formatPrice(selected.target_price) }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">현재주가 (리포트 기준)</span>
              <span class="detail-val">{{ formatPrice(selected.current_price) }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">괴리율</span>
              <span v-if="selected.price_gap_pct != null" class="detail-val" :class="gapClass(selected.price_gap_pct)">
                {{ selected.price_gap_pct > 0 ? '+' : '' }}{{ selected.price_gap_pct }}%
              </span>
              <span v-else class="detail-val text-muted">-</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">리포트 날짜</span>
              <span class="detail-val">{{ formatDate(selected.report_date) }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">작성자</span>
              <span class="detail-val">{{ selected.author || '-' }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">증권사</span>
              <span class="detail-val">{{ selected.securities_firm || '-' }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">파일명</span>
              <span class="detail-val mono">{{ selected.filename }}</span>
            </div>
          </div>

          <!-- 괴리율 해석 배너 -->
          <div v-if="selected.gap_interpretation" class="gap-banner" :class="gapBannerClass(selected.price_gap_pct)">
            {{ selected.gap_interpretation }}
          </div>

          <!-- 리스크 점수 섹션 -->
          <div v-if="selected.final_score != null" class="score-section">
            <div class="score-title">리스크 점수 분석</div>
            <div class="score-grid">
              <div class="score-item">
                <span class="score-label">의견 점수</span>
                <span class="score-val" :class="scoreClass(selected.opinion_score)">
                  {{ selected.opinion_score > 0 ? '+' : '' }}{{ selected.opinion_score }}
                </span>
              </div>
              <div class="score-item">
                <span class="score-label">리스크 점수</span>
                <span class="score-val text-danger">{{ selected.risk_score }}</span>
              </div>
              <div class="score-item">
                <span class="score-label">최종 점수</span>
                <span class="score-val" :class="scoreClass(selected.final_score)">
                  {{ selected.final_score > 0 ? '+' : '' }}{{ selected.final_score }}
                </span>
              </div>
              <div class="score-item">
                <span class="score-label">AI 추천</span>
                <span v-if="selected.ai_recommendation" :class="opinionClass(selected.ai_recommendation)" class="badge">
                  {{ selected.ai_recommendation }}
                </span>
                <span v-else>-</span>
              </div>
            </div>
            <div v-if="parsedRiskTypes(selected).length" class="risk-types">
              <span class="score-label">리스크 유형:</span>
              <span
                v-for="(t, i) in parsedRiskTypes(selected)"
                :key="i"
                :class="riskTypeClass(t)"
                class="risk-badge"
              >{{ t }}</span>
            </div>
          </div>

          <div v-if="selected.summary" class="summary-box">
            <div class="summary-label">핵심 요약</div>
            <p class="summary-text">{{ selected.summary }}</p>
          </div>

          <!-- 원문 PDF 뷰어 -->
          <div class="pdf-section">
            <button class="btn-pdf-toggle" @click="showPdf = !showPdf">
              {{ showPdf ? '▲ 원문 PDF 닫기' : '▼ 원문 PDF 보기' }}
            </button>
            <div v-if="showPdf" class="pdf-viewer">
              <iframe
                :src="`/api/pdf/${selected.filename}`"
                class="pdf-iframe"
                title="원문 리포트 PDF"
              ></iframe>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 목표주가 추이 차트 모달 -->
    <div v-if="chartStock" class="modal-backdrop" @click.self="closeChart">
      <div class="modal chart-modal">
        <div class="modal-header">
          <div>
            <h2 class="modal-title">{{ chartStock.name }}</h2>
            <span class="modal-code">({{ chartStock.code }}) 목표주가 추이</span>
          </div>
          <button class="modal-close" @click="closeChart">&times;</button>
        </div>
        <div class="modal-body">
          <div v-if="chartLoading" class="loading-text">차트 로딩 중...</div>
          <div v-else-if="chartError" class="error-box">{{ chartError }}</div>
          <div v-else-if="chartData.length === 0" class="empty-text">데이터가 없습니다.</div>
          <template v-else>
            <!-- 요약 통계 -->
            <div class="chart-stats">
              <div class="chart-stat-box">
                <div class="chart-stat-label">최신 목표주가</div>
                <div class="chart-stat-val">{{ formatPrice(chartStats.latestTarget) }}</div>
              </div>
              <div class="chart-stat-box">
                <div class="chart-stat-label">현재주가</div>
                <div class="chart-stat-val">{{ chartStats.currentPrice ? formatPrice(chartStats.currentPrice) : '-' }}</div>
              </div>
              <div class="chart-stat-box">
                <div class="chart-stat-label">평균 괴리율</div>
                <div class="chart-stat-val" :class="chartStats.avgGap > 0 ? 'text-buy' : chartStats.avgGap < 0 ? 'text-sell' : ''">
                  {{ chartStats.avgGap != null ? (chartStats.avgGap > 0 ? '+' : '') + chartStats.avgGap + '%' : '-' }}
                </div>
              </div>
            </div>

            <!-- 범례 -->
            <div class="chart-legend">
              <span class="legend-item"><span class="legend-line blue"></span>목표주가</span>
              <span class="legend-item"><span class="legend-line dashed"></span>현재주가</span>
              <span class="legend-item"><span class="legend-dot buy-dot"></span>Buy</span>
              <span class="legend-item"><span class="legend-dot hold-dot"></span>Hold</span>
              <span class="legend-item"><span class="legend-dot sell-dot"></span>Sell</span>
            </div>

            <!-- 차트 -->
            <div class="chart-wrap">
              <canvas ref="chartCanvasRef" role="img" aria-label="목표주가 추이 차트"></canvas>
            </div>

            <!-- 리포트 목록 -->
            <div class="chart-report-list">
              <div class="chart-report-header">리포트 목록</div>
              <div
                v-for="r in chartReports"
                :key="r.id"
                class="chart-report-row"
              >
                <span class="cr-date">{{ formatDate(r.report_date) }}</span>
                <span class="cr-firm">{{ r.securities_firm || '-' }} · {{ r.author || '-' }}</span>
                <span class="cr-price">{{ formatPrice(r.target_price) }}</span>
                <span :class="opinionClass(r.opinion)" class="badge cr-badge">{{ r.opinion || '-' }}</span>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import axios from 'axios'
import Chart from 'chart.js/auto'

const reports = ref([])
const loading = ref(false)
const error = ref(null)
const filterStock = ref('')
const filterDateFrom = ref('')
const filterDateTo = ref('')
const filterOpinion = ref('')
const filterAiRec = ref('')
const filterFirm = ref('')
const filterMinScore = ref('')
const sortKey = ref('report_date')
const sortDir = ref('desc')
const selected = ref(null)
const showPdf = ref(false)

// 차트 상태
const chartStock = ref(null)
const chartData = ref([])
const chartLoading = ref(false)
const chartError = ref(null)
const chartCanvasRef = ref(null)
let chartInstance = null

const filtered = computed(() => {
  let list = reports.value
  if (filterStock.value)   list = list.filter(r => (r.stock_name || '').includes(filterStock.value))
  if (filterOpinion.value) list = list.filter(r => r.opinion === filterOpinion.value)
  if (filterAiRec.value)    list = list.filter(r => (r.opinion_computed || r.ai_recommendation) === filterAiRec.value)
  if (filterFirm.value)     list = list.filter(r => (r.securities_firm || '').includes(filterFirm.value))
  if (filterMinScore.value !== '') list = list.filter(r => (r.score ?? r.final_score ?? 0) >= Number(filterMinScore.value))
  if (filterDateFrom.value) list = list.filter(r => r.report_date && r.report_date.slice(0,10) >= filterDateFrom.value)
  if (filterDateTo.value)   list = list.filter(r => r.report_date && r.report_date.slice(0,10) <= filterDateTo.value)
  return [...list].sort((a, b) => {
    const av = a[sortKey.value] ?? ''
    const bv = b[sortKey.value] ?? ''
    if (av < bv) return sortDir.value === 'asc' ? -1 : 1
    if (av > bv) return sortDir.value === 'asc' ? 1 : -1
    return 0
  })
})

// 차트용 리포트(날짜순 오름차순, 유효 데이터만)
const chartReports = computed(() =>
  [...chartData.value]
    .filter(r => r.target_price && r.report_date)
    .sort((a, b) => (a.report_date > b.report_date ? 1 : -1))
)

const chartStats = computed(() => {
  const rs = chartReports.value
  if (rs.length === 0) return { latestTarget: null, currentPrice: null, avgGap: null }
  const latest = rs[rs.length - 1]
  const avgTarget = rs.reduce((s, r) => s + Number(r.target_price), 0) / rs.length
  const cur = Number(latest.current_price)
  const avgGap = cur > 0 ? ((avgTarget - cur) / cur * 100).toFixed(1) : null
  return {
    latestTarget: Number(latest.target_price),
    currentPrice: cur || null,
    avgGap: avgGap != null ? Number(avgGap) : null,
  }
})

// 모달 변경 시 PDF 뷰어 초기화
watch(selected, () => { showPdf.value = false })

async function openChart(code, name) {
  chartStock.value = { code, name }
  chartData.value = []
  chartLoading.value = true
  chartError.value = null
  try {
    const res = await axios.get(`/api/reports/stock/${code}`)
    chartData.value = res.data.data || []
    await nextTick()
    renderChart()
  } catch (e) {
    chartError.value = e.response?.data?.error || e.message
  } finally {
    chartLoading.value = false
  }
}

function renderChart() {
  if (chartInstance) { chartInstance.destroy(); chartInstance = null }
  const canvas = chartCanvasRef.value
  const rs = chartReports.value
  if (!canvas || rs.length === 0) return

  const OPINION_COLOR = { Buy: '#1D9E75', Hold: '#BA7517', Sell: '#E24B4A' }
  const labels   = rs.map(r => r.report_date.slice(0, 10).slice(5))
  const targets  = rs.map(r => Number(r.target_price))
  const curPrice = chartStats.value.currentPrice

  chartInstance = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: '목표주가',
          data: targets,
          borderColor: '#378ADD',
          backgroundColor: 'rgba(55,138,221,0.08)',
          borderWidth: 2,
          pointBackgroundColor: rs.map(r => OPINION_COLOR[r.opinion] || '#888'),
          pointBorderColor:     rs.map(r => OPINION_COLOR[r.opinion] || '#888'),
          pointRadius: 6,
          pointHoverRadius: 8,
          fill: true,
          tension: 0.3,
        },
        ...(curPrice ? [{
          label: '현재주가',
          data: new Array(labels.length).fill(curPrice),
          borderColor: '#888780',
          borderWidth: 1.5,
          borderDash: [6, 4],
          pointRadius: 0,
          fill: false,
        }] : []),
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              if (ctx.datasetIndex === 0) {
                const r = rs[ctx.dataIndex]
                return [
                  `목표주가: ${Number(ctx.raw).toLocaleString('ko-KR')}원`,
                  `${r.securities_firm || '-'} · ${r.author || '-'} · ${r.opinion || '-'}`,
                ]
              }
              return `현재주가: ${Number(ctx.raw).toLocaleString('ko-KR')}원`
            },
          },
        },
      },
      scales: {
        y: {
          ticks: { callback: v => (v / 10000).toFixed(0) + '만', font: { size: 12 } },
          grid: { color: 'rgba(136,135,128,0.15)' },
        },
        x: {
          ticks: { font: { size: 12 }, autoSkip: false },
          grid: { display: false },
        },
      },
    },
  })
}

function closeChart() {
  if (chartInstance) { chartInstance.destroy(); chartInstance = null }
  chartStock.value = null
}

function resetFilters() {
  filterStock.value = ''
  filterDateFrom.value = ''
  filterDateTo.value = ''
  filterOpinion.value = ''
  filterAiRec.value = ''
  filterFirm.value = ''
  filterMinScore.value = ''
}

function tpChangeLabel(val) {
  if (val === 'up')   return '▲ 상향'
  if (val === 'down') return '▼ 하향'
  if (val === 'flat') return '— 유지'
  return '-'
}

function tpChangeClass(val) {
  if (val === 'up')   return 'tp-up'
  if (val === 'down') return 'tp-down'
  if (val === 'flat') return 'tp-flat'
  return ''
}

function setSort(key) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortDir.value = 'desc'
  }
}

function sortIcon(key) {
  if (sortKey.value !== key) return '↕'
  return sortDir.value === 'asc' ? '↑' : '↓'
}

function opinionClass(opinion) {
  if (opinion === 'Buy')  return 'badge-buy'
  if (opinion === 'Hold') return 'badge-hold'
  if (opinion === 'Sell') return 'badge-sell'
  return 'badge-null'
}

function scoreClass(score) {
  if (score == null) return ''
  if (score > 0) return 'text-buy'
  if (score < 0) return 'text-sell'
  return 'text-hold'
}

function riskTypeClass(type) {
  if (type === 'Macro')    return 'risk-macro'
  if (type === 'Industry') return 'risk-industry'
  if (type === 'Company')  return 'risk-company'
  return ''
}

function gapClass(gap) {
  if (gap == null) return ''
  if (gap >= 15)  return 'text-buy'
  if (gap >= 5)   return 'text-hold'
  if (gap >= 0)   return 'text-muted'
  return 'text-sell'
}

function gapBannerClass(gap) {
  if (gap == null) return ''
  if (gap >= 15)  return 'gap-banner-positive'
  if (gap >= 5)   return 'gap-banner-neutral'
  return 'gap-banner-negative'
}

function parsedRiskTypes(r) {
  if (!r.risk_types) return []
  try { return JSON.parse(r.risk_types) } catch { return [] }
}

function formatPrice(val) {
  if (val == null) return '-'
  return Number(val).toLocaleString('ko-KR') + '원'
}

function formatDate(val) {
  if (!val) return '-'
  return val.slice(0, 10)
}

function openDetail(r) {
  selected.value = r
}

async function fetchReports() {
  loading.value = true
  error.value = null
  try {
    const res = await axios.get('/api/reports')
    reports.value = res.data.data || []
  } catch (e) {
    error.value = e.response?.data?.error || e.message
  } finally {
    loading.value = false
  }
}

onMounted(fetchReports)
</script>

<style scoped>
.page-header {
  display: flex; align-items: flex-start;
  justify-content: space-between; gap: 16px;
  margin-bottom: 16px;
}
.page-title { font-size: 22px; font-weight: 700; }
.page-desc  { font-size: 13px; color: #6c757d; margin-top: 4px; }
.label-note { color: #e94560; font-weight: 600; }

/* 필터 카드 */
.filter-card { margin-bottom: 16px; padding: 16px 20px; }
.filter-row  { display: flex; gap: 12px; align-items: flex-end; flex-wrap: wrap; }
.filter-item { display: flex; flex-direction: column; gap: 4px; }
.filter-label { font-size: 12px; color: #6c757d; font-weight: 600; }
.input {
  padding: 8px 12px; border: 1px solid #ced4da;
  border-radius: 8px; font-size: 14px; background: #fff; width: 140px;
}
.select {
  padding: 8px 12px; border: 1px solid #ced4da;
  border-radius: 8px; font-size: 14px; background: #fff; cursor: pointer;
}
.btn-reset {
  padding: 8px 16px; border: 1px solid #ced4da; border-radius: 8px;
  font-size: 14px; background: #fff; cursor: pointer; color: #6c757d; align-self: flex-end;
}
.btn-reset:hover { background: #f8f9fa; }

.table-meta { font-size: 13px; color: #6c757d; margin-bottom: 12px; }
.table-wrap { overflow-x: auto; }
.table { width: 100%; border-collapse: collapse; font-size: 14px; }
.table th {
  background: #f8f9fa; padding: 11px 14px; text-align: left;
  font-weight: 600; font-size: 13px; color: #495057;
  border-bottom: 2px solid #dee2e6; white-space: nowrap;
}
.th-sub { font-size: 11px; color: #adb5bd; font-weight: 400; }
.table td { padding: 12px 14px; border-bottom: 1px solid #f0f2f5; vertical-align: middle; }
.sortable { cursor: pointer; user-select: none; }
.sortable:hover { background: #e9ecef; }
.sort-icon { font-size: 11px; color: #adb5bd; }
.table-row { cursor: pointer; transition: background 0.15s; }
.table-row:hover { background: #f8f9fa; }
.bold  { font-weight: 600; }
.mono  { font-family: monospace; font-size: 13px; color: #6c757d; }
.price { font-weight: 600; color: #1a1a2e; }
.price-large { font-size: 20px; font-weight: 700; color: #e94560; }
.score-cell { font-weight: 700; font-size: 15px; }
.tp-change  { font-size: 13px; font-weight: 700; }
.tp-up   { color: #28a745; }
.tp-down { color: #dc3545; }
.tp-flat { color: #6c757d; }
.gap-cell  { font-weight: 700; font-size: 14px; }
.gap-val   { font-weight: 700; }
.text-buy  { color: #28a745; }
.text-hold { color: #e67e00; }
.text-sell { color: #dc3545; }
.text-danger { color: #dc3545; }
.text-muted  { color: #adb5bd; }

/* 차트 버튼 */
.stock-name-text { margin-right: 6px; }
.chart-btn {
  background: none; border: none; cursor: pointer;
  font-size: 14px; padding: 2px 4px; border-radius: 4px;
  opacity: 0.6; transition: opacity 0.15s;
  vertical-align: middle;
}
.chart-btn:hover { opacity: 1; background: #f0f2f5; }

/* 괴리율 해석 배너 */
.gap-banner { border-radius: 8px; padding: 10px 14px; font-size: 13px; font-weight: 600; margin-bottom: 16px; }
.gap-banner-positive { background: #d4edda; color: #155724; }
.gap-banner-neutral  { background: #fff3cd; color: #856404; }
.gap-banner-negative { background: #f8d7da; color: #721c24; }

.loading-text, .empty-text {
  text-align: center; color: #6c757d; padding: 40px 0; font-size: 14px;
}
.error-box {
  background: #fff2f0; border: 1px solid #ffa39e;
  border-radius: 8px; padding: 12px 16px; color: #cf1322; font-size: 13px;
}

/* 모달 공통 */
.modal-backdrop {
  position: fixed; inset: 0; background: rgba(0,0,0,0.45);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000; padding: 20px;
}
.modal {
  background: #fff; border-radius: 14px;
  width: 100%; max-width: 580px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
  overflow: hidden; max-height: 90vh; overflow-y: auto;
}
.modal-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 20px 24px; background: #1a1a2e; color: #fff;
  position: sticky; top: 0;
}
.modal-title  { font-size: 20px; font-weight: 700; }
.modal-code   { font-size: 13px; color: rgba(255,255,255,0.6); }
.modal-close  { background: none; border: none; color: rgba(255,255,255,0.7); font-size: 24px; cursor: pointer; line-height: 1; }
.modal-close:hover { color: #fff; }
.modal-body { padding: 24px; }

.detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
.detail-item { display: flex; flex-direction: column; gap: 6px; }
.detail-label { font-size: 12px; color: #6c757d; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
.detail-val   { font-size: 15px; font-weight: 500; }

.score-section { background: #f8f9fa; border-radius: 10px; padding: 16px; margin-bottom: 16px; }
.score-title { font-size: 13px; font-weight: 700; color: #495057; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
.score-grid  { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 12px; }
.score-item  { display: flex; flex-direction: column; gap: 4px; }
.score-label { font-size: 11px; color: #6c757d; font-weight: 600; }
.score-val   { font-size: 20px; font-weight: 700; }
.risk-types  { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.risk-badge  { padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; }
.risk-macro    { background: #fff3cd; color: #856404; }
.risk-industry { background: #cff4fc; color: #055160; }
.risk-company  { background: #f8d7da; color: #842029; }

.summary-box { background: #f8f9fa; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
.summary-label { font-size: 12px; color: #6c757d; font-weight: 600; margin-bottom: 8px; text-transform: uppercase; }
.summary-text  { font-size: 14px; line-height: 1.7; color: #495057; }

/* PDF 뷰어 */
.pdf-section { margin-top: 8px; }
.btn-pdf-toggle {
  width: 100%; padding: 10px 16px; text-align: left;
  background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 8px;
  font-size: 14px; font-weight: 600; color: #495057; cursor: pointer;
  transition: background 0.15s;
}
.btn-pdf-toggle:hover { background: #e9ecef; }
.pdf-viewer { margin-top: 12px; border-radius: 8px; overflow: hidden; border: 1px solid #dee2e6; }
.pdf-iframe { display: block; width: 100%; height: 520px; border: none; }

/* 차트 모달 */
.chart-modal { max-width: 720px; }

.chart-stats {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 16px;
}
.chart-stat-box {
  background: #f8f9fa; border-radius: 10px; padding: 14px;
}
.chart-stat-label { font-size: 12px; color: #6c757d; font-weight: 600; margin-bottom: 4px; }
.chart-stat-val   { font-size: 20px; font-weight: 700; color: #1a1a2e; }

.chart-legend {
  display: flex; gap: 16px; font-size: 12px; color: #6c757d;
  margin-bottom: 12px; flex-wrap: wrap;
}
.legend-item { display: flex; align-items: center; gap: 5px; }
.legend-line { width: 20px; height: 2px; display: inline-block; border-radius: 2px; }
.legend-line.blue   { background: #378ADD; }
.legend-line.dashed { border-top: 2px dashed #888780; background: transparent; }
.legend-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
.buy-dot  { background: #1D9E75; }
.hold-dot { background: #BA7517; }
.sell-dot { background: #E24B4A; }

.chart-wrap { position: relative; width: 100%; height: 280px; margin-bottom: 24px; }

/* 차트 하단 리포트 목록 */
.chart-report-list { border-top: 1px solid #dee2e6; padding-top: 12px; }
.chart-report-header { font-size: 12px; color: #6c757d; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
.chart-report-row {
  display: flex; align-items: center; gap: 12px;
  padding: 8px 0; border-bottom: 1px solid #f0f2f5; font-size: 13px;
}
.chart-report-row:last-child { border-bottom: none; }
.cr-date  { color: #6c757d; min-width: 55px; }
.cr-firm  { flex: 1; color: #495057; }
.cr-price { font-weight: 600; color: #1a1a2e; white-space: nowrap; }
.cr-badge { flex-shrink: 0; }
</style>
