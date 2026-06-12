<!-- src/App.vue -->
<template>
  <div class="app-wrapper" :class="{ 'has-admin-banner': store.isAdmin }">
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
    <AppToast />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useAppStore } from './stores/app.js'
import TabBar from './components/TabBar.vue'
import AppToast from './components/AppToast.vue'

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
  --status-bar-height: env(safe-area-inset-top, 44px);
}
.app-wrapper.has-admin-banner {
  --status-bar-height: 0px;
}

.admin-banner {
  background: var(--secondary, #03DAC6);
  color: var(--on-secondary, #000);
  font-size: 11px;
  font-weight: 700;
  padding: env(safe-area-inset-top, 0px) 16px 4px;
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
