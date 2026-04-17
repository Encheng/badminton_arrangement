<!-- src/components/AttendeeChip.vue -->
<template>
  <motion.div
    class="attendee"
    :class="type === 'guest' ? 'attendee--guest' : 'attendee--member'"
    role="listitem"
    :initial="{ opacity: 0, scale: 0.8 }"
    :animate="{ opacity: 1, scale: 1 }"
    :transition="{ type: 'spring', stiffness: 400, damping: 25, delay: delay }"
    :whileHover="{ scale: 1.06, y: -2 }"
    :whilePress="{ scale: 0.95 }"
  >
    <div class="avatar" aria-hidden="true">{{ initial }}</div>
    <span class="name">{{ name }}</span>
    <span v-if="type === 'guest'" class="badge">臨打</span>
  </motion.div>
</template>

<script setup>
import { motion } from 'motion-v'

const props = defineProps({
  name: { type: String, required: true },
  type: { type: String, default: 'member' }, // 'member' | 'guest'
  delay: { type: Number, default: 0 },
})

const initial = props.name.charAt(0).toUpperCase()
</script>

<style scoped>
.attendee {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 12px 4px 10px;
  border-radius: var(--radius-sm);
  cursor: default;
  min-width: 0;
}

.attendee--member {
  background: var(--surface);
  border: 1px solid rgba(98, 0, 238, 0.1);
}

.attendee--guest {
  background: #fff5f5;
  border: 1px solid rgba(176, 0, 32, 0.15);
}

.avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  font-weight: 700;
  color: var(--on-primary);
  background: var(--primary);
  flex-shrink: 0;
}

.attendee--guest .avatar {
  background: var(--error);
}

.name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  text-align: center;
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

.badge {
  font-size: 10px;
  font-weight: 600;
  color: var(--error);
  background: rgba(176, 0, 32, 0.08);
  padding: 1px 6px;
  border-radius: 4px;
  line-height: 1.4;
}
</style>
