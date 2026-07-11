// src/stores/app.js
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '../services/api.js'
import { parseVideoPlayers } from '../utils/videos.js'
import { getTodayStr } from '../utils/date.js'

/** 樂觀更新產生、尚未經伺服器確認的暫時 id */
export function isTempId(id) {
  return typeof id === 'string' && id.startsWith('temp-')
}

export const useAppStore = defineStore('app', () => {
  // 版本標記：確認瀏覽器載入的是哪一版 store（驗證完可刪）
  console.info('[badminton] store v4：epoch + 持久化墓碑 + write-through 快取 + unload 不回滾')

  const config   = ref({})
  const members  = ref([])
  const sessions = ref([])
  const videos   = ref([])
  const announcements = ref([])
  const ANN_SEEN_KEY = 'badminton_ann_seen_v1'
  const _annSeenAt = ref(localStorage.getItem(ANN_SEEN_KEY) || '')
  const loading  = ref(true)
  const toast    = ref(null) // { id, message, type: 'success' | 'error' | 'info' }
  const _token   = ref(localStorage.getItem('admin_token') || null)

  // 頁面卸載偵測：重整/關閉會中斷 in-flight fetch 導致 promise reject，
  // 但 keepalive 已確保寫入請求送達伺服器——此時「不可以」執行失敗回滾，
  // 否則墓碑與 write-through 快取會被撤銷，刪除的場次在新頁面詐屍。
  let _pageUnloading = false
  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide',     () => { _pageUnloading = true })
    window.addEventListener('beforeunload', () => { _pageUnloading = true })
  }

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

  const videosByDate = computed(() => {
    const map = {}
    for (const v of videos.value) {
      (map[v.session_date] ||= []).push(v)
    }
    return map
  })

  const videosByMember = computed(() => (memberName) => {
    // 比對忽略大小寫與前後空白：成員登記名與影片標題的英文大小寫常不一致
    const target = (memberName || '').trim().toLowerCase()
    if (!target) return []
    return videos.value
      .filter(v => parseVideoPlayers(v.title).some(p => p.toLowerCase() === target))
      .sort((a, b) => b.session_date.localeCompare(a.session_date))
  })

  // 置頂優先 → 再依 created_at 新到舊。成員與 admin 共用同一套排序，避免順序不一致。
  function _annSort(a, b) {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    return (b.created_at || '').localeCompare(a.created_at || '')
  }

  function _annActive(a) {
    return !a.expires_at || a.expires_at >= getTodayStr()
  }

  const activeAnnouncements = computed(() =>
    announcements.value.filter(_annActive).sort(_annSort)
  )

  // admin 用：全部公告（含過期）。有效者在前、順序與成員視角一致；過期者沉到最底。
  const sortedAnnouncements = computed(() =>
    [...announcements.value].sort((a, b) => {
      const aa = _annActive(a), ba = _annActive(b)
      if (aa !== ba) return aa ? -1 : 1
      return _annSort(a, b)
    })
  )

  const latestAnnouncement = computed(() => activeAnnouncements.value[0] ?? null)

  const newestActiveCreatedAt = computed(() =>
    activeAnnouncements.value.reduce((max, a) => {
      const c = a.created_at || ''
      return c > max ? c : max
    }, '')
  )

  const hasUnreadAnnouncements = computed(() => {
    const newest = newestActiveCreatedAt.value
    if (!newest) return false
    return newest > _annSeenAt.value
  })

  function setAdminToken(token) {
    _token.value = token
    if (token) localStorage.setItem('admin_token', token)
  }

  function clearAdminToken() {
    _token.value = null
    localStorage.removeItem('admin_token')
  }

  function markAnnouncementsSeen() {
    const newest = newestActiveCreatedAt.value
    if (!newest) return
    _annSeenAt.value = newest
    localStorage.setItem(ANN_SEEN_KEY, _annSeenAt.value)
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

  // --- 寫入競態防護 ---
  // epoch：每次寫入操作 +1。fetch 出發時記下版本，回來時版本已變
  // （代表期間有樂觀更新發生）就整包丟棄，避免舊資料蓋掉新狀態。
  let _epoch = 0

  // 刪除墓碑：剛刪除的 session_id 保留 20 秒，
  // 期間任何 fetch 結果（GAS read-after-write 短暫不一致）都不得讓它復活。
  // 持久化到 localStorage：刪除後立刻重整頁面，快取直出時也不會看到它。
  const TOMBSTONE_MS  = 20000
  const TOMBSTONE_KEY = 'badminton_session_tombstones_v1'

  function _loadTombstones() {
    try {
      const raw = localStorage.getItem(TOMBSTONE_KEY)
      if (!raw) return new Map()
      const now = Date.now()
      return new Map(Object.entries(JSON.parse(raw)).filter(([, exp]) => exp > now))
    } catch {
      return new Map()
    }
  }

  function _saveTombstones() {
    try {
      localStorage.setItem(TOMBSTONE_KEY, JSON.stringify(Object.fromEntries(_deletedSessions)))
    } catch (err) {
      console.error('墓碑寫入失敗：', err)
    }
  }

  const _deletedSessions = _loadTombstones() // session_id -> 到期時間戳

  function _isTombstoned(id) {
    const exp = _deletedSessions.get(id)
    if (!exp) return false
    if (Date.now() > exp) {
      _deletedSessions.delete(id)
      _saveTombstones()
      return false
    }
    return true
  }

  // --- 本地快取（stale-while-revalidate）---
  const CACHE_KEY = 'badminton_data_cache_v1'

  function _loadCache() {
    try {
      const raw = localStorage.getItem(CACHE_KEY)
      if (!raw) return null
      const parsed = JSON.parse(raw)
      if (!parsed || !Array.isArray(parsed.members) || !Array.isArray(parsed.sessions)) return null
      return parsed
    } catch {
      return null
    }
  }

  function _saveCache() {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        config:   config.value,
        members:  members.value,
        sessions: sessions.value,
        videos:   videos.value,
        announcements: announcements.value,
        savedAt:  Date.now(),
      }))
    } catch (err) {
      console.error('快取寫入失敗：', err)
    }
  }

  async function _fetchAll() {
    const epochAtStart = _epoch
    const [cfg, mems, sess, vids, anns] = await Promise.all([
      api.getConfig(),
      api.getMembers(),
      api.getSessions(),
      api.getVideos().catch(err => {
        console.error('Videos fetch failed:', err)
        return []
      }),
      api.getAnnouncements().catch(err => {
        console.error('Announcements fetch failed:', err)
        return []
      }),
    ])
    // 過期回應：請求出發後發生過寫入操作，丟棄以免蓋掉樂觀狀態
    if (epochAtStart !== _epoch) return

    if (cfg.time_start) cfg.time_start = _normalizeTime(cfg.time_start)
    if (cfg.time_end)   cfg.time_end   = _normalizeTime(cfg.time_end)
    sess.forEach(s => { s.date = _normalizeDate(s.date) })
    config.value   = cfg
    members.value  = mems
    sessions.value = sess.filter(s => !_isTombstoned(s.session_id))
    videos.value   = vids
    announcements.value = anns
    _saveCache()
  }

  async function init() {
    const cached = _loadCache()
    if (cached) {
      // 先用快取直出，跳過骨架屏（刪除中的場次以墓碑過濾，重整也不會復活）
      config.value   = cached.config   ?? {}
      members.value  = cached.members  ?? []
      sessions.value = (cached.sessions ?? []).filter(s => !_isTombstoned(s.session_id))
      videos.value   = cached.videos   ?? []
      announcements.value = cached.announcements ?? []
      loading.value  = false
      // stale-while-revalidate：背景向 GAS 取最新資料
      try {
        await _fetchAll()
      } catch (err) {
        console.error('背景更新失敗，顯示快取資料：', err)
        showToast('無法連線，目前顯示上次的資料', 'info', 3500)
      }
      return
    }
    // 無快取（首次造訪）：維持原本骨架屏流程
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

  // --- 全域 toast ---
  let _toastTimer = null
  function showToast(message, type = 'info', duration = 2600) {
    toast.value = { id: Date.now(), message, type }
    clearTimeout(_toastTimer)
    _toastTimer = setTimeout(() => { toast.value = null }, duration)
  }

  /** 背景對帳：拿回伺服器產生的 id / created_at，失敗不影響樂觀狀態 */
  function _reconcile() {
    refresh().catch(err => console.error('背景對帳失敗：', err))
  }

  // --- 樂觀更新 actions：先改本地 state，API 失敗時還原快照 ---
  // 注意：catch 中先判斷 _pageUnloading——頁面卸載中斷的請求已由 keepalive
  // 確保送達，視為成功，不得回滾（回滾會把墓碑/快取撤銷造成詐屍）。

  /** 新增或更新場次名單（以 date 為鍵，與後端行為一致） */
  async function saveSessionOptimistic(date, attendances) {
    _epoch++ // 使所有 in-flight fetch 失效
    const snapshot = sessions.value
    const idx = snapshot.findIndex(s => s.date === date)
    if (idx >= 0) {
      const updated = { ...snapshot[idx], attendances }
      sessions.value = [...snapshot.slice(0, idx), updated, ...snapshot.slice(idx + 1)]
    } else {
      sessions.value = [...snapshot, {
        session_id: `temp-${Date.now()}`,
        date,
        attendances,
        created_at: new Date().toISOString(),
      }]
    }
    _saveCache() // write-through
    try {
      await api.saveSession(_token.value, date, attendances)
      _reconcile()
    } catch (err) {
      if (_pageUnloading) return // 卸載中斷：keepalive 已送達，不回滾
      sessions.value = snapshot
      _saveCache()
      throw err
    }
  }

  async function deleteSessionOptimistic(sessionId) {
    _epoch++ // 使所有 in-flight fetch 失效
    _deletedSessions.set(sessionId, Date.now() + TOMBSTONE_MS)
    _saveTombstones()
    const snapshot = sessions.value
    sessions.value = snapshot.filter(s => s.session_id !== sessionId)
    _saveCache() // write-through：快取立刻反映刪除後狀態，重整也不會讀到舊資料
    try {
      await api.deleteSession(_token.value, sessionId)
      _reconcile()
    } catch (err) {
      if (_pageUnloading) return // 卸載中斷：keepalive 已送達，不回滾
      _deletedSessions.delete(sessionId) // 刪除真的失敗，撤銷墓碑
      _saveTombstones()
      sessions.value = snapshot
      _saveCache() // 還原快取
      throw err
    }
  }

  async function toggleMemberActiveOptimistic(member) {
    _epoch++
    const snapshot = members.value
    members.value = snapshot.map(m =>
      m.id === member.id ? { ...m, active: !m.active } : m
    )
    _saveCache() // write-through
    try {
      await api.saveMember(_token.value, { id: member.id, active: !member.active })
      _reconcile()
    } catch (err) {
      if (_pageUnloading) return
      members.value = snapshot
      _saveCache()
      throw err
    }
  }

  async function addMemberOptimistic(name) {
    _epoch++
    const snapshot = members.value
    members.value = [...snapshot, { id: `temp-${Date.now()}`, name, active: true }]
    try {
      await api.saveMember(_token.value, { name, active: true })
      _reconcile()
    } catch (err) {
      if (_pageUnloading) return
      members.value = snapshot
      throw err
    }
  }

  async function saveAnnouncementOptimistic(ann) {
    _epoch++
    const snapshot = announcements.value
    if (ann.id) {
      announcements.value = snapshot.map(a => a.id === ann.id ? { ...a, ...ann } : a)
    } else {
      announcements.value = [...snapshot, {
        ...ann,
        id: `temp-${Date.now()}`,
        created_at: new Date().toISOString(),
      }]
    }
    _saveCache() // write-through
    try {
      await api.saveAnnouncement(_token.value, ann)
      if (!ann.id) markAnnouncementsSeen()
      _reconcile()
    } catch (err) {
      if (_pageUnloading) return
      announcements.value = snapshot
      _saveCache()
      throw err
    }
  }

  async function deleteAnnouncementOptimistic(id) {
    _epoch++
    const snapshot = announcements.value
    announcements.value = snapshot.filter(a => a.id !== id)
    _saveCache() // write-through
    try {
      await api.deleteAnnouncement(_token.value, id)
      _reconcile()
    } catch (err) {
      if (_pageUnloading) return
      announcements.value = snapshot
      _saveCache()
      throw err
    }
  }

  return { config, members, sessions, videos, announcements, loading, toast, isAdmin, adminToken, activeMembers, allUniqueGuests, videosByDate, videosByMember, activeAnnouncements, sortedAnnouncements, latestAnnouncement, hasUnreadAnnouncements, markAnnouncementsSeen, setAdminToken, clearAdminToken, init, refresh, showToast, saveSessionOptimistic, deleteSessionOptimistic, toggleMemberActiveOptimistic, addMemberOptimistic, saveAnnouncementOptimistic, deleteAnnouncementOptimistic }
})