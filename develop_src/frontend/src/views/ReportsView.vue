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
                <td class="bold">{{ r.stock_name || '-' }}</td>
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

    <!-- 상세 모달 -->
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
  padding: 8px 12px;
  border: 1px solid #ced4da;
  border-radius: 8px;
  font-size: 14px;
  background: #fff;
  width: 140px;
}
.select {
  padding: 8px 12px;
  border: 1px solid #ced4da;
  border-radius: 8px;
  font-size: 14px;
  background: #fff;
  cursor: pointer;
}
.btn-reset {
  padding: 8px 16px;
  border: 1px solid #ced4da;
  border-radius: 8px;
  font-size: 14px;
  background: #fff;
  cursor: pointer;
  color: #6c757d;
  align-self: flex-end;
}
.btn-reset:hover { background: #f8f9fa; }

.table-meta { font-size: 13px; color: #6c757d; margin-bottom: 12px; }
.table-wrap { overflow-x: auto; }
.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}
.table th {
  background: #f8f9fa;
  padding: 11px 14px;
  text-align: left;
  font-weight: 600;
  font-size: 13px;
  color: #495057;
  border-bottom: 2px solid #dee2e6;
  white-space: nowrap;
}
.th-sub { font-size: 11px; color: #adb5bd; font-weight: 400; }
.table td {
  padding: 12px 14px;
  border-bottom: 1px solid #f0f2f5;
  vertical-align: middle;
}
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
.tp-up      { color: #28a745; }
.tp-down    { color: #dc3545; }
.tp-flat    { color: #6c757d; }
.gap-cell   { font-weight: 700; font-size: 14px; }
.gap-val    { font-weight: 700; }
.text-buy   { color: #28a745; }
.text-hold  { color: #e67e00; }
.text-sell  { color: #dc3545; }
.text-danger { color: #dc3545; }
.text-muted  { color: #adb5bd; }

/* 괴리율 해석 배너 */
.gap-banner {
  border-radius: 8px;
  padding: 10px 14px;
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 16px;
}
.gap-banner-positive { background: #d4edda; color: #155724; }
.gap-banner-neutral  { background: #fff3cd; color: #856404; }
.gap-banner-negative { background: #f8d7da; color: #721c24; }

.loading-text, .empty-text {
  text-align: center; color: #6c757d;
  padding: 40px 0; font-size: 14px;
}
.error-box {
  background: #fff2f0;
  border: 1px solid #ffa39e;
  border-radius: 8px;
  padding: 12px 16px;
  color: #cf1322;
  font-size: 13px;
}

/* 모달 */
.modal-backdrop {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.45);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000;
  padding: 20px;
}
.modal {
  background: #fff;
  border-radius: 14px;
  width: 100%; max-width: 580px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
  overflow: hidden;
  max-height: 90vh;
  overflow-y: auto;
}
.modal-header {
  display: flex; align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  background: #1a1a2e;
  color: #fff;
  position: sticky; top: 0;
}
.modal-title  { font-size: 20px; font-weight: 700; }
.modal-code   { font-size: 13px; color: rgba(255,255,255,0.6); }
.modal-close  {
  background: none; border: none;
  color: rgba(255,255,255,0.7);
  font-size: 24px; cursor: pointer; line-height: 1;
}
.modal-close:hover { color: #fff; }
.modal-body { padding: 24px; }

.detail-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 20px;
}
.detail-item { display: flex; flex-direction: column; gap: 6px; }
.detail-label { font-size: 12px; color: #6c757d; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
.detail-val { font-size: 15px; font-weight: 500; }

/* 리스크 점수 섹션 */
.score-section {
  background: #f8f9fa;
  border-radius: 10px;
  padding: 16px;
  margin-bottom: 16px;
}
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

.summary-box {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 16px;
}
.summary-label { font-size: 12px; color: #6c757d; font-weight: 600; margin-bottom: 8px; text-transform: uppercase; }
.summary-text  { font-size: 14px; line-height: 1.7; color: #495057; }
</style>
