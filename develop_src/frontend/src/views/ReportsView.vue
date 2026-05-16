<template>
  <div>
    <div class="page-header">
      <div>
        <h1 class="page-title">리포트 목록</h1>
        <p class="page-desc">분석된 애널리스트 리포트 전체 목록입니다.</p>
      </div>
      <div class="filter-group">
        <select v-model="filterOpinion" class="select">
          <option value="">전체 의견</option>
          <option value="Buy">매수 (Buy)</option>
          <option value="Hold">중립 (Hold)</option>
          <option value="Sell">매도 (Sell)</option>
        </select>
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
                <th>투자의견</th>
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
                  <span :class="opinionClass(r.opinion)" class="badge">
                    {{ r.opinion || '-' }}
                  </span>
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
              <span class="detail-label">투자의견</span>
              <span :class="opinionClass(selected.opinion)" class="badge">{{ selected.opinion || '-' }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">목표주가</span>
              <span class="detail-val price-large">{{ formatPrice(selected.target_price) }}</span>
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
const filterOpinion = ref('')
const sortKey = ref('report_date')
const sortDir = ref('desc')
const selected = ref(null)

const filtered = computed(() => {
  let list = reports.value
  if (filterOpinion.value) list = list.filter(r => r.opinion === filterOpinion.value)
  return [...list].sort((a, b) => {
    const av = a[sortKey.value] ?? ''
    const bv = b[sortKey.value] ?? ''
    if (av < bv) return sortDir.value === 'asc' ? -1 : 1
    if (av > bv) return sortDir.value === 'asc' ? 1 : -1
    return 0
  })
})

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
  margin-bottom: 20px;
}
.page-title { font-size: 22px; font-weight: 700; }
.page-desc  { font-size: 13px; color: #6c757d; margin-top: 4px; }

.filter-group { display: flex; gap: 10px; align-items: center; }
.select {
  padding: 8px 12px;
  border: 1px solid #ced4da;
  border-radius: 8px;
  font-size: 14px;
  background: #fff;
  cursor: pointer;
}

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
  width: 100%; max-width: 540px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
  overflow: hidden;
}
.modal-header {
  display: flex; align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  background: #1a1a2e;
  color: #fff;
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

.summary-box {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 16px;
}
.summary-label { font-size: 12px; color: #6c757d; font-weight: 600; margin-bottom: 8px; text-transform: uppercase; }
.summary-text  { font-size: 14px; line-height: 1.7; color: #495057; }
</style>
