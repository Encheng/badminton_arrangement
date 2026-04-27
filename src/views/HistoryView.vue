<!-- src/views/HistoryView.vue -->
<template>
  <div class="view">
    <motion.header
      class="hero hero--variant"
      :initial="{ opacity: 0, y: 30 }"
      :animate="{ opacity: 1, y: 0 }"
      :transition="{ duration: 0.45, ease: 'easeOut' }"
    >
      <div class="status-bar" aria-hidden="true"></div>
      <div class="hero__content">
        <p class="hero__eyebrow">出席紀錄</p>
        <h1 class="hero__title">歷史記錄</h1>
        <p class="hero__meta">共 {{ pastSessions.length }} 週 · 平均 {{ avgAttendance }} 人</p>
      </div>
    </motion.header>

    <motion.main
      class="sheet"
      :initial="{ opacity: 0, y: 40 }"
      :animate="{ opacity: 1, y: 0 }"
      :transition="{ duration: 0.5, ease: 'easeOut', delay: 0.12 }"
    >
      <!-- 骨架屏 -->
      <div v-if="store.loading" class="skeleton-state" aria-label="載入中">
        <div v-for="n in 4" :key="n" class="skeleton-card">
          <SkeletonBlock width="120px" height="12px" radius="6px" />
          <SkeletonBlock width="100%" height="14px" radius="6px" style="margin-top: 6px;" />
          <SkeletonBlock width="50%" height="14px" radius="6px" style="margin-top: 4px;" />
          <SkeletonBlock width="70px" height="12px" radius="6px" style="margin-top: 8px;" />
        </div>
      </div>

      <div v-else-if="!pastSessions.length" class="empty-state">
        <p class="empty-state__icon">📋</p>
        <p class="empty-state__title">尚無歷史記錄</p>
      </div>
      <ol v-else aria-label="歷史出席記錄" class="list">
        <HistoryCard
          v-for="session in pastSessions"
          :key="session.session_id"
          :session="session"
          :video-count="(store.videosByDate[session.date] || []).length"
          @view-videos="openVideoModal(session)"
        />
      </ol>
        <VideoListModal
          v-model:show="videoModalOpen"
          :session-date="selectedSessionDate"
          :videos="selectedSessionVideos"
        />
    </motion.main>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { motion } from 'motion-v'
import { useAppStore } from '../stores/app.js'
import HistoryCard from '../components/HistoryCard.vue'
import SkeletonBlock from '../components/SkeletonBlock.vue'
import VideoListModal from '../components/VideoListModal.vue'

const store = useAppStore()

const pastSessions = computed(() => {
  const today = new Date().toISOString().slice(0, 10)
  return store.sessions
    .filter(s => s.date < today)
    .sort((a, b) => b.date.localeCompare(a.date))
})

const avgAttendance = computed(() => {
  if (!pastSessions.value.length) return '0'
  const total = pastSessions.value.reduce((sum, s) => sum + s.attendances.length, 0)
  return (total / pastSessions.value.length).toFixed(1)
})

const videoModalOpen = ref(false)
const selectedSession = ref(null)
function openVideoModal(session) {
  selectedSession.value = session
  videoModalOpen.value = true
}
const selectedSessionDate = computed(() => selectedSession.value?.date || '')
const selectedSessionVideos = computed(() =>
  selectedSession.value ? store.videosByDate[selectedSession.value.date] || [] : []
)
</script>

<style scoped>
.view { min-height: 100dvh; display: flex; flex-direction: column; }
.hero--variant { background: var(--primary-variant); }

.status-bar { height: var(--status-bar-height, env(safe-area-inset-top, 44px)); }
.hero__content { padding: 4px 22px 30px; color: var(--on-primary); }
.hero__eyebrow {
  font-size: 11px; font-weight: 600; text-transform: uppercase;
  letter-spacing: 1.2px; opacity: 0.75; margin-bottom: 6px;
}
.hero__title {
  font-size: 28px; font-weight: 800;
  letter-spacing: -0.6px; line-height: 1.15; margin-bottom: 6px;
  text-wrap: balance;
}
.hero__meta { font-size: 13px; opacity: 0.8; }

.sheet {
  flex: 1;
  background: var(--background);
  border-radius: 24px 24px 0 0;
  padding: 20px 16px calc(80px + env(safe-area-inset-bottom, 0px));
  margin-top: -20px;
}

.list { display: flex; flex-direction: column; gap: 10px; }

.skeleton-state { display: flex; flex-direction: column; gap: 10px; }
.skeleton-card {
  background: var(--surface);
  border-radius: var(--radius-md);
  padding: 14px 16px;
  border: 1px solid var(--border);
}

.empty-state {
  text-align: center; padding: 48px 16px;
}
.empty-state__icon  { font-size: 48px; margin-bottom: 12px; }
.empty-state__title { font-size: 16px; font-weight: 600; }
</style>
