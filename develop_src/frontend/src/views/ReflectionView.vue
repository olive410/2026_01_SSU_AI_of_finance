<template>
  <div>
    <div class="page-header">
      <div>
        <h1 class="page-title">AI 반성 (Reflection)</h1>
        <p class="page-desc">
          AI 투자 판단 패턴을 분석하고 매수/매도 의견 산출 로직을 자기 개선합니다.
          <span class="label-note">KRX 검증 데이터 5건 이상 시 실제 수익률 기반으로 전환됩니다.</span>
        </p>
      </div>
      <button class="btn btn-primary" :disabled="running" @click="runReflection">
        <span v-if="running"><span class="spinner"></span> 반성 실행 중...</span>
        <span v-else>반성 실행</span>
      </button>
    </div>

    <div v-if="runError" class="error-box mb-16">{{ runError }}</div>

    <!-- 최근 반성 결과 -->
    <div v-if="latest" class="card mb-16">
      <div class="result-header">
        <div>
          <span class="mode-badge" :class="latest.mode === 'verified' ? 'mode-verified' : 'mode-preliminary'">
            {{ latest.mode === 'verified' ? 'KRX 검증 모드' : '예비 반성 모드' }}
          </span>
          <span class="result-date">{{ formatDate(latest.created_at) }}</span>
        </div>
        <span class="sample-label">분석 {{ latest.sample_size }}건</span>
      </div>

      <!-- 성과 지표 (검증 모드) -->
      <div v-if="latest.mode === 'verified'" class="metrics-grid">
        <div class="metric-card">
          <div class="metric-label">전체 적중률</div>
          <div class="metric-val" :class="rateClass(latest.overall_hit_rate)">
            {{ latest.overall_hit_rate != null ? latest.overall_hit_rate + '%' : '-' }}
          </div>
        </div>
        <div class="metric-card buy">
          <div class="metric-label">Buy 적중률</div>
          <div class="metric-val">{{ latest.buy_hit_rate != null ? latest.buy_hit_rate + '%' : '-' }}</div>
        </div>
        <div class="metric-card hold">
          <div class="metric-label">Hold 적중률</div>
          <div class="metric-val">{{ latest.hold_hit_rate != null ? latest.hold_hit_rate + '%' : '-' }}</div>
        </div>
        <div class="metric-card sell">
          <div class="metric-label">Sell 적중률</div>
          <div class="metric-val">{{ latest.sell_hit_rate != null ? latest.sell_hit_rate + '%' : '-' }}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">평균 수익률 (D+5)</div>
          <div class="metric-val" :class="latest.avg_return_pct > 0 ? 'text-buy' : latest.avg_return_pct < 0 ? 'text-sell' : ''">
            {{ latest.avg_return_pct != null ? (latest.avg_return_pct > 0 ? '+' : '') + latest.avg_return_pct + '%' : '-' }}
          </div>
        </div>
        <div class="metric-card">
          <div class="metric-label">의견 일치율</div>
          <div class="metric-val">{{ latest.opinion_match_rate != null ? latest.opinion_match_rate + '%' : '-' }}</div>
        </div>
      </div>

      <!-- 예비 모드 지표 -->
      <div v-else class="metrics-grid">
        <div class="metric-card">
          <div class="metric-label">총 분석 리포트</div>
          <div class="metric-val">{{ latest.sample_size }}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">의견 일치율<br><span class="metric-sub">애널리스트 vs AI</span></div>
          <div class="metric-val">{{ latest.opinion_match_rate != null ? latest.opinion_match_rate + '%' : '-' }}</div>
        </div>
      </div>

      <!-- AI 반성 내용 -->
      <div class="reflection-section">
        <div class="section-label">반성 분석</div>
        <p class="reflection-text">{{ latest.reflection }}</p>
      </div>

      <div v-if="latest.bias_found" class="bias-box">
        <div class="bias-label">발견된 편향</div>
        <p class="bias-text">{{ latest.bias_found }}</p>
      </div>

      <div v-if="parsedSuggestions(latest).length" class="suggestions-section">
        <div class="section-label">개선 제안</div>
        <ul class="suggestion-list">
          <li v-for="(s, i) in parsedSuggestions(latest)" :key="i" class="suggestion-item">
            <span class="suggestion-num">{{ i + 1 }}</span>
            {{ s }}
          </li>
        </ul>
      </div>

      <div v-if="latest.prompt_hint" class="hint-box">
        <div class="hint-label">프롬프트 개선 힌트</div>
        <p class="hint-text">{{ latest.prompt_hint }}</p>
      </div>
    </div>

    <!-- 반성 이력 -->
    <div class="card">
      <div class="section-header-row">
        <h2 class="section-title">반성 이력</h2>
      </div>
      <div v-if="loading" class="loading-text">로딩 중...</div>
      <div v-else-if="logs.length === 0" class="empty-text">
        반성 기록이 없습니다. 위 버튼으로 첫 번째 반성을 실행하세요.
      </div>
      <div v-else class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>실행 일시</th>
              <th>모드</th>
              <th>분석 건수</th>
              <th>전체 적중률</th>
              <th>의견 일치율</th>
              <th>발견 편향</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="log in logs" :key="log.id" class="table-row" @click="viewLog(log)">
              <td>{{ formatDate(log.created_at) }}</td>
              <td>
                <span class="mode-badge" :class="log.mode === 'verified' ? 'mode-verified' : 'mode-preliminary'">
                  {{ log.mode === 'verified' ? '검증' : '예비' }}
                </span>
              </td>
              <td>{{ log.sample_size }}</td>
              <td>{{ log.overall_hit_rate != null ? log.overall_hit_rate + '%' : '-' }}</td>
              <td>{{ log.opinion_match_rate != null ? log.opinion_match_rate + '%' : '-' }}</td>
              <td class="bias-cell">{{ log.bias_found ? log.bias_found.slice(0, 40) + '…' : '-' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 이력 상세 모달 -->
    <div v-if="selected" class="modal-backdrop" @click.self="selected = null">
      <div class="modal">
        <div class="modal-header">
          <div>
            <span class="mode-badge" :class="selected.mode === 'verified' ? 'mode-verified' : 'mode-preliminary'">
              {{ selected.mode === 'verified' ? 'KRX 검증' : '예비 반성' }}
            </span>
            <span class="modal-date">{{ formatDate(selected.created_at) }}</span>
          </div>
          <button class="modal-close" @click="selected = null">&times;</button>
        </div>
        <div class="modal-body">
          <div class="reflection-section">
            <div class="section-label">반성 분석</div>
            <p class="reflection-text">{{ selected.reflection }}</p>
          </div>
          <div v-if="selected.bias_found" class="bias-box">
            <div class="bias-label">발견된 편향</div>
            <p class="bias-text">{{ selected.bias_found }}</p>
          </div>
          <div v-if="parsedSuggestions(selected).length" class="suggestions-section">
            <div class="section-label">개선 제안</div>
            <ul class="suggestion-list">
              <li v-for="(s, i) in parsedSuggestions(selected)" :key="i" class="suggestion-item">
                <span class="suggestion-num">{{ i + 1 }}</span>{{ s }}
              </li>
            </ul>
          </div>
          <div v-if="selected.prompt_hint" class="hint-box">
            <div class="hint-label">프롬프트 개선 힌트</div>
            <p class="hint-text">{{ selected.prompt_hint }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'

const logs = ref([])
const latest = ref(null)
const loading = ref(false)
const running = ref(false)
const runError = ref(null)
const selected = ref(null)

async function fetchLogs() {
  loading.value = true
  try {
    const res = await axios.get('/api/reflection')
    logs.value = res.data.data || []
    latest.value = logs.value[0] || null
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

async function runReflection() {
  running.value = true
  runError.value = null
  try {
    const res = await axios.post('/api/reflection/run')
    await fetchLogs()
    latest.value = res.data.data
  } catch (e) {
    runError.value = e.response?.data?.error || e.message
  } finally {
    running.value = false
  }
}

function viewLog(log) {
  selected.value = log
}

function parsedSuggestions(log) {
  if (!log?.adjustment_suggestions) return []
  try {
    const parsed = JSON.parse(log.adjustment_suggestions)
    return Array.isArray(parsed) ? parsed : []
  } catch { return [] }
}

function formatDate(val) {
  if (!val) return '-'
  return new Date(val).toLocaleString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

function rateClass(rate) {
  if (rate == null) return ''
  if (rate >= 60) return 'text-buy'
  if (rate >= 45) return 'text-hold'
  return 'text-sell'
}

onMounted(fetchLogs)
</script>

<style scoped>
.page-header {
  display: flex; align-items: flex-start;
  justify-content: space-between; gap: 16px;
  margin-bottom: 20px;
}
.page-title { font-size: 22px; font-weight: 700; }
.page-desc  { font-size: 13px; color: #6c757d; margin-top: 4px; }
.label-note { color: #e94560; font-weight: 600; }
.mb-16 { margin-bottom: 16px; }

.result-header {
  display: flex; align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}
.mode-badge {
  display: inline-block;
  padding: 3px 10px; border-radius: 20px;
  font-size: 12px; font-weight: 700;
  margin-right: 10px;
}
.mode-verified    { background: #d4edda; color: #155724; }
.mode-preliminary { background: #fff3cd; color: #856404; }
.result-date { font-size: 13px; color: #6c757d; }
.sample-label { font-size: 13px; color: #6c757d; }

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 24px;
}
.metric-card {
  background: #f8f9fa;
  border-radius: 10px;
  padding: 16px;
  border-left: 4px solid #ced4da;
}
.metric-card.buy  { border-left-color: #28a745; }
.metric-card.hold { border-left-color: #ffc107; }
.metric-card.sell { border-left-color: #dc3545; }
.metric-label { font-size: 12px; color: #6c757d; font-weight: 600; margin-bottom: 6px; line-height: 1.4; }
.metric-sub   { font-weight: 400; }
.metric-val   { font-size: 24px; font-weight: 700; color: #1a1a2e; }
.text-buy  { color: #28a745; }
.text-hold { color: #e67e00; }
.text-sell { color: #dc3545; }

.reflection-section { margin-bottom: 16px; }
.section-label {
  font-size: 12px; color: #6c757d;
  font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.5px; margin-bottom: 8px;
}
.reflection-text { font-size: 14px; line-height: 1.7; color: #495057; }

.bias-box {
  background: #fff3cd;
  border-radius: 8px; padding: 14px;
  margin-bottom: 16px;
}
.bias-label { font-size: 12px; color: #856404; font-weight: 700; margin-bottom: 6px; }
.bias-text  { font-size: 14px; color: #533f03; line-height: 1.6; }

.suggestions-section { margin-bottom: 16px; }
.suggestion-list { list-style: none; display: flex; flex-direction: column; gap: 8px; }
.suggestion-item {
  display: flex; align-items: flex-start; gap: 10px;
  font-size: 14px; color: #495057; line-height: 1.6;
}
.suggestion-num {
  flex-shrink: 0;
  width: 22px; height: 22px;
  background: #e94560; color: #fff;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 700;
}

.hint-box {
  background: #e8f4f8;
  border-radius: 8px; padding: 14px;
}
.hint-label { font-size: 12px; color: #0c5460; font-weight: 700; margin-bottom: 6px; }
.hint-text  { font-size: 14px; color: #0c5460; line-height: 1.6; font-style: italic; }

.section-header-row {
  display: flex; align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.section-title { font-size: 17px; font-weight: 700; }

.table-wrap { overflow-x: auto; }
.table { width: 100%; border-collapse: collapse; font-size: 14px; }
.table th {
  background: #f8f9fa; padding: 11px 14px;
  text-align: left; font-weight: 600;
  font-size: 13px; color: #495057;
  border-bottom: 2px solid #dee2e6;
  white-space: nowrap;
}
.table td { padding: 12px 14px; border-bottom: 1px solid #f0f2f5; vertical-align: middle; }
.table-row { cursor: pointer; transition: background 0.15s; }
.table-row:hover { background: #f8f9fa; }
.bias-cell { font-size: 13px; color: #856404; max-width: 200px; }

.loading-text, .empty-text {
  text-align: center; color: #6c757d;
  padding: 40px 0; font-size: 14px;
}
.error-box {
  background: #fff2f0; border: 1px solid #ffa39e;
  border-radius: 8px; padding: 12px 16px;
  color: #cf1322; font-size: 13px;
}

/* 모달 */
.modal-backdrop {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.45);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000; padding: 20px;
}
.modal {
  background: #fff; border-radius: 14px;
  width: 100%; max-width: 600px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
  overflow: hidden; max-height: 90vh; overflow-y: auto;
}
.modal-header {
  display: flex; align-items: center;
  justify-content: space-between;
  padding: 18px 24px;
  background: #1a1a2e; color: #fff;
  position: sticky; top: 0;
}
.modal-date  { font-size: 13px; color: rgba(255,255,255,0.6); }
.modal-close {
  background: none; border: none;
  color: rgba(255,255,255,0.7); font-size: 24px;
  cursor: pointer; line-height: 1;
}
.modal-close:hover { color: #fff; }
.modal-body { padding: 24px; }

.spinner {
  display: inline-block; width: 14px; height: 14px;
  border: 2px solid rgba(255,255,255,0.4);
  border-top-color: #fff; border-radius: 50%;
  animation: spin 0.7s linear infinite; vertical-align: middle;
}
@keyframes spin { to { transform: rotate(360deg); } }

@media (max-width: 768px) {
  .metrics-grid { grid-template-columns: repeat(2, 1fr); }
}
</style>
