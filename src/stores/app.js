// src/stores/app.js
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '../services/api.js'

export const useAppStore = defineStore('app', () => {
  const config   = ref({})
  const members  = ref([])
  const sessions = ref([])
  const _token   = ref(null)

  const isAdmin = computed(() =>
    !!_token.value && _token.value === import.meta.env.VITE_ADMIN_TOKEN
  )

  const activeMembers = computed(() =>
    members.value.filter(m => m.active)
  )

  function setAdminToken(token) {
    _token.value = token
  }

  async function init() {
    const [cfg, mems, sess] = await Promise.all([
      api.getConfig(),
      api.getMembers(),
      api.getSessions(),
    ])
    config.value   = cfg
    members.value  = mems
    sessions.value = sess
  }

  return { config, members, sessions, isAdmin, activeMembers, setAdminToken, init }
})
