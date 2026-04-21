<!-- src/views/WeekView.vue -->
<template>
  <PullRefresh @refresh="onRefresh">
  <div class="view">
    <!-- Hero -->
    <motion.header
      class="hero hero--primary"
      :initial="{ opacity: 0, y: 30 }"
      :animate="{ opacity: 1, y: 0 }"
      :transition="{ duration: 0.45, ease: 'easeOut' }"
    >
      <div class="status-bar" aria-hidden="true">
        <span>{{ formattedDate }}</span>
      </div>
      <div class="hero__content">
        <p class="hero__eyebrow">最近場次</p>
        <h1 class="hero__title">
          {{ sessionDateLabel }}<br>{{ config.time_start }}–{{ config.time_end }}
        </h1>
        <p class="hero__meta"><MapPin :size="13" :stroke-width="2.5" class="hero__meta-icon" /> {{ config.venue_name }}</p>
      </div>
    </motion.header>

    <!-- Sheet -->
    <motion.main
      class="sheet"
      :initial="{ opacity: 0, y: 40 }"
      :animate="{ opacity: 1, y: 0 }"
      :transition="{ duration: 0.5, ease: 'easeOut', delay: 0.12 }"
    >
      <!-- 骨架屏 -->
      <div v-if="store.loading" class="skeleton-state" aria-label="載入中">
        <!-- count row skeleton -->
        <div class="count-row">
          <SkeletonBlock width="44px" height="40px" radius="8px" />
          <div style="flex: 1;">
            <SkeletonBlock width="80px" height="14px" radius="6px" />
            <SkeletonBlock width="120px" height="12px" radius="6px" style="margin-top: 6px;" />
          </div>
        </div>
        <!-- attendee grid skeleton -->
        <div class="attendee-grid">
          <div v-for="n in 8" :key="n" class="skeleton-chip">
            <SkeletonBlock width="40px" height="40px" radius="50%" />
            <SkeletonBlock width="80%" height="12px" radius="6px" />
          </div>
        </div>
      </div>

      <!-- 尚未設定 -->
      <div v-else-if="!currentSession" class="empty-state">
        <p class="empty-state__icon"><CalendarOff :size="48" :stroke-width="1.5" /></p>
        <p class="empty-state__title">目前無即將到來的場次</p>
        <p class="empty-state__sub">管理員稍後會更新…</p>
      </div>

      <!-- 有名單 -->
      <template v-else>
        <motion.div
          class="count-row"
          role="status"
          aria-live="polite"
          :initial="{ opacity: 0, y: 16 }"
          :animate="{ opacity: 1, y: 0 }"
          :transition="{ duration: 0.4, ease: 'easeOut' }"
        >
          <span class="count-num" :aria-label="`${attendees.length} 人出席`">
            {{ attendees.length }}
          </span>
          <div>
            <p class="count-desc">人確認出席</p>
            <p class="count-sub">{{ lastUpdatedLabel }}</p>
          </div>
        </motion.div>

        <div class="attendee-grid" role="list" aria-label="出席成員">
          <AttendeeChip
            v-for="(att, i) in attendees"
            :key="att.id"
            :name="att.name"
            :delay="i * 0.05"
          />
        </div>
      </template>

    </motion.main>

    <!-- 管理員：編輯本週名單 FAB（在 motion.main 外避免 transform 影響 fixed 定位）-->
    <motion.button
      v-if="store.isAdmin && currentSession"
      class="fab"
      aria-label="編輯此場名單"
      :initial="{ scale: 0, opacity: 0 }"
      :animate="{ scale: 1, opacity: 1 }"
      :transition="{ type: 'spring', stiffness: 400, damping: 20, delay: 0.3 }"
      :whileHover="{ scale: 1.1 }"
      :whilePress="{ scale: 0.9 }"
      @click="editCurrentSession"
    >
      <Pencil :size="22" :stroke-width="2.2" />
    </motion.button>
  </div>
  </PullRefresh>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { motion } from 'motion-v'
import { MapPin, CalendarOff, Pencil } from 'lucide-vue-next'
import { useAppStore } from '../stores/app.js'
import { getTodayStr } from '../utils/date.js'
import AttendeeChip from '../components/AttendeeChip.vue'
import SkeletonBlock from '../components/SkeletonBlock.vue'
import PullRefresh from '../components/PullRefresh.vue'

const store  = useAppStore()
const router = useRouter()

async function onRefresh({ done, fail }) {
  try { await store.refresh(); done() }
  catch (e) { fail(e) }
}

function editCurrentSession() {
  router.push({ path: '/sessions', query: { date: currentSession.value.date } })
}

const config = computed(() => store.config)

// 找今天（含）之後最近的場次
const currentSession = computed(() => {
  const today = getTodayStr()
  const future = store.sessions
    .filter(s => s.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
  return future[0] ?? null
})

const attendees = computed(() =>
  currentSession.value?.attendances ?? []
)

// hero 大標：顯示最近場次日期
const sessionDateLabel = computed(() => {
  if (!currentSession.value) return ''
  const d = new Date(currentSession.value.date + 'T00:00:00')
  return new Intl.DateTimeFormat('zh-TW', {
    month: 'numeric', day: 'numeric', weekday: 'short',
  }).format(d)
})

// status bar 右上角
const formattedDate = computed(() => {
  if (!currentSession.value) return ''
  const d = new Date(currentSession.value.date + 'T00:00:00')
  return new Intl.DateTimeFormat('zh-TW', {
    year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short',
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
  padding: var(--status-bar-height, env(safe-area-inset-top, 44px)) 22px 2px;
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
.hero__meta { font-size: 13px; opacity: 0.8; display: flex; align-items: center; gap: 4px; }
.hero__meta-icon { flex-shrink: 0; }

.sheet {
  flex: 1;
  background: var(--background);
  border-radius: 24px 24px 0 0;
  padding: 20px 16px calc(80px + env(safe-area-inset-bottom, 0px));
  margin-top: -20px;
}

.skeleton-state { display: flex; flex-direction: column; gap: 14px; }
.skeleton-chip {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 12px 4px 10px;
  border-radius: var(--radius-sm);
  background: var(--surface);
  border: 1px solid var(--border);
}

.empty-state {
  text-align: center;
  padding: 48px 16px;
}
.empty-state__icon { margin-bottom: 12px; color: var(--text-tertiary); }
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

.attendee-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

/* Admin FAB */
.fab {
  position: fixed;
  bottom: calc(72px + env(safe-area-inset-bottom, 0px));
  right: max(16px, calc((100vw - 480px) / 2 + 16px));
  width: 56px; height: 56px;
  border-radius: 50%;
  background: var(--secondary);
  color: var(--on-secondary);
  border: none;
  font-size: 22px;
  cursor: pointer;
  box-shadow: 0 4px 18px rgba(1, 135, 134, 0.35);
  touch-action: manipulation;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  z-index: 50;
  display: flex; align-items: center; justify-content: center;
}
</style>
