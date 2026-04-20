<!-- src/components/BadgeGrid.vue -->
<template>
  <div>
    <h2 class="section-heading" :id="headingId">成就徽章</h2>
    <div class="grid" role="list" :aria-labelledby="headingId">
      <motion.div
        v-for="(badge, i) in badges"
        :key="badge.id"
        class="badge"
        :class="{ 'badge--locked': !badge.unlocked }"
        role="listitem"
        :aria-label="`${badge.name}（${badge.unlocked ? '已解鎖' : '未解鎖'}）`"
        :initial="{ opacity: 0, scale: 0.6 }"
        :animate="{ opacity: badge.unlocked ? 1 : 0.28, scale: 1 }"
        :transition="{ type: 'spring', stiffness: 350, damping: 20, delay: i * 0.05 }"
        :whileHover="badge.unlocked ? { scale: 1.1, y: -2 } : {}"
      >
        <div class="badge__icon" aria-hidden="true" :style="badge.unlocked ? { color: badge.color } : {}">
          <component :is="iconMap[badge.icon]" :size="22" :stroke-width="2" />
        </div>
        <div class="badge__name">{{ badge.name }}</div>
      </motion.div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { motion } from 'motion-v'
import { Flame, Hash, Star, Gem, Rocket, Target, Medal, Crown } from 'lucide-vue-next'
import { useAppStore } from '../stores/app.js'
import { getBadges } from '../utils/badges.js'

const iconMap = { Flame, Hash, Star, Gem, Rocket, Target, Medal, Crown }

const props = defineProps({
  memberId: { type: String, required: true },
})

const store = useAppStore()

const headingId = `badge-heading-${props.memberId}`

const badges = computed(() =>
  getBadges(props.memberId, store.sessions, store.members)
)
</script>

<style scoped>
.section-heading {
  font-size: 12px; font-weight: 700; color: var(--text-secondary);
  text-transform: uppercase; letter-spacing: 0.8px; margin: 16px 0 10px;
}
.grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}
.badge {
  background: var(--surface-tinted);
  border-radius: var(--radius-sm);
  padding: 10px 6px;
  text-align: center;
  border: 1px solid rgba(98, 0, 238, 0.1);
  box-shadow: var(--shadow-sm);
}
.badge__icon { margin-bottom: 4px; display: flex; justify-content: center; }
.badge__name { font-size: 10px; color: var(--text-secondary); line-height: 1.3; }
</style>
