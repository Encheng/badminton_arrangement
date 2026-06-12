<!-- src/components/AppToast.vue -->
<template>
  <Teleport to="body">
    <Transition name="toast">
      <div
        v-if="store.toast"
        :key="store.toast.id"
        class="toast"
        :class="`toast--${store.toast.type}`"
        role="status"
        aria-live="polite"
      >
        <component :is="icon" :size="16" :stroke-width="2.5" class="toast__icon" />
        <span class="toast__msg">{{ store.toast.message }}</span>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed } from 'vue'
import { CheckCircle2, AlertCircle, Info } from 'lucide-vue-next'
import { useAppStore } from '../stores/app.js'

const store = useAppStore()

const icon = computed(() => {
  switch (store.toast?.type) {
    case 'success': return CheckCircle2
    case 'error':   return AlertCircle
    default:        return Info
  }
})
</script>

<style scoped>
.toast {
  position: fixed;
  bottom: calc(76px + env(safe-area-inset-bottom, 0px));
  left: 50%;
  transform: translateX(-50%);
  z-index: 2000;
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: min(calc(100vw - 32px), 420px);
  padding: 10px 16px;
  border-radius: var(--radius-lg);
  background: #2b2b33;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.25);
  pointer-events: none;
}
.toast--success .toast__icon { color: var(--secondary); }
.toast--error   .toast__icon { color: #ff8a9b; }
.toast--info    .toast__icon { color: #b3a4ff; }
.toast__icon { flex-shrink: 0; }
.toast__msg {
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.toast-enter-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.toast-leave-active { transition: opacity 0.25s ease, transform 0.25s ease; }
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(12px);
}
</style>
