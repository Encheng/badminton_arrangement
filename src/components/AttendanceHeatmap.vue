<!-- src/components/AttendanceHeatmap.vue -->
<template>
  <div v-if="yearOptions.length" class="heatmap-wrap">
    <div class="heatmap-header">
      <h2 class="section-heading" :id="headingId">出席紀錄</h2>
      <div v-if="yearOptions.length > 1" class="year-pills" role="tablist" aria-label="選擇年份">
        <button
          v-for="y in yearOptions"
          :key="y"
          class="year-pill"
          :class="{ 'year-pill--active': y === selectedYear }"
          role="tab"
          :aria-selected="y === selectedYear"
          @click="selectYear(y)"
        >
          {{ y }}
        </button>
      </div>
    </div>

    <p class="heatmap-summary">
      {{ selectedYear }} 年出席
      <strong class="heatmap-summary__num">{{ attendedCount }}</strong> / {{ totalCount }} 場
      <span class="heatmap-summary__rate">（{{ ratePct }}%）</span>
    </p>

    <div class="heatmap" role="list" :aria-labelledby="headingId">
      <div
        v-for="row in monthRows"
        :key="row.month"
        class="heatmap-row"
        role="listitem"
      >
        <span class="heatmap-month">{{ row.month }}月</span>
        <div class="heatmap-cells">
          <button
            v-for="cell in row.cells"
            :key="cell.date"
            type="button"
            class="cell"
            :class="[
              cell.attended ? 'cell--on' : 'cell--off',
              { 'cell--selected': selectedCell?.date === cell.date },
            ]"
            :aria-label="`${cell.label}，${cell.attended ? '有出席' : '未出席'}`"
            @click="toggleCell(cell)"
          ></button>
        </div>
      </div>
    </div>

    <p class="cell-info" aria-live="polite">
      <template v-if="selectedCell">
        {{ selectedCell.label }} ·
        <span :class="selectedCell.attended ? 'cell-info--on' : 'cell-info--off'">
          {{ selectedCell.attended ? '✓ 有出席' : '— 未出席' }}
        </span>
      </template>
      <template v-else>點擊格子查看單場資訊</template>
    </p>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useAppStore } from '../stores/app.js'
import { excludeFutureSessions } from '../utils/stats.js'

const props = defineProps({
  memberId: { type: String, required: true },
})

const store = useAppStore()
const headingId = `heatmap-heading-${props.memberId}`

// 只看已發生的場次，由舊到新
const pastSessions = computed(() =>
  excludeFutureSessions(store.sessions)
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
)

const yearOptions = computed(() => {
  const years = new Set(pastSessions.value.map(s => s.date.slice(0, 4)))
  return [...years].sort((a, b) => b.localeCompare(a)) // 新年份在前
})

const selectedYear = ref(null)

// 預設選最新年份；資料更新時若所選年份消失則回退
watch(yearOptions, (opts) => {
  if (!opts.includes(selectedYear.value)) {
    selectedYear.value = opts[0] ?? null
  }
}, { immediate: true })

const selectedCell = ref(null)

function selectYear(y) {
  selectedYear.value = y
  selectedCell.value = null
}

function toggleCell(cell) {
  selectedCell.value = selectedCell.value?.date === cell.date ? null : cell
}

const yearSessions = computed(() =>
  pastSessions.value.filter(s => s.date.startsWith(selectedYear.value ?? ''))
)

function didAttend(session) {
  return session.attendances.some(a => a.member_id === props.memberId)
}

function formatLabel(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return new Intl.DateTimeFormat('zh-TW', {
    month: 'numeric', day: 'numeric', weekday: 'short',
  }).format(d)
}

const monthRows = computed(() => {
  const byMonth = new Map()
  for (const s of yearSessions.value) {
    const month = parseInt(s.date.slice(5, 7), 10)
    if (!byMonth.has(month)) byMonth.set(month, [])
    byMonth.get(month).push({
      date: s.date,
      label: formatLabel(s.date),
      attended: didAttend(s),
    })
  }
  // 新月份在上，月內由舊到新
  return [...byMonth.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([month, cells]) => ({ month, cells }))
})

const totalCount = computed(() => yearSessions.value.length)
const attendedCount = computed(() => yearSessions.value.filter(didAttend).length)
const ratePct = computed(() =>
  totalCount.value ? Math.round((attendedCount.value / totalCount.value) * 100) : 0
)
</script>

<style scoped>
.heatmap-wrap { margin-bottom: 4px; }

.heatmap-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.section-heading {
  font-size: 12px; font-weight: 700; color: var(--text-secondary);
  text-transform: uppercase; letter-spacing: 0.8px; margin: 16px 0 10px;
}

.year-pills {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  scrollbar-width: none;
}
.year-pills::-webkit-scrollbar { display: none; }
.year-pill {
  flex-shrink: 0;
  background: var(--surface);
  border: 1.5px solid var(--border);
  border-radius: 14px;
  padding: 3px 10px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  cursor: pointer;
  touch-action: manipulation;
  transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}
.year-pill--active {
  background: var(--primary);
  color: var(--on-primary);
  border-color: var(--primary);
}

.heatmap-summary {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 10px;
}
.heatmap-summary__num {
  color: var(--primary);
  font-size: 15px;
  font-variant-numeric: tabular-nums;
}
.heatmap-summary__rate {
  color: var(--text-tertiary);
  font-variant-numeric: tabular-nums;
}

.heatmap {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.heatmap-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.heatmap-month {
  width: 34px;
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-tertiary);
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.heatmap-cells {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.cell {
  width: 22px;
  height: 22px;
  border-radius: 5px;
  border: none;
  padding: 0;
  cursor: pointer;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  transition: transform 0.12s ease, box-shadow 0.12s ease;
}
.cell:active { transform: scale(0.88); }
.cell--on {
  background: var(--primary);
  box-shadow: inset 0 -2px 0 rgba(0, 0, 0, 0.12);
}
.cell--off {
  background: var(--surface-tinted);
  border: 1.5px solid var(--border);
}
.cell--selected {
  outline: 2px solid var(--secondary-variant);
  outline-offset: 1.5px;
}
.cell:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 1.5px;
}

.cell-info {
  margin-top: 10px;
  font-size: 12px;
  color: var(--text-tertiary);
  min-height: 16px;
  font-variant-numeric: tabular-nums;
}
.cell-info--on  { color: var(--secondary-variant); font-weight: 700; }
.cell-info--off { color: var(--text-tertiary); font-weight: 600; }
</style>
