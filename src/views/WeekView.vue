<!-- src/views/WeekView.vue -->
<template>
  <div class="view">
    <!-- Hero -->
    <header class="hero hero--primary">
      <div class="status-bar" aria-hidden="true">
        <span>{{ formattedDate }}</span>
      </div>
      <div class="hero__content">
        <p class="hero__eyebrow">本週場次</p>
        <h1 class="hero__title">
          {{ sessionDateLabel }}<br>{{ config.time_start }}–{{ config.time_end }}
        </h1>
        <p class="hero__meta">📍 {{ config.venue_name }}</p>
      </div>
    </header>

    <!-- Sheet -->
    <main class="sheet">
      <!-- 尚未設定 -->
      <div v-if="!currentSession" class="empty-state">
        <p class="empty-state__icon">🏸</p>
        <p class="empty-state__title">本週名單尚未設定</p>
        <p class="empty-state__sub">管理員稍後會更新…</p>
      </div>

      <!-- 有名單 -->
      <template v-else>
        <div class="count-row" role="status" aria-live="polite">
          <span class="count-num" :aria-label="`${attendees.length} 人出席`">
            {{ attendees.length }}
          </span>
          <div>
            <p class="count-desc">人確認出席</p>
            <p class="count-sub">{{ lastUpdatedLabel }}</p>
          </div>
        </div>

        <div class="chip-wrap" role="list" aria-label="出席成員">
          <AttendeeChip
            v-for="att in attendees"
            :key="att.id"
            :name="att.name"
            :type="att.type"
          />
        </div>
      </template>
    </main>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useAppStore } from '../stores/app.js'
import AttendeeChip from '../components/AttendeeChip.vue'

const store = useAppStore()

const config = computed(() => store.config)

const formattedDate = new Intl.DateTimeFormat('zh-TW', {
  month: 'numeric', day: 'numeric', weekday: 'short',
}).format(new Date())

// 找最近未來（或今日）的場次
const currentSession = computed(() => {
  const today = new Date().toISOString().slice(0, 10)
  return store.sessions.find(s => s.date >= today) ??
         store.sessions[0] ?? null
})

const attendees = computed(() =>
  currentSession.value?.attendances ?? []
)

const sessionDateLabel = computed(() => {
  if (!currentSession.value) return '—'
  const d = new Date(currentSession.value.date + 'T00:00:00')
  return new Intl.DateTimeFormat('zh-TW', {
    month: 'numeric', day: 'numeric', weekday: 'short',
  }).format(d)
})

const lastUpdatedLabel = computed(() => {
  if (!currentSession.value) return ''
  const d = new Date(currentSession.value.created_at)
  return `由管理員更新於 ${d.getMonth() + 1}/${d.getDate()}`
})
</script>

<style scoped>
.view { min-height: 100dvh; display: flex; flex-direction: column; }

.hero { padding-bottom: 0; }
.hero--primary { background: var(--primary); }
.status-bar {
  display: flex;
  justify-content: flex-end;
  padding: 14px 22px 2px;
  font-size: 12px;
  font-weight: 600;
  color: var(--on-primary);
}
.hero__content { padding: 4px 22px 30px; color: var(--on-primary); }
.hero__eyebrow {
  font-size: 11px; font-weight: 600; text-transform: uppercase;
  letter-spacing: 1.2px; opacity: 0.75; margin-bottom: 6px;
}
.hero__title {
  font-size: 28px; font-weight: 800;
  letter-spacing: -0.6px; line-height: 1.15;
  text-wrap: balance; margin-bottom: 6px;
}
.hero__meta { font-size: 13px; opacity: 0.8; }

.sheet {
  flex: 1;
  background: var(--background);
  border-radius: 24px 24px 0 0;
  padding: 20px 16px calc(80px + env(safe-area-inset-bottom, 0px));
  margin-top: -20px;
}

.empty-state {
  text-align: center;
  padding: 48px 16px;
}
.empty-state__icon { font-size: 48px; margin-bottom: 12px; }
.empty-state__title { font-size: 16px; font-weight: 600; margin-bottom: 6px; }
.empty-state__sub   { font-size: 13px; color: var(--text-tertiary); }

.count-row {
  background: var(--surface-tinted);
  border-radius: var(--radius-md);
  padding: 14px 16px;
  display: flex; align-items: center; gap: 14px;
  margin-bottom: 14px;
  border: 1px solid rgba(98, 0, 238, 0.12);
}
.count-num {
  font-size: 36px; font-weight: 800;
  color: var(--primary);
  font-variant-numeric: tabular-nums;
  line-height: 1;
}
.count-desc { font-size: 14px; font-weight: 600; }
.count-sub  { font-size: 12px; color: var(--text-tertiary); margin-top: 2px; }

.chip-wrap  { display: flex; flex-wrap: wrap; gap: 8px; }
</style>
