# 公告功能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓管理員在 App 內發布公告（臨時通知／活動宣傳），成員於首頁橫幅看到最新一則並以小紅點提示未讀。

**Architecture:** 後端沿用 GAS + Google Sheet（新增 `announcements` 分頁與三個 action）。前端在 Pinia store 新增 `announcements` 狀態、有效公告過濾與排序 computed、未讀判定、樂觀更新 action，並以 `AnnouncementBanner.vue`（首頁橫幅／展開）與 `AnnouncementAdminSheet.vue`（admin CRUD 表單）呈現。

**Tech Stack:** Vue 3 `<script setup>`、Pinia、vue-router、motion-v、lucide-vue-next、Vitest、Google Apps Script。

## Global Constraints

- 專案文件（spec/plan）用繁體中文；程式碼與 commit 訊息用英文。
- 寫入 API 皆需 `admin_token`，比對 `import.meta.env.VITE_ADMIN_TOKEN`（`store.isAdmin`）。
- 樂觀更新須沿用既有防護：`_epoch++`、`_pageUnloading` 期間不回滾、write-through 快取（`_saveCache()`）。公告**不做**刪除墓碑。
- 有效公告 = `expires_at` 為空或 `expires_at >= 今天`（當天算有效）。今天字串一律用 `src/utils/date.js` 的 `getTodayStr()`。
- 過期公告不刪除，只在成員視角過濾；admin 管理清單仍顯示（標灰）。
- 日期字串格式 `YYYY-MM-DD`；`created_at` 為 ISO timestamp 字串。
- 公告 CRUD 無自動化元件測試（專案未測 `.vue`）；元件以 `npm run build` + 手動驗證，邏輯集中在 store 並以 Vitest 覆蓋。

---

### Task 1: GAS 後端 — announcements 讀寫

**Files:**
- Modify: `gas/Code.gs`（doGet 分派、doPost 分派、新增 `_createAnnouncementsSheet` / `_getAnnouncements` / `_saveAnnouncement` / `_deleteAnnouncement`）

**Interfaces:**
- Produces（前端 API 依賴的行為）：
  - `GET ?action=getAnnouncements` → `{ status:'ok', data: Announcement[] }`
  - `POST ?action=saveAnnouncement` body `{ admin_token, id?, title, body, link_url, link_label, pinned, expires_at }` → `{ status:'ok', data:{ id } }`
  - `POST ?action=deleteAnnouncement` body `{ admin_token, id }` → `{ status:'ok', data:{ deleted } }`
  - `Announcement = { id, title, body, link_url, link_label, pinned:boolean, expires_at, created_at }`

> 註：GAS 無 Vitest 測試環境，本任務以部署後手動驗證取代自動化測試。

- [ ] **Step 1: 新增三個 helper 函式**

在 `gas/Code.gs` 末尾（`_getVideos` 之後）新增：

```javascript
function _createAnnouncementsSheet(ss) {
  const sheet = ss.insertSheet('announcements')
  sheet.appendRow(['id', 'title', 'body', 'link_url', 'link_label', 'pinned', 'expires_at', 'created_at'])
  return sheet
}

function _getAnnouncements(ss) {
  const sheet = ss.getSheetByName('announcements') || _createAnnouncementsSheet(ss)
  const rows = sheet.getDataRange().getValues().slice(1)
  return rows.map(function(r) {
    return {
      id:         r[0],
      title:      r[1],
      body:       r[2] || '',
      link_url:   r[3] || '',
      link_label: r[4] || '',
      pinned:     r[5] === true || r[5] === 'TRUE',
      expires_at: r[6] ? _formatDate(r[6]) : '',
      created_at: String(r[7] || ''),
    }
  })
}

function _saveAnnouncement(ss, body) {
  var sheet = ss.getSheetByName('announcements') || _createAnnouncementsSheet(ss)
  var data  = sheet.getDataRange().getValues()

  if (body.id) {
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === body.id) {
        sheet.getRange(i + 1, 2).setValue(body.title || '')
        sheet.getRange(i + 1, 3).setValue(body.body || '')
        sheet.getRange(i + 1, 4).setValue(body.link_url || '')
        sheet.getRange(i + 1, 5).setValue(body.link_label || '')
        sheet.getRange(i + 1, 6).setValue(body.pinned === true)
        sheet.getRange(i + 1, 7).setValue(body.expires_at || '')
        return { id: body.id }
      }
    }
  }

  var newId = 'an' + Date.now()
  sheet.appendRow([
    newId,
    body.title || '',
    body.body || '',
    body.link_url || '',
    body.link_label || '',
    body.pinned === true,
    body.expires_at || '',
    new Date().toISOString(),
  ])
  return { id: newId }
}

function _deleteAnnouncement(ss, body) {
  var id = body.id
  if (!id) throw new Error('Missing id')
  var sheet = ss.getSheetByName('announcements')
  if (!sheet) return { deleted: id }
  var data = sheet.getDataRange().getValues()
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === id) {
      sheet.deleteRow(i + 1)
      break
    }
  }
  return { deleted: id }
}
```

- [ ] **Step 2: 在 doGet 分派加入 getAnnouncements**

在 `doGet` 的分派串中，`getVideos` 那行之後加入：

```javascript
    else if (action === 'getVideos')   data = _getVideos(ss)
    else if (action === 'getAnnouncements') data = _getAnnouncements(ss)
```

- [ ] **Step 3: 在 doPost 分派加入 save/delete**

在 `doPost` 的分派串中，`demoteMember` 那行之後加入：

```javascript
    else if (action === 'demoteMember')  data = _demoteMember(ss, body)
    else if (action === 'saveAnnouncement')   data = _saveAnnouncement(ss, body)
    else if (action === 'deleteAnnouncement') data = _deleteAnnouncement(ss, body)
```

- [ ] **Step 4: 部署並手動驗證讀取**

於 GAS 編輯器 → 部署 → 管理部署 → 編輯現有部署 → 版本「新增版本」→ 部署。
以瀏覽器開啟 `<GAS_URL>?action=getAnnouncements`。
Expected：回傳 `{"status":"ok","data":[]}`，且試算表出現 `announcements` 分頁與標頭列。

- [ ] **Step 5: Commit**

```bash
git add gas/Code.gs
git commit -m "feat(gas): add announcements read/write endpoints"
```

---

### Task 2: 前端 API 層

**Files:**
- Modify: `src/services/api.js`（新增三個方法）
- Test: `src/services/__tests__/api.test.js`（新增三個 describe）

**Interfaces:**
- Consumes: `gasGet(action)`、`gasPost(action, body)`（既有）
- Produces:
  - `api.getAnnouncements(): Promise<Announcement[]>`
  - `api.saveAnnouncement(token, a): Promise<{id}>` — `a` 為 `{ id?, title, body, link_url, link_label, pinned, expires_at }`
  - `api.deleteAnnouncement(token, id): Promise<{deleted}>`

- [ ] **Step 1: Write the failing tests**

在 `src/services/__tests__/api.test.js` 末尾新增：

```javascript
describe('api.getAnnouncements', () => {
  it('calls GET with action=getAnnouncements and returns data', async () => {
    const mockData = [{ id: 'a1', title: 'x', pinned: false, expires_at: '', created_at: '2026-07-01T00:00:00Z' }]
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: 'ok', data: mockData }),
    })

    const result = await api.getAnnouncements()

    expect(fetch).toHaveBeenCalledWith(`${FAKE_URL}?action=getAnnouncements`)
    expect(result).toEqual(mockData)
  })
})

describe('api.saveAnnouncement', () => {
  it('POSTs with action=saveAnnouncement, admin_token and fields', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: 'ok', data: { id: 'an1' } }),
    })

    await api.saveAnnouncement('tok', { title: 'Hi', body: '', link_url: '', link_label: '', pinned: true, expires_at: '2026-07-10' })

    expect(fetch).toHaveBeenCalledWith(
      `${FAKE_URL}?action=saveAnnouncement`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          admin_token: 'tok',
          title: 'Hi', body: '', link_url: '', link_label: '', pinned: true, expires_at: '2026-07-10',
        }),
      })
    )
  })
})

describe('api.deleteAnnouncement', () => {
  it('POSTs with action=deleteAnnouncement, admin_token and id', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: 'ok', data: { deleted: 'a1' } }),
    })

    await api.deleteAnnouncement('tok', 'a1')

    expect(fetch).toHaveBeenCalledWith(
      `${FAKE_URL}?action=deleteAnnouncement`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ admin_token: 'tok', id: 'a1' }),
      })
    )
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- api.test`
Expected: FAIL（`api.getAnnouncements is not a function` 等）

- [ ] **Step 3: Implement API methods**

在 `src/services/api.js` 的 `export const api = { ... }` 內，`demoteMember` 之後加入：

```javascript
  demoteMember: (token, member_id)   => gasPost('demoteMember', { admin_token: token, member_id }),
  getAnnouncements:   ()             => gasGet('getAnnouncements'),
  saveAnnouncement:   (token, a)     => gasPost('saveAnnouncement',   { admin_token: token, ...a }),
  deleteAnnouncement: (token, id)    => gasPost('deleteAnnouncement', { admin_token: token, id }),
```

（注意：`demoteMember` 該行原本結尾無逗號時需補上逗號。）

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- api.test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/api.js src/services/__tests__/api.test.js
git commit -m "feat(api): add announcements endpoints"
```

---

### Task 3: Store — 資料載入、快取與有效公告 computed

**Files:**
- Modify: `src/stores/app.js`
- Test: `src/stores/__tests__/app.test.js`

**Interfaces:**
- Consumes: `api.getAnnouncements`、`getTodayStr()`（`src/utils/date.js`）
- Produces（供後續任務與元件使用）:
  - `store.announcements: Announcement[]`（原始清單，含過期）
  - `store.activeAnnouncements: Announcement[]`（過濾有效 + 排序 pinned→created_at desc）
  - `store.latestAnnouncement: Announcement | null`

- [ ] **Step 1: 在 API mock 補上 announcements 方法（否則現有測試會壞）**

修改 `src/stores/__tests__/app.test.js` 頂部的 `vi.mock('../../services/api.js', ...)`，於 `getVideos` 之後加入：

```javascript
    getVideos: vi.fn().mockResolvedValue([
      { video_id: 'v1', session_date: '2026-04-12', match_no: 1, title: '20260412 Peter 1', published_at: '2026-04-13T00:00:00Z' },
      { video_id: 'v2', session_date: '2026-04-12', match_no: 2, title: '20260412 Peter 2', published_at: '2026-04-13T00:00:00Z' },
      { video_id: 'v3', session_date: '2026-04-05', match_no: 1, title: '20260405 Peter 1', published_at: '2026-04-06T00:00:00Z' },
    ]),
    getAnnouncements:   vi.fn().mockResolvedValue([]),
    saveAnnouncement:   vi.fn().mockResolvedValue({ id: 'an1' }),
    deleteAnnouncement: vi.fn().mockResolvedValue({ deleted: 'a1' }),
```

同時把測試檔頂部的 import 補上 `api`，供後續 `mockResolvedValueOnce` 覆蓋：

```javascript
import { useAppStore } from '../app.js'
import { api } from '../../services/api.js'
```

- [ ] **Step 2: Write the failing test**

在 `src/stores/__tests__/app.test.js` 末尾新增：

```javascript
describe('activeAnnouncements', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-05T12:00:00Z'))
  })
  afterEach(() => { vi.useRealTimers() })

  it('excludes expired, keeps today/non-expiring, sorts pinned then newest', async () => {
    api.getAnnouncements.mockResolvedValueOnce([
      { id: 'a1', title: 'expired', body: '', link_url: '', link_label: '', pinned: false, expires_at: '2026-07-04', created_at: '2026-07-01T00:00:00Z' },
      { id: 'a2', title: 'today',   body: '', link_url: '', link_label: '', pinned: false, expires_at: '2026-07-05', created_at: '2026-07-02T00:00:00Z' },
      { id: 'a3', title: 'forever', body: '', link_url: '', link_label: '', pinned: false, expires_at: '',           created_at: '2026-07-03T00:00:00Z' },
      { id: 'a4', title: 'pinned',  body: '', link_url: '', link_label: '', pinned: true,  expires_at: '',           created_at: '2026-07-01T00:00:00Z' },
    ])
    const store = useAppStore()
    await store.init()

    expect(store.activeAnnouncements.map(a => a.id)).toEqual(['a4', 'a3', 'a2'])
    expect(store.latestAnnouncement.id).toBe('a4')
  })

  it('latestAnnouncement is null when none active', async () => {
    api.getAnnouncements.mockResolvedValueOnce([
      { id: 'a1', title: 'expired', body: '', link_url: '', link_label: '', pinned: false, expires_at: '2026-07-01', created_at: '2026-07-01T00:00:00Z' },
    ])
    const store = useAppStore()
    await store.init()

    expect(store.activeAnnouncements).toHaveLength(0)
    expect(store.latestAnnouncement).toBeNull()
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- app.test`
Expected: FAIL（`store.activeAnnouncements` undefined）

- [ ] **Step 4: Implement store state + computeds**

在 `src/stores/app.js`：

4a. 頂部 import 補上 `getTodayStr`：

```javascript
import { parseVideoPlayers } from '../utils/videos.js'
import { getTodayStr } from '../utils/date.js'
```

4b. state 區塊，`const videos = ref([])` 之後加入：

```javascript
  const videos   = ref([])
  const announcements = ref([])
```

4c. computed 區塊（`videosByMember` 之後）加入：

```javascript
  const activeAnnouncements = computed(() => {
    const today = getTodayStr()
    return announcements.value
      .filter(a => !a.expires_at || a.expires_at >= today)
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
        return (b.created_at || '').localeCompare(a.created_at || '')
      })
  })

  const latestAnnouncement = computed(() => activeAnnouncements.value[0] ?? null)
```

4d. `_fetchAll` 併發抓取加入 announcements：

```javascript
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
```

並在 `videos.value = vids` 之後加入：

```javascript
    videos.value   = vids
    announcements.value = anns
    _saveCache()
```

4e. `_saveCache` 寫入 announcements：

```javascript
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        config:   config.value,
        members:  members.value,
        sessions: sessions.value,
        videos:   videos.value,
        announcements: announcements.value,
        savedAt:  Date.now(),
      }))
```

4f. `init` 的快取直出加入：

```javascript
      videos.value   = cached.videos   ?? []
      announcements.value = cached.announcements ?? []
      loading.value  = false
```

4g. `return { ... }` 加入新成員：

```javascript
  return { config, members, sessions, videos, announcements, loading, toast, isAdmin, adminToken, activeMembers, allUniqueGuests, videosByDate, videosByMember, activeAnnouncements, latestAnnouncement, setAdminToken, clearAdminToken, init, refresh, showToast, saveSessionOptimistic, deleteSessionOptimistic, toggleMemberActiveOptimistic, addMemberOptimistic }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- app.test`
Expected: PASS（所有 app.test 案例通過）

- [ ] **Step 6: Commit**

```bash
git add src/stores/app.js src/stores/__tests__/app.test.js
git commit -m "feat(store): load announcements with active-filter computeds"
```

---

### Task 4: Store — 未讀小紅點

**Files:**
- Modify: `src/stores/app.js`
- Test: `src/stores/__tests__/app.test.js`

**Interfaces:**
- Consumes: `latestAnnouncement`（Task 3）
- Produces:
  - `store.hasUnreadAnnouncements: boolean`
  - `store.markAnnouncementsSeen(): void`（寫入 `localStorage['badminton_ann_seen_v1']`）

- [ ] **Step 1: Write the failing test**

在 `src/stores/__tests__/app.test.js` 末尾新增：

```javascript
describe('unread announcements', () => {
  beforeEach(() => { localStorage.clear() })

  it('hasUnreadAnnouncements is true when latest newer than seen', async () => {
    api.getAnnouncements.mockResolvedValueOnce([
      { id: 'a1', title: 'x', body: '', link_url: '', link_label: '', pinned: false, expires_at: '', created_at: '2026-07-03T00:00:00Z' },
    ])
    const store = useAppStore()
    await store.init()
    expect(store.hasUnreadAnnouncements).toBe(true)
  })

  it('markAnnouncementsSeen clears unread and persists', async () => {
    api.getAnnouncements.mockResolvedValueOnce([
      { id: 'a1', title: 'x', body: '', link_url: '', link_label: '', pinned: false, expires_at: '', created_at: '2026-07-03T00:00:00Z' },
    ])
    const store = useAppStore()
    await store.init()
    store.markAnnouncementsSeen()
    expect(store.hasUnreadAnnouncements).toBe(false)
    expect(localStorage.getItem('badminton_ann_seen_v1')).toBe('2026-07-03T00:00:00Z')
  })

  it('hasUnreadAnnouncements is false when no active announcements', async () => {
    api.getAnnouncements.mockResolvedValueOnce([])
    const store = useAppStore()
    await store.init()
    expect(store.hasUnreadAnnouncements).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- app.test`
Expected: FAIL（`store.hasUnreadAnnouncements` undefined）

- [ ] **Step 3: Implement unread logic**

在 `src/stores/app.js`：

3a. state 區塊（`const announcements = ref([])` 之後）加入：

```javascript
  const announcements = ref([])
  const ANN_SEEN_KEY = 'badminton_ann_seen_v1'
  const _annSeenAt = ref(localStorage.getItem(ANN_SEEN_KEY) || '')
```

3b. computed（`latestAnnouncement` 之後）加入：

```javascript
  const hasUnreadAnnouncements = computed(() => {
    const latest = latestAnnouncement.value
    if (!latest) return false
    return (latest.created_at || '') > _annSeenAt.value
  })
```

3c. function（`clearAdminToken` 附近或 `showToast` 之後）加入：

```javascript
  function markAnnouncementsSeen() {
    const latest = latestAnnouncement.value
    if (!latest) return
    _annSeenAt.value = latest.created_at || ''
    localStorage.setItem(ANN_SEEN_KEY, _annSeenAt.value)
  }
```

3d. `return { ... }` 加入 `hasUnreadAnnouncements, markAnnouncementsSeen`。

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- app.test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/stores/app.js src/stores/__tests__/app.test.js
git commit -m "feat(store): track unread announcements per device"
```

---

### Task 5: Store — 樂觀更新 action

**Files:**
- Modify: `src/stores/app.js`
- Test: `src/stores/__tests__/app.test.js`

**Interfaces:**
- Consumes: `api.saveAnnouncement`、`api.deleteAnnouncement`、`_epoch`、`_pageUnloading`、`_saveCache`、`_reconcile`（皆既有）
- Produces:
  - `store.saveAnnouncementOptimistic(ann): Promise<void>` — `ann` 無 `id` 為新增、有 `id` 為更新
  - `store.deleteAnnouncementOptimistic(id): Promise<void>`

- [ ] **Step 1: Write the failing test**

在 `src/stores/__tests__/app.test.js` 末尾新增：

```javascript
describe('announcement optimistic actions', () => {
  beforeEach(() => {
    localStorage.clear()
    import.meta.env.VITE_ADMIN_TOKEN = 'secret'
  })

  it('adds a new announcement optimistically', async () => {
    const store = useAppStore()
    store.setAdminToken('secret')
    api.saveAnnouncement.mockResolvedValueOnce({ id: 'an123' })

    await store.saveAnnouncementOptimistic({ title: 'Hello', body: '', link_url: '', link_label: '', pinned: false, expires_at: '' })

    expect(store.announcements.some(a => a.title === 'Hello')).toBe(true)
  })

  it('rolls back a failed create', async () => {
    const store = useAppStore()
    store.setAdminToken('secret')
    api.saveAnnouncement.mockRejectedValueOnce(new Error('boom'))

    await expect(
      store.saveAnnouncementOptimistic({ title: 'X', body: '', link_url: '', link_label: '', pinned: false, expires_at: '' })
    ).rejects.toThrow('boom')

    expect(store.announcements.some(a => a.title === 'X')).toBe(false)
  })

  it('deletes optimistically and rolls back on failure', async () => {
    const store = useAppStore()
    store.setAdminToken('secret')
    api.getAnnouncements.mockResolvedValueOnce([
      { id: 'a1', title: 'x', body: '', link_url: '', link_label: '', pinned: false, expires_at: '', created_at: '2026-07-03T00:00:00Z' },
    ])
    await store.init()

    api.deleteAnnouncement.mockRejectedValueOnce(new Error('nope'))
    await expect(store.deleteAnnouncementOptimistic('a1')).rejects.toThrow('nope')
    expect(store.announcements.some(a => a.id === 'a1')).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- app.test`
Expected: FAIL（`store.saveAnnouncementOptimistic` undefined）

- [ ] **Step 3: Implement optimistic actions**

在 `src/stores/app.js` 的 `addMemberOptimistic` 之後加入：

```javascript
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
```

在 `return { ... }` 加入 `saveAnnouncementOptimistic, deleteAnnouncementOptimistic`。

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- app.test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/stores/app.js src/stores/__tests__/app.test.js
git commit -m "feat(store): optimistic create/update/delete for announcements"
```

---

### Task 6: `AnnouncementBanner.vue` 元件

**Files:**
- Create: `src/components/AnnouncementBanner.vue`

**Interfaces:**
- Consumes: `store.activeAnnouncements`、`store.latestAnnouncement`、`store.hasUnreadAnnouncements`、`store.markAnnouncementsSeen`、`store.isAdmin`、`store.deleteAnnouncementOptimistic`、`store.showToast`；子元件 `AnnouncementAdminSheet`（Task 7）
- Produces: 具名 default export 元件 `<AnnouncementBanner />`，無 props（自行讀 store）

> 元件無自動化測試（沿用專案慣例），以 build + 手動驗證。Task 7 尚未建立前，本任務先以「Task 7 會建立的 AnnouncementAdminSheet」為前提撰寫 import；因此 Task 6、7 一起完成後才做手動驗證（見 Task 7 Step 3）。

- [ ] **Step 1: 建立元件**

建立 `src/components/AnnouncementBanner.vue`：

```vue
<!-- src/components/AnnouncementBanner.vue -->
<template>
  <div v-if="visible" class="ann">
    <button class="ann__bar" type="button" @click="toggle">
      <Megaphone :size="18" :stroke-width="2.2" class="ann__icon" />
      <span class="ann__title">{{ latest ? latest.title : '公告' }}</span>
      <span v-if="count > 1" class="ann__count">{{ count }} 則</span>
      <span v-if="hasUnread" class="ann__dot" aria-label="未讀公告"></span>
      <ChevronDown
        :size="18"
        :stroke-width="2.2"
        class="ann__chevron"
        :class="{ 'ann__chevron--open': expanded }"
      />
    </button>

    <AnimatePresence>
      <motion.div
        v-if="expanded"
        class="ann__list"
        :initial="{ opacity: 0, height: 0 }"
        :animate="{ opacity: 1, height: 'auto' }"
        :exit="{ opacity: 0, height: 0 }"
        :transition="{ duration: 0.22, ease: 'easeOut' }"
      >
        <p v-if="!list.length" class="ann__empty">目前沒有公告</p>

        <article v-for="a in list" :key="a.id" class="ann__item" :class="{ 'ann__item--expired': isExpired(a) }">
          <div class="ann__item-head">
            <Pin v-if="a.pinned" :size="14" :stroke-width="2.4" class="ann__pin" />
            <h3 class="ann__item-title">{{ a.title }}</h3>
            <div v-if="isAdmin" class="ann__actions">
              <button type="button" class="ann__action" @click="edit(a)">編輯</button>
              <button type="button" class="ann__action ann__action--danger" @click="remove(a)">刪除</button>
            </div>
          </div>
          <p v-if="a.body" class="ann__body">{{ a.body }}</p>
          <p v-if="a.expires_at" class="ann__expiry">有效至 {{ a.expires_at }}</p>
          <a
            v-if="a.link_url"
            :href="a.link_url"
            target="_blank"
            rel="noopener noreferrer"
            class="ann__link"
          >{{ a.link_label || '查看' }}</a>
        </article>

        <button v-if="isAdmin" type="button" class="ann__add" @click="add">＋ 新增公告</button>
      </motion.div>
    </AnimatePresence>

    <AnnouncementAdminSheet v-model:show="sheetOpen" :editing="editing" />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { motion, AnimatePresence } from 'motion-v'
import { Megaphone, ChevronDown, Pin } from 'lucide-vue-next'
import { useAppStore } from '../stores/app.js'
import { getTodayStr } from '../utils/date.js'
import AnnouncementAdminSheet from './AnnouncementAdminSheet.vue'

const store = useAppStore()

const list      = computed(() => store.isAdmin ? store.announcements : store.activeAnnouncements)
const count     = computed(() => store.activeAnnouncements.length)
const latest    = computed(() => store.latestAnnouncement)
const hasUnread = computed(() => store.hasUnreadAnnouncements)
const isAdmin   = computed(() => store.isAdmin)
// 有有效公告，或身分為 admin（讓 admin 在無公告時也能新增）
const visible   = computed(() => count.value > 0 || isAdmin.value)

const expanded  = ref(false)
const sheetOpen = ref(false)
const editing   = ref(null)

function toggle() {
  expanded.value = !expanded.value
  if (expanded.value) store.markAnnouncementsSeen()
}

function isExpired(a) {
  return !!a.expires_at && a.expires_at < getTodayStr()
}

function add() {
  editing.value = null
  sheetOpen.value = true
}

function edit(a) {
  editing.value = { ...a }
  sheetOpen.value = true
}

async function remove(a) {
  if (!window.confirm(`確定刪除公告「${a.title}」？`)) return
  try {
    await store.deleteAnnouncementOptimistic(a.id)
    store.showToast('公告已刪除', 'success')
  } catch (err) {
    store.showToast(`刪除失敗：${err.message}`, 'error', 4000)
  }
}
</script>

<style scoped>
.ann {
  margin: 0 16px 12px;
  background: var(--surface-tinted);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}
.ann__bar {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
}
.ann__icon { color: var(--primary); flex-shrink: 0; }
.ann__title {
  flex: 1;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ann__count {
  font-size: 12px;
  color: var(--text-secondary);
  flex-shrink: 0;
}
.ann__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--error);
  flex-shrink: 0;
}
.ann__chevron {
  color: var(--text-tertiary);
  transition: transform 0.2s ease;
  flex-shrink: 0;
}
.ann__chevron--open { transform: rotate(180deg); }

.ann__list {
  padding: 0 14px 12px;
  overflow: hidden;
}
.ann__empty {
  font-size: 13px;
  color: var(--text-tertiary);
  padding: 4px 0 8px;
}
.ann__item {
  padding: 10px 0;
  border-top: 1px solid var(--border);
}
.ann__item--expired { opacity: 0.5; }
.ann__item-head {
  display: flex;
  align-items: center;
  gap: 6px;
}
.ann__pin { color: var(--primary); flex-shrink: 0; }
.ann__item-title {
  flex: 1;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}
.ann__actions { display: flex; gap: 8px; flex-shrink: 0; }
.ann__action {
  font-size: 12px;
  color: var(--primary);
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px 4px;
}
.ann__action--danger { color: var(--error); }
.ann__body {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 4px 0 0;
  white-space: pre-wrap;
}
.ann__expiry {
  font-size: 12px;
  color: var(--text-tertiary);
  margin: 4px 0 0;
}
.ann__link {
  display: inline-block;
  margin-top: 8px;
  padding: 6px 14px;
  font-size: 13px;
  font-weight: 600;
  color: var(--on-primary);
  background: var(--primary);
  border-radius: var(--radius-sm);
  text-decoration: none;
}
.ann__add {
  width: 100%;
  margin-top: 10px;
  padding: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--primary);
  background: none;
  border: 1px dashed var(--primary);
  border-radius: var(--radius-sm);
  cursor: pointer;
}
</style>
```

- [ ] **Step 2: Commit（暫不驗證，待 Task 7 建立子元件）**

```bash
git add src/components/AnnouncementBanner.vue
git commit -m "feat(ui): add announcement banner component"
```

---

### Task 7: `AnnouncementAdminSheet.vue` 元件

**Files:**
- Create: `src/components/AnnouncementAdminSheet.vue`

**Interfaces:**
- Consumes: `store.saveAnnouncementOptimistic`、`store.showToast`
- Props: `show: boolean`、`editing: object | null`（`null` = 新增；物件 = 編輯，含 `id` 與各欄位）
- Emits: `update:show`（供 `v-model:show`）

- [ ] **Step 1: 建立元件**

建立 `src/components/AnnouncementAdminSheet.vue`：

```vue
<!-- src/components/AnnouncementAdminSheet.vue -->
<template>
  <Teleport to="body">
    <AnimatePresence>
      <motion.div
        v-if="show"
        key="ann-admin-backdrop"
        class="ann-sheet__backdrop"
        :initial="{ opacity: 0 }"
        :animate="{ opacity: 1 }"
        :exit="{ opacity: 0 }"
        :transition="{ duration: 0.2 }"
        @click.self="close"
      >
        <motion.div
          class="ann-sheet"
          role="dialog"
          :aria-label="isEdit ? '編輯公告' : '新增公告'"
          :initial="{ y: '100%' }"
          :animate="{ y: 0 }"
          :exit="{ y: '100%' }"
          :transition="{ type: 'spring', stiffness: 300, damping: 30 }"
        >
          <div class="ann-sheet__header">
            <div class="ann-sheet__handle" aria-hidden="true"></div>
            <h2 class="ann-sheet__title">{{ isEdit ? '編輯公告' : '新增公告' }}</h2>
            <button class="ann-sheet__close" aria-label="關閉" @click="close">
              <X :size="20" :stroke-width="2" />
            </button>
          </div>

          <form class="ann-sheet__body" @submit.prevent="submit">
            <label class="ann-field">
              <span class="ann-field__label">標題 *</span>
              <input v-model.trim="form.title" class="ann-field__input" type="text" placeholder="公告標題" />
            </label>

            <label class="ann-field">
              <span class="ann-field__label">內文</span>
              <textarea v-model.trim="form.body" class="ann-field__input" rows="3" placeholder="公告內容（可留空）"></textarea>
            </label>

            <label class="ann-field">
              <span class="ann-field__label">連結網址</span>
              <input v-model.trim="form.link_url" class="ann-field__input" type="url" placeholder="https://…（可留空）" />
            </label>

            <label class="ann-field">
              <span class="ann-field__label">按鈕文字</span>
              <input v-model.trim="form.link_label" class="ann-field__input" type="text" placeholder="預設「查看」" />
            </label>

            <label class="ann-field">
              <span class="ann-field__label">到期日</span>
              <input v-model="form.expires_at" class="ann-field__input" type="date" />
            </label>

            <label class="ann-check">
              <input v-model="form.pinned" type="checkbox" />
              <span>釘選／標為重要</span>
            </label>

            <button class="ann-sheet__submit" type="submit" :disabled="!form.title || saving">
              {{ saving ? '儲存中…' : '儲存' }}
            </button>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  </Teleport>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue'
import { motion, AnimatePresence } from 'motion-v'
import { X } from 'lucide-vue-next'
import { useAppStore } from '../stores/app.js'

const props = defineProps({
  show:    { type: Boolean, default: false },
  editing: { type: Object,  default: null },
})
const emit = defineEmits(['update:show'])

const store  = useAppStore()
const saving = ref(false)
const isEdit = computed(() => !!(props.editing && props.editing.id))

const form = reactive({
  id: null, title: '', body: '', link_url: '', link_label: '', expires_at: '', pinned: false,
})

// 開啟時依 editing 帶入或清空表單
watch(() => props.show, (open) => {
  if (!open) return
  const e = props.editing
  form.id         = e?.id ?? null
  form.title      = e?.title ?? ''
  form.body       = e?.body ?? ''
  form.link_url   = e?.link_url ?? ''
  form.link_label = e?.link_label ?? ''
  form.expires_at = e?.expires_at ?? ''
  form.pinned     = e?.pinned ?? false
})

function close() {
  emit('update:show', false)
}

async function submit() {
  if (!form.title || saving.value) return
  saving.value = true
  const payload = {
    title: form.title,
    body: form.body,
    link_url: form.link_url,
    link_label: form.link_label,
    expires_at: form.expires_at,
    pinned: form.pinned,
  }
  if (form.id && !String(form.id).startsWith('temp-')) payload.id = form.id
  try {
    await store.saveAnnouncementOptimistic(payload)
    store.showToast(isEdit.value ? '公告已更新' : '公告已新增', 'success')
    close()
  } catch (err) {
    store.showToast(`儲存失敗：${err.message}`, 'error', 4000)
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.ann-sheet__backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 1000;
}
.ann-sheet {
  width: 100%;
  max-width: 480px;
  background: var(--surface);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  max-height: 88vh;
  display: flex;
  flex-direction: column;
}
.ann-sheet__header {
  position: relative;
  padding: 10px 16px 8px;
  border-bottom: 1px solid var(--border);
}
.ann-sheet__handle {
  width: 36px;
  height: 4px;
  border-radius: 2px;
  background: var(--border);
  margin: 0 auto 8px;
}
.ann-sheet__title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
  text-align: center;
}
.ann-sheet__close {
  position: absolute;
  top: 8px;
  right: 12px;
  background: none;
  border: none;
  color: var(--text-tertiary);
  cursor: pointer;
}
.ann-sheet__body {
  padding: 16px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.ann-field { display: flex; flex-direction: column; gap: 6px; }
.ann-field__label { font-size: 13px; font-weight: 600; color: var(--text-secondary); }
.ann-field__input {
  width: 100%;
  padding: 10px 12px;
  font-size: 14px;
  color: var(--text-primary);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  box-sizing: border-box;
}
.ann-check {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--text-primary);
}
.ann-sheet__submit {
  margin-top: 4px;
  padding: 12px;
  font-size: 15px;
  font-weight: 700;
  color: var(--on-primary);
  background: var(--primary);
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
}
.ann-sheet__submit:disabled { opacity: 0.5; cursor: default; }
</style>
```

- [ ] **Step 2: 驗證整體 build 與測試**

Run: `npm test && npm run build`
Expected: 測試全 PASS；build 成功無錯誤（元件 import 解析正常）。

- [ ] **Step 3: 手動驗證（dev）**

Run: `npm run dev`，瀏覽器開首頁。
Expected（一般成員）：有有效公告時橫幅顯示最新標題；點開展開全部；有未讀時右側顯示紅點，展開後紅點消失（重整仍不顯示）。
Expected（admin，網址帶 `?token=<VITE_ADMIN_TOKEN>`）：即使無公告也看得到橫幅入口；展開後有「＋ 新增公告」；新增／編輯／刪除即時反映；連結按鈕可點開新分頁。

- [ ] **Step 4: Commit**

```bash
git add src/components/AnnouncementAdminSheet.vue
git commit -m "feat(ui): add announcement admin sheet"
```

---

### Task 8: 接入 WeekView 首頁

**Files:**
- Modify: `src/views/WeekView.vue`

**Interfaces:**
- Consumes: `<AnnouncementBanner />`（Task 6）

- [ ] **Step 1: import 元件**

在 `src/views/WeekView.vue` 的 `<script setup>` 既有 import 區塊加入：

```javascript
import AnnouncementBanner from '../components/AnnouncementBanner.vue'
```

- [ ] **Step 2: 放入模板（hero 之後、sheet 之前）**

在 `</motion.header>`（hero 結尾）與 `<!-- Sheet -->` 之間插入：

```html
    </motion.header>

    <AnnouncementBanner />

    <!-- Sheet -->
```

- [ ] **Step 3: 驗證 build**

Run: `npm run build`
Expected: 成功。

- [ ] **Step 4: 手動驗證**

Run: `npm run dev`，確認橫幅出現在首頁 hero 與名單之間、無公告且非 admin 時完全不佔版面。

- [ ] **Step 5: Commit**

```bash
git add src/views/WeekView.vue
git commit -m "feat(ui): show announcement banner on home view"
```

---

## Self-Review 結果

- **Spec coverage：** 資料模型→Task 1；後端 3 個 action→Task 1；前端 API→Task 2；store 載入/快取/`activeAnnouncements`/`latestAnnouncement`→Task 3；未讀紅點→Task 4；樂觀更新（無墓碑）→Task 5；橫幅收合/展開/連結按鈕/釘選→Task 6；admin CRUD sheet→Task 7；WeekView 接入→Task 8。過期只隱藏不刪、當天算有效、admin 看得到過期項皆已覆蓋。
- **Placeholder scan：** 無 TBD/TODO；所有程式與測試皆為完整內容。
- **Type consistency：** `Announcement` 欄位（`id/title/body/link_url/link_label/pinned/expires_at/created_at`）在 GAS、API、store、元件一致；action 名稱 `getAnnouncements/saveAnnouncement/deleteAnnouncement` 一致；store 對外 `activeAnnouncements/latestAnnouncement/hasUnreadAnnouncements/markAnnouncementsSeen/saveAnnouncementOptimistic/deleteAnnouncementOptimistic` 名稱前後一致。
- **已知順序相依：** Task 6 import 了 Task 7 才建立的 `AnnouncementAdminSheet.vue`，故驗證延到 Task 7 Step 2/3；請依序執行。
