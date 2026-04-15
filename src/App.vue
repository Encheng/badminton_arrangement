<!-- src/App.vue -->
<template>
  <div class="app-wrapper">
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
</style>
