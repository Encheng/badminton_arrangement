<!-- src/App.vue -->
<template>
  <div class="app-wrapper">
    <!-- 全域載入遮罩 -->
    <Transition name="fade">
      <div v-if="store.loading" class="global-loading">
        <div class="global-loading__spinner"></div>
      </div>
    </Transition>

    <!-- 管理員模式 banner -->
    <div v-if="store.isAdmin" class="admin-banner">
      <span>管理員模式</span>
      <button class="admin-banner__logout" @click="exitAdmin">登出管理</button>
    </div>

    <RouterView v-slot="{ Component, route }">
      <Transition :name="transitionName" mode="out-in">
        <Suspense>
          <component :is="Component" :key="route.path" />
        </Suspense>
      </Transition>
    </RouterView>
    <TabBar />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useAppStore } from './stores/app.js'
import TabBar from './components/TabBar.vue'

const store = useAppStore()
const transitionName = ref('page-fade')

onMounted(() => store.init())

function exitAdmin() {
  store.clearAdminToken()
}
</script>

<style>
.app-wrapper {
  max-width: 480px;
  margin: 0 auto;
  min-height: 100dvh;
  position: relative;
  background: var(--background);
}

.admin-banner {
  background: var(--secondary, #03DAC6);
  color: var(--on-secondary, #000);
  font-size: 11px;
  font-weight: 700;
  padding: 4px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  letter-spacing: 0.5px;
  z-index: 101;
  position: relative;
}
.admin-banner__logout {
  background: none;
  border: 1px solid rgba(0, 0, 0, 0.2);
  color: var(--on-secondary, #000);
  font-size: 10px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 4px;
  cursor: pointer;
  touch-action: manipulation;
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

/* Page route transitions */
.page-fade-enter-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.page-fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.page-fade-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.page-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
