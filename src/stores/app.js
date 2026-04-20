// src/stores/app.js
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '../services/api.js'

export const useAppStore = defineStore('app', () => {
  const config   = ref({})
  const members  = ref([])
  const sessions = ref([])
  const loading  = ref(true)
  const _token   = ref(localStorage.getItem('admin_token') || null)

  const isAdmin = computed(() =>
    !!_token.value && _token.value === import.meta.env.VITE_ADMIN_TOKEN
  )

  const activeMembers = computed(() =>
    members.value.filter(m => m.active)
  )

  const adminToken = computed(() => _token.value)

  const allUniqueGuests = computed(() => {
    const guestMap = new Map()
    for (const session of sessions.value) {
      for (const att of session.attendances) {
        if (att.type === 'guest' && att.guest_key && !guestMap.has(att.guest_key)) {
          guestMap.set(att.guest_key, { name: att.name, guest_key: att.guest_key })
        }
      }
    }
    return Array.from(guestMap.values())
  })

  function setAdminToken(token) {
    _token.value = token
    if (token) localStorage.setItem('admin_token', token)
  }

  function clearAdminToken() {
    _token.value = null
    localStorage.removeItem('admin_token')
  }

  // Google Sheets 可能回傳非標準日期/時間格式，前端統一正規化
  function _normalizeTime(val) {
    if (typeof val === 'string' && val.includes('1899')) {
      const d = new Date(val)
      if (!isNaN(d)) {
        return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0')
      }
    }
    return val
  }

  // "Sat Mar 21 2026 00:00:00 GMT+0800 (...)" → "2026-03-21"
  function _normalizeDate(val) {
    if (typeof val !== 'string') return val
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val // already YYYY-MM-DD
    const d = new Date(val)
    if (!isNaN(d)) {
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${y}-${m}-${day}`
    }
    return val
  }

  async function _fetchAll() {
    const [cfg, mems, sess] = await Promise.all([
      api.getConfig(),
      api.getMembers(),
      api.getSessions(),
    ])
    if (cfg.time_start) cfg.time_start = _normalizeTime(cfg.time_start)
    if (cfg.time_end)   cfg.time_end   = _normalizeTime(cfg.time_end)
    sess.forEach(s => { s.date = _normalizeDate(s.date) })
    config.value   = cfg
    members.value  = mems
    sessions.value = sess
  }

  async function init() {
    loading.value = true
    try {
      await _fetchAll()
    } finally {
      loading.value = false
    }
  }

  /** 重新整理資料（不顯示全螢幕 loading） */
  async function refresh() {
    await _fetchAll()
  }

  return { config, members, sessions, loading, isAdmin, adminToken, activeMembers, allUniqueGuests, setAdminToken, clearAdminToken, init, refresh }
})
