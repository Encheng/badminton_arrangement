<!-- src/components/SessionCard.vue -->
<template>
  <li class="card" :class="{ 'card--future': isFuture, 'card--current': isCurrent }">
    <div class="card__header">
      <time class="card__date" :datetime="session.date">
        {{ formattedDate }}
      </time>
      <span v-if="isCurrent" class="card__badge card__badge--current">本週</span>
      <span v-else-if="isFuture" class="card__badge card__badge--future">預定</span>
    </div>
    <p class="card__names">{{ nameList || '尚未安排人員' }}</p>
    <div class="card__footer">
      <span class="card__count">
        {{ session.attendances.length }} 人{{ isFuture ? '預定' : '出席' }}
      </span>
      <div v-if="editable" class="card__actions">
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
          @click="$emit('delete', session)"
        >
          刪除
        </button>
      </div>
    </div>
  </li>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  session:   { type: Object, required: true },
  isFuture:  { type: Boolean, default: false },
  isCurrent: { type: Boolean, default: false },
  editable:  { type: Boolean, default: false },
})

defineEmits(['edit', 'delete'])

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
.card__delete-btn:active {
  background: var(--error, #cf6679);
  color: #fff;
}
@media (hover: hover) {
  .card__edit-btn:hover {
    background: var(--primary);
    color: var(--on-primary);
  }
  .card__delete-btn:hover {
    background: var(--error, #cf6679);
    color: #fff;
  }
}
</style>
