<!-- src/components/TabBar.vue -->
<template>
  <nav class="tabbar" aria-label="主選單">
    <div v-if="store.isAdmin" class="admin-bar"></div>
    <button
      v-for="tab in tabs"
      :key="tab.path"
      class="tab"
      :class="{ active: isActive(tab.path) }"
      :aria-label="tab.label"
      :aria-current="isActive(tab.path) ? 'page' : undefined"
      @click="router.push(tab.path)"
    >
      <component :is="tab.icon" class="tab-icon" aria-hidden="true" :size="22" :stroke-width="2.2" />
      <span>{{ tab.label }}</span>
    </button>
  </nav>
</template>

<script setup>
import { useRouter, useRoute } from 'vue-router'
import { useAppStore } from '../stores/app.js'
import { CalendarDays, ClipboardList, Trophy, Settings } from 'lucide-vue-next'

const router = useRouter()
const route  = useRoute()
const store  = useAppStore()

const tabs = [
  { path: '/',         icon: CalendarDays,  label: '本週' },
  { path: '/sessions', icon: ClipboardList, label: '場次' },
  { path: '/stats',    icon: Trophy,        label: '榮譽' },
  { path: '/members',  icon: Settings,      label: '管理' },
]

function isActive(path) {
  return route.path === path
}
</script>

<style scoped>
.tabbar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(255, 255, 255, 0.93);
  backdrop-filter: blur(16px) saturate(180%);
  -webkit-backdrop-filter: blur(16px) saturate(180%);
  border-top: 1px solid var(--border);
  display: flex;
  flex-wrap: wrap;
  z-index: 100;
  padding-bottom: env(safe-area-inset-bottom, 0px);
  max-width: 480px;
  margin: 0 auto;
}

.admin-bar {
  width: 100%;
  height: 2px;
  background: var(--secondary, #03DAC6);
}

.tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 10px 4px 12px;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 10px;
  font-weight: 500;
  color: var(--text-tertiary);
  touch-action: manipulation;
  transition: color 0.15s ease;
}

.tab:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: -2px;
  border-radius: 8px;
}

.tab.active { color: var(--primary); }
.tab.active::after {
  content: '';
  display: block;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: currentColor;
}

.tab-icon { width: 22px; height: 22px; }
</style>
