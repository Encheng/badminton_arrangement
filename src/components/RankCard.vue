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
    <span class="rank-icon" aria-hidden="true">
      <Medal v-if="rank <= 3" :size="22" :stroke-width="2.2" :style="{ color: medalColor }" />
      <span v-else class="rank-num">{{ rank }}</span>
    </span>
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
import { Medal } from 'lucide-vue-next'

const props = defineProps({
  rank:     { type: Number, required: true },
  member:   { type: Object, required: true },
  count:    { type: Number, required: true },
  maxCount: { type: Number, required: true },
})

const medalColor = computed(() => {
  const colors = { 1: '#FFD700', 2: '#A0AEC0', 3: '#CD7F32' }
  return colors[props.rank]
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
.rank-icon { width: 28px; text-align: center; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
.rank-num { font-size: 14px; font-weight: 800; color: var(--text-tertiary); }
.rank-body { flex: 1; min-width: 0; }
.rank-name { font-size: 15px; font-weight: 700; color: var(--text-primary); display: block; }
.rank-bar-bg { height: 4px; background: #eeeeee; border-radius: 4px; margin-top: 4px; }
.rank-bar    { height: 4px; border-radius: 4px; background: var(--secondary-variant); }
.rank-count  {
  font-size: 13px; font-weight: 700; color: var(--primary);
  font-variant-numeric: tabular-nums; flex-shrink: 0;
}
</style>
