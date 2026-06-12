<!-- src/components/SessionCard.vue -->
<template>
  <motion.li
    class="card"
    :class="{ 'card--future': isFuture, 'card--current': isCurrent }"
    :initial="{ opacity: 0, y: 20 }"
    :animate="{ opacity: 1, y: 0 }"
    :transition="{ duration: 0.35, ease: 'easeOut' }"
    :whileHover="{ y: -2, boxShadow: '0 6px 20px rgba(0,0,0,0.08)' }"
    :whilePress="{ scale: 0.98 }"
  >
    <div class="card__header">
      <time class="card__date" :datetime="session.date">
        {{ formattedDate }}
      </time>
      <span v-if="isCurrent" class="card__badge card__badge--current">本週</span>
      <span v-else-if="isFuture" class="card__badge card__badge--future">預定</span>
      <span v-if="pending" class="card__badge card__badge--pending">同步中…</span>
    </div>
    <p class="card__names">{{ nameList || '尚未安排人員' }}</p>
    <div class="card__footer">
      <span class="card__count">
        {{ session.attendances.length }} 人{{ isFuture ? '預定' : '出席' }}
      </span>
      <button
        v-if="!isFuture && !isCurrent && videoCount > 0"
        class="card__videos-btn"
        @click.stop="handleViewVideos"
      >
        <Video :size="14" :stroke-width="2" />
        {{ videoCount }} 支影片
      </button>
      <div v-if="editable" class="card__actions">
        <button
          class="card__copy-btn"
          aria-label="複製此場次"
          @click="$emit('copy', session)"
        >
          複製
        </button>
        <button
          class="card__edit-btn"
          aria-label="編輯此場次"
          @click="$emit('edit', session)"
        >
          編輯
        </button>
        <button
          class="card__delete-btn"
          aria-label="刪除此場次"
          :disabled="pending"
          :title="pending ? '同步中，請稍候' : undefined"
          @click="$emit('delete', session)"
        >
          刪除
        </button>
      </div>
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
  isFuture:   { type: Boolean, default: false },
  isCurrent:  { type: Boolean, default: false },
  editable:   { type: Boolean, default: false },
  pending:    { type: Boolean, default: false },
  videoCount: { type: Number,  default: 0 },
})

const emit = defineEmits(['edit', 'delete', 'copy', 'view-videos'])

function handleViewVideos() {
  // 追蹤：點擊「N 支影片」按鈕
  trackVideoButtonClick({
    sessionDate: props.session.date,
    videoCount: props.videoCount,
    source: 'session_card',
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
.card--current {
  border-color: var(--primary);
  border-width: 2px;
  background: var(--surface-tinted, #f5f0ff);
}
.card--future {
  border-color: var(--secondary);
  border-style: dashed;
}

.card__header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 3px;
}
.card__date {
  font-size: 12px;
  color: var(--text-tertiary);
}
.card__badge {
  font-size: 10px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 4px;
  letter-spacing: 0.5px;
}
.card__badge--current {
  background: var(--primary);
  color: var(--on-primary);
}
.card__badge--future {
  background: var(--secondary);
  color: var(--on-secondary);
}
.card__badge--pending {
  background: rgba(98, 0, 238, 0.08);
  color: var(--primary);
  animation: badge-pulse 1.2s ease-in-out infinite;
}
@keyframes badge-pulse {
  50% { opacity: 0.45; }
}

.card__names {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4px;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.card--future .card__names:not(:empty) {
  color: var(--text-secondary);
}

.card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.card__count {
  font-size: 12px;
  font-weight: 700;
  color: var(--secondary-variant);
  font-variant-numeric: tabular-nums;
}
.card__actions {
  display: flex;
  gap: 6px;
}
.card__copy-btn {
  background: none;
  border: 1.5px solid var(--secondary-variant, #018786);
  color: var(--secondary-variant, #018786);
  border-radius: 6px;
  padding: 4px 12px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  touch-action: manipulation;
  transition: background 0.15s ease, color 0.15s ease;
}
.card__copy-btn:active {
  background: var(--secondary-variant, #018786);
  color: #fff;
}
.card__edit-btn {
  background: none;
  border: 1.5px solid var(--primary);
  color: var(--primary);
  border-radius: 6px;
  padding: 4px 12px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  touch-action: manipulation;
  transition: background 0.15s ease, color 0.15s ease;
}
.card__edit-btn:active {
  background: var(--primary);
  color: var(--on-primary);
}
.card__delete-btn {
  background: none;
  border: 1.5px solid var(--error, #cf6679);
  color: var(--error, #cf6679);
  border-radius: 6px;
  padding: 4px 12px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  touch-action: manipulation;
  transition: background 0.15s ease, color 0.15s ease;
}
.card__delete-btn:active:not(:disabled) {
  background: var(--error, #cf6679);
  color: #fff;
}
.card__delete-btn:disabled {
  opacity: 0.35;
  cursor: default;
}
@media (hover: hover) {
  .card__copy-btn:hover {
    background: var(--secondary-variant, #018786);
    color: #fff;
  }
  .card__edit-btn:hover {
    background: var(--primary);
    color: var(--on-primary);
  }
  .card__delete-btn:hover:not(:disabled) {
    background: var(--error, #cf6679);
    color: #fff;
  }
}
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
