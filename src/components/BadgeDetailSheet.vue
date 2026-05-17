<!-- src/components/BadgeDetailSheet.vue -->
<template>
  <Teleport to="body">
    <AnimatePresence>
      <motion.div
        v-if="show"
        key="badge-backdrop"
        class="modal-backdrop"
        :initial="{ opacity: 0 }"
        :animate="{ opacity: 1 }"
        :exit="{ opacity: 0 }"
        :transition="{ duration: 0.2 }"
        @click.self="$emit('update:show', false)"
      >
        <motion.div
          class="modal"
          role="dialog"
          aria-label="徽章詳情"
          :initial="{ y: '100%' }"
          :animate="{ y: dragOffset }"
          :exit="{ y: '100%' }"
          :transition="isDragging
            ? { duration: 0 }
            : { type: 'spring', stiffness: 300, damping: 30 }
          "
        >
          <div
            class="modal__header"
            @touchstart="handleTouchStart"
            @touchmove="handleTouchMove"
            @touchend="handleTouchEnd"
          >
            <div class="modal__handle" aria-hidden="true"></div>
            <button
              class="modal__close"
              aria-label="關閉"
              @click="$emit('update:show', false)"
            >
              <X :size="20" :stroke-width="2" />
            </button>
          </div>

          <div class="detail" v-if="badge">
            <div
              class="detail__icon"
              :style="badge.unlocked ? { color: badge.color, background: badge.color + '18' } : {}"
            >
              <component :is="iconMap[badge.icon]" :size="48" :stroke-width="1.5" />
            </div>

            <h2 class="detail__name">{{ badge.name }}</h2>
            <p class="detail__desc">{{ badge.desc }}</p>

            <!-- Unlocked state -->
            <div v-if="badge.unlocked" class="detail__status detail__status--done">
              <CircleCheck :size="18" :stroke-width="2" />
              <span>已達成</span>
            </div>

            <!-- Locked with progress -->
            <template v-else>
              <div v-if="badge.progress" class="detail__progress">
                <div class="progress-bar">
                  <div
                    class="progress-bar__fill"
                    :style="{
                      width: progressPercent + '%',
                      background: badge.color,
                    }"
                  ></div>
                </div>
                <p class="progress-label">
                  {{ badge.progress.label }}：{{ badge.progress.current }} / {{ badge.progress.target }}
                </p>
              </div>
              <div class="detail__status detail__status--locked">
                <Lock :size="16" :stroke-width="2" />
                <span>尚未解鎖</span>
              </div>
            </template>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  </Teleport>
</template>

<script setup>
import { computed, watch, ref } from 'vue'
import { motion, AnimatePresence } from 'motion-v'
import { X, CircleCheck, Lock, Flame, Hash, Star, Gem, Rocket, Target, Medal, Crown } from 'lucide-vue-next'

const iconMap = { Flame, Hash, Star, Gem, Rocket, Target, Medal, Crown }

const props = defineProps({
  show:  { type: Boolean, default: false },
  badge: { type: Object,  default: null },
})

const emit = defineEmits(['update:show'])

const progressPercent = computed(() => {
  if (!props.badge?.progress) return 0
  const { current, target } = props.badge.progress
  if (target <= 0) return 0
  return Math.min(100, Math.round((current / target) * 100))
})

// Scroll lock
watch(() => props.show, (isOpen) => {
  document.body.style.overflow = isOpen ? 'hidden' : ''
})

// Swipe down to close
const isDragging = ref(false)
const dragStartY = ref(0)
const dragOffset = ref(0)

function handleTouchStart(e) {
  dragStartY.value = e.touches[0].clientY
  isDragging.value = true
}

function handleTouchMove(e) {
  if (!isDragging.value) return
  const deltaY = e.touches[0].clientY - dragStartY.value
  if (deltaY > 0) {
    dragOffset.value = deltaY
    e.preventDefault()
  }
}

function handleTouchEnd() {
  if (!isDragging.value) return
  if (dragOffset.value > 120) {
    emit('update:show', false)
  }
  isDragging.value = false
  dragOffset.value = 0
}
</script>

<style scoped>
.modal-backdrop {
  position: fixed; inset: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 1000;
  display: flex; align-items: flex-end; justify-content: center;
}
.modal {
  background: var(--surface);
  border-radius: 16px 16px 0 0;
  width: 100%;
  max-width: 600px;
  display: flex;
  flex-direction: column;
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
.modal__header {
  display: flex; align-items: center; justify-content: flex-end;
  padding: 16px 20px 0;
  position: relative;
  cursor: grab;
  user-select: none;
}
.modal__header:active { cursor: grabbing; }
.modal__handle {
  position: absolute;
  top: 8px;
  left: 50%;
  transform: translateX(-50%);
  width: 36px;
  height: 4px;
  border-radius: 2px;
  background: var(--border);
}
.modal__close {
  background: none; border: none; padding: 4px;
  color: var(--text-tertiary); cursor: pointer;
  display: flex; align-items: center;
  touch-action: manipulation;
}

/* Detail content */
.detail {
  padding: 8px 24px 28px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}
.detail__icon {
  width: 80px; height: 80px;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  background: var(--surface-tinted);
  color: var(--text-tertiary);
  margin-bottom: 14px;
}
.detail__name {
  font-size: 20px; font-weight: 800;
  color: var(--text-primary);
  margin: 0 0 6px;
}
.detail__desc {
  font-size: 14px;
  color: var(--text-secondary);
  margin: 0 0 18px;
  line-height: 1.5;
}

/* Progress */
.detail__progress {
  width: 100%;
  margin-bottom: 14px;
}
.progress-bar {
  height: 8px;
  background: var(--border);
  border-radius: 4px;
  overflow: hidden;
}
.progress-bar__fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.4s ease;
}
.progress-label {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 8px 0 0;
  font-variant-numeric: tabular-nums;
}

/* Status */
.detail__status {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 13px; font-weight: 600;
  padding: 6px 14px;
  border-radius: 20px;
}
.detail__status--done {
  color: #16a34a;
  background: rgba(22, 163, 74, 0.1);
}
.detail__status--locked {
  color: var(--text-tertiary);
  background: var(--surface-tinted);
}
</style>
