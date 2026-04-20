<!-- src/components/PullRefresh.vue -->
<template>
  <div
    ref="containerRef"
    class="pull-refresh"
    @touchstart.passive="onTouchStart"
    @touchmove.passive="onTouchMove"
    @touchend="onTouchEnd"
  >
    <div class="pull-refresh__indicator" :style="indicatorStyle">
      <div class="pull-refresh__spinner" :class="{ 'pull-refresh__spinner--active': refreshing }">
        <svg viewBox="0 0 24 24" :style="iconStyle">
          <path
            d="M17.65 6.35A7.96 7.96 0 0 0 12 4a8 8 0 1 0 8 8h-2a6 6 0 1 1-1.76-4.24L14 10h6V4l-2.35 2.35z"
            fill="currentColor"
          />
        </svg>
      </div>
    </div>
    <slot />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  disabled: { type: Boolean, default: false },
})

const emit = defineEmits(['refresh'])

const THRESHOLD = 64
const MAX_PULL = 100

const containerRef = ref(null)
const startY = ref(0)
const pullDistance = ref(0)
const pulling = ref(false)
const refreshing = ref(false)

function isScrolledToTop() {
  let el = containerRef.value
  while (el) {
    if (el.scrollTop > 0) return false
    el = el.parentElement
  }
  return window.scrollY <= 0
}

function onTouchStart(e) {
  if (props.disabled || refreshing.value) return
  if (!isScrolledToTop()) return
  startY.value = e.touches[0].clientY
  pulling.value = true
}

function onTouchMove(e) {
  if (!pulling.value || refreshing.value) return
  const dy = e.touches[0].clientY - startY.value
  if (dy < 0) {
    pullDistance.value = 0
    return
  }
  pullDistance.value = Math.min(dy * 0.45, MAX_PULL)
}

async function onTouchEnd() {
  if (!pulling.value) return
  pulling.value = false

  if (pullDistance.value >= THRESHOLD) {
    refreshing.value = true
    pullDistance.value = THRESHOLD * 0.7
    try {
      await new Promise((resolve, reject) => {
        emit('refresh', { done: resolve, fail: reject })
      })
    } catch {
      // silently handle
    } finally {
      refreshing.value = false
      pullDistance.value = 0
    }
  } else {
    pullDistance.value = 0
  }
}

const progress = computed(() =>
  Math.min(pullDistance.value / THRESHOLD, 1)
)

const indicatorStyle = computed(() => ({
  height: `${pullDistance.value}px`,
  opacity: refreshing.value ? 1 : progress.value,
  transition: pulling.value ? 'none' : 'height 0.3s ease, opacity 0.3s ease',
}))

const iconStyle = computed(() => ({
  transform: `rotate(${progress.value * 360}deg)`,
  transition: pulling.value ? 'none' : 'transform 0.3s ease',
}))
</script>

<style scoped>
.pull-refresh {
  position: relative;
}

.pull-refresh__indicator {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  overflow: hidden;
  pointer-events: none;
}

.pull-refresh__spinner {
  width: 32px;
  height: 32px;
  color: var(--primary, #6200EE);
  margin-bottom: 6px;
}
.pull-refresh__spinner--active {
  animation: ptr-spin 0.8s linear infinite;
}
.pull-refresh__spinner svg {
  width: 100%;
  height: 100%;
}

@keyframes ptr-spin {
  to { transform: rotate(360deg); }
}
</style>
