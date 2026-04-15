<!-- src/App.vue -->
<template>
  <div class="app-wrapper">
    <!-- 全域載入遮罩 -->
    <Transition name="fade">
      <div v-if="store.loading" class="global-loading">
        <div class="global-loading__spinner"></div>
      </div>
    </Transition>

    <Suspense>
      <RouterView />
    </Suspense>
    <TabBar v-if="!isAdminRoute" />
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useAppStore } from './stores/app.js'
import TabBar from './components/TabBar.vue'

const route = useRoute()
const store = useAppStore()

const isAdminRoute = computed(() => route.path === '/admin')

onMounted(() => store.init())
</script>

<style>
.app-wrapper {
  max-width: 480px;
  margin: 0 auto;
  min-height: 100dvh;
  position: relative;
  background: var(--background);
}

.global-loading {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--background, #fff);
}
.global-loading__spinner {
  width: 40px;
  height: 40px;
  border: 3.5px solid rgba(98, 0, 238, 0.15);
  border-top-color: var(--primary, #6200ee);
  border-radius: 50%;
  animation: global-spin 0.8s linear infinite;
}
@keyframes global-spin {
  to { transform: rotate(360deg); }
}

.fade-enter-active { transition: opacity 0.15s ease; }
.fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from,
.fade-leave-to { opacity: 0; }
</style>
