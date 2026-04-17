<!-- src/components/RankCard.vue -->
<template>
  <motion.li
    class="rank-card"
    :class="{ 'rank-card--top': rank === 1 }"
    :initial="{ opacity: 0, x: -20 }"
    :animate="{ opacity: 1, x: 0 }"
    :transition="{ duration: 0.35, ease: 'easeOut', delay: rank * 0.06 }"
    :whileHover="{ x: 4, boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }"
  >
    <span class="rank-icon" aria-hidden="true">{{ rankIcon }}</span>
    <div class="rank-body">
      <span class="rank-name">{{ member.name }}</span>
      <div class="rank-bar-bg" role="presentation">
        <motion.div
          class="rank-bar"
          :initial="{ width: '0%' }"
          :animate="{ width: barWidth }"
          :transition="{ duration: 0.6, ease: 'easeOut', delay: 0.2 + rank * 0.06 }"
        />
      </div>
    </div>
    <span class="rank-count" :aria-label="`${count} 次`">
      {{ count }} 次
    </span>
  </motion.li>
</template>

<script setup>
import { computed } from 'vue'
import { motion } from 'motion-v'

const props = defineProps({
  rank:     { type: Number, required: true },
  member:   { type: Object, required: true },
  count:    { type: Number, required: true },
  maxCount: { type: Number, required: true },
})

const rankIcon = computed(() => {
  const icons = { 1: '🥇', 2: '🥈', 3: '🥉' }
  return icons[props.rank] ?? `${props.rank}.`
})

const barWidth = computed(() =>
  props.maxCount > 0 ? `${(props.count / props.maxCount) * 100}%` : '0%'
)
</script>

<style scoped>
.rank-card {
  background: var(--surface);
  border-radius: var(--radius-md);
  padding: 12px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  border: 1px solid var(--border);
  box-shadow: var(--shadow-sm);
  list-style: none;
}
.rank-card--top {
  background: var(--surface-secondary);
  border-color: rgba(3, 218, 198, 0.3);
}
.rank-icon { font-size: 22px; width: 28px; text-align: center; flex-shrink: 0; }
.rank-body { flex: 1; min-width: 0; }
.rank-name { font-size: 15px; font-weight: 700; color: var(--text-primary); display: block; }
.rank-bar-bg { height: 4px; background: #eeeeee; border-radius: 4px; margin-top: 4px; }
.rank-bar    { height: 4px; border-radius: 4px; background: var(--secondary-variant); }
.rank-count  {
  font-size: 13px; font-weight: 700; color: var(--primary);
  font-variant-numeric: tabular-nums; flex-shrink: 0;
}
</style>
