<!-- src/components/HistoryCard.vue -->
<template>
  <motion.li
    class="card"
    :initial="{ opacity: 0, y: 16 }"
    :animate="{ opacity: 1, y: 0 }"
    :transition="{ duration: 0.3, ease: 'easeOut' }"
    :whileHover="{ y: -2, boxShadow: '0 6px 20px rgba(0,0,0,0.08)' }"
  >
    <time class="card__date" :datetime="session.date">
      {{ formattedDate }}
    </time>
    <p class="card__names">{{ nameList }}</p>
    <div class="card__footer">
      <p class="card__count">
        {{ session.attendances.length }} 人出席
      </p>
      <button
        v-if="videoCount > 0"
        class="card__videos-btn"
        @click.stop="handleViewVideos"
      >
        <Video :size="14" :stroke-width="2" />
        {{ videoCount }} 支影片
      </button>
    </div>
  </motion.li>
</template>

<script setup>
import { computed } from 'vue'
import { motion } from 'motion-v'
import { Video } from 'lucide-vue-next'
import { trackVideoButtonClick } from '../utils/analytics'

const props = defineProps({
  session:    { type: Object,  required: true },
  videoCount: { type: Number,  default: 0 },
})

const emit = defineEmits(['view-videos'])

function handleViewVideos() {
  // 追蹤：點擊「N 支影片」按鈕
  trackVideoButtonClick({
    sessionDate: props.session.date,
    videoCount: props.videoCount,
    source: 'history_card',
  })
  emit('view-videos')
}

const formattedDate = computed(() => {
  const d = new Date(props.session.date + 'T00:00:00')
  return new Intl.DateTimeFormat('zh-TW', {
    year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short',
  }).format(d)
})

const nameList = computed(() =>
  props.session.attendances.map(a => a.name).join('、')
)
</script>

<style scoped>
.card {
  background: var(--surface);
  border-radius: var(--radius-md);
  padding: 14px 16px;
  border: 1px solid var(--border);
  box-shadow: var(--shadow-sm);
  list-style: none;
}
.card__date  { font-size: 12px; color: var(--text-tertiary); margin-bottom: 3px; display: block; }
.card__names {
  font-size: 14px; font-weight: 600; color: var(--text-primary);
  margin-bottom: 4px;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.card__footer {
  display: flex; align-items: center; justify-content: space-between;
}
.card__count { font-size: 12px; font-weight: 700; color: var(--secondary-variant); font-variant-numeric: tabular-nums; }
.card__videos-btn {
  background: none;
  border: 1.5px solid var(--primary);
  color: var(--primary);
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 700;
  display: inline-flex; align-items: center; gap: 4px;
  cursor: pointer;
  touch-action: manipulation;
  transition: background 0.15s ease, color 0.15s ease;
}
.card__videos-btn:active {
  background: var(--primary);
  color: var(--on-primary);
}
@media (hover: hover) {
  .card__videos-btn:hover {
    background: var(--primary);
    color: var(--on-primary);
  }
}
</style>
