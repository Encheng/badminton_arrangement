# YouTube 影片連結到場次 — 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**目標：** 在歷史場次卡片上加入「影片」按鈕，點擊後彈出 modal 列出該日的 YouTube 錄影，點擊影片開新分頁到 YouTube。

**架構：** GAS 後端讀取 YouTube 頻道 RSS，從影片標題解析 `session_date` 與 `match_no`，upsert 進新增的 `videos` sheet。前端在 init / refresh 時與 sessions 平行抓取影片清單，依日期建立索引。卡片顯示影片數量按鈕，點擊開啟 modal，每列點擊跳轉至 YouTube。

**技術堆疊：** Google Apps Script (XmlService, UrlFetchApp), Vue 3 + Pinia, Vitest, lucide-vue-next, motion-v.

**規格文件：** [docs/superpowers/specs/2026-04-27-youtube-videos-per-session-design.md](../specs/2026-04-27-youtube-videos-per-session-design.md)

---

## 檔案結構

**新增檔案：**
- `src/components/VideoListModal.vue` — bottom-sheet 樣式的 modal，列出該場影片清單

**修改檔案：**
- `gas/Code.gs` — 新增 `_fetchYouTubeRss`, `_syncVideos`, `_createVideosSheet`, `_getVideos`，並接到 `getVideos` action
- `src/services/api.js` — 新增 `getVideos` 方法
- `src/services/__tests__/api.test.js` — 新增 `getVideos` 的測試
- `src/stores/app.js` — 新增 `videos` ref、`videosByDate` computed、`_fetchAll` 平行抓取
- `src/stores/__tests__/app.test.js` — 擴充 mock + 新增 `videosByDate` 測試
- `src/components/HistoryCard.vue` — 新增 `videoCount` prop、影片按鈕、`view-videos` emit
- `src/components/SessionCard.vue` — 同 HistoryCard，但僅在過去場次顯示
- `src/views/HistoryView.vue` — 串接 modal state，傳入 `video-count`
- `src/views/SessionsView.vue` — 串接 modal state，傳入 `video-count`

**手動變更（非程式碼）：**
- Google Sheet `config` 分頁：新增一列 `youtube_channel_id | UCR6UdT-GtpcdHWfTCUbfxHg`
- GAS 部署：`Code.gs` 改完後依現行流程重新部署

---

## 第 1 階段 — GAS 後端

GAS 程式碼不在現有 JS 測試套件範圍內，驗證方式為部署後用 curl / 瀏覽器打 endpoint。

### Task 1：在 `Code.gs` 新增 RSS 同步輔助函式與 `getVideos` action

**檔案：**
- 修改：`gas/Code.gs`

- [ ] **步驟 1：在 `doGet` 加入 `getVideos` action**

在 `gas/Code.gs` 找到 `doGet` 函式（第 7–20 行），在 action dispatch 加入 `getVideos`：

```js
function doGet(e) {
  const action = e.parameter.action
  const ss = SpreadsheetApp.getActiveSpreadsheet()
  try {
    let data
    if      (action === 'getConfig')   data = _getConfig(ss, false)
    else if (action === 'getMembers')  data = _getMembers(ss)
    else if (action === 'getSessions') data = _getSessions(ss)
    else if (action === 'getVideos')   data = _getVideos(ss)
    else return _json({ status: 'error', message: 'Unknown action: ' + action })
    return _json({ status: 'ok', data })
  } catch (err) {
    return _json({ status: 'error', message: err.message })
  }
}
```

- [ ] **步驟 2：新增 `_fetchYouTubeRss` 輔助函式**

在 `gas/Code.gs` 結尾追加：

```js
function _fetchYouTubeRss(channelId) {
  const url = 'https://www.youtube.com/feeds/videos.xml?channel_id=' + channelId
  const resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true })
  if (resp.getResponseCode() !== 200) {
    throw new Error('RSS fetch failed: ' + resp.getResponseCode())
  }
  const xml = XmlService.parse(resp.getContentText())
  const root = xml.getRootElement()
  const ns = XmlService.getNamespace('http://www.w3.org/2005/Atom')
  const ytNs = XmlService.getNamespace('yt', 'http://www.youtube.com/xml/schemas/2015')

  return root.getChildren('entry', ns).map(function(entry) {
    return {
      video_id:     entry.getChild('videoId', ytNs).getText(),
      title:        entry.getChild('title', ns).getText(),
      published_at: entry.getChild('published', ns).getText(),
    }
  })
}
```

- [ ] **步驟 3：新增 `_createVideosSheet` 輔助函式**

在 `gas/Code.gs` 結尾追加：

```js
function _createVideosSheet(ss) {
  const sheet = ss.insertSheet('videos')
  sheet.appendRow(['video_id', 'session_date', 'match_no', 'title', 'published_at', 'synced_at'])
  return sheet
}
```

- [ ] **步驟 4：新增 `_syncVideos` 輔助函式**

在 `gas/Code.gs` 結尾追加：

```js
function _syncVideos(ss) {
  const config = _getConfig(ss, false)
  const channelId = config.youtube_channel_id
  if (!channelId) return { synced: 0, skipped: 0 }

  const sheet = ss.getSheetByName('videos') || _createVideosSheet(ss)
  const existingRows = sheet.getDataRange().getValues().slice(1)
  const existingIds = {}
  existingRows.forEach(function(r) { existingIds[r[0]] = true })

  const entries = _fetchYouTubeRss(channelId)
  const now = new Date().toISOString()
  const TITLE_RE = /^(\d{8})\s.+\s(\d+)$/

  let synced = 0, skipped = 0
  entries.forEach(function(e) {
    if (existingIds[e.video_id]) { skipped++; return }
    const m = e.title.match(TITLE_RE)
    if (!m) { skipped++; return }
    const dateStr = m[1].slice(0,4) + '-' + m[1].slice(4,6) + '-' + m[1].slice(6,8)
    if (isNaN(new Date(dateStr).getTime())) { skipped++; return }
    sheet.appendRow([
      e.video_id, dateStr, Number(m[2]),
      e.title, e.published_at, now
    ])
    synced++
  })
  return { synced: synced, skipped: skipped }
}
```

- [ ] **步驟 5：新增 `_getVideos` 輔助函式**

在 `gas/Code.gs` 結尾追加：

```js
function _getVideos(ss) {
  try {
    _syncVideos(ss)
  } catch (err) {
    console.error('Video sync failed: ' + err.message)
  }
  const sheet = ss.getSheetByName('videos')
  if (!sheet) return []
  const rows = sheet.getDataRange().getValues().slice(1)
  return rows
    .map(function(r) {
      return {
        video_id:     r[0],
        session_date: _formatDate(r[1]),
        match_no:     Number(r[2]),
        title:        r[3],
        published_at: String(r[4] || ''),
      }
    })
    .sort(function(a, b) {
      if (a.session_date !== b.session_date) return b.session_date.localeCompare(a.session_date)
      return a.match_no - b.match_no
    })
}
```

- [ ] **步驟 6：Commit**

```bash
git add gas/Code.gs
git commit -m "feat(gas): add YouTube RSS sync and getVideos endpoint"
```

---

### Task 2：手動 — 設定 sheet 並部署 GAS

**檔案：** 無（在 Google Sheet UI 與 GAS 編輯器手動操作）

- [ ] **步驟 1：在 Google Sheet 加入 config**

開啟連動的 Google Spreadsheet → `config` 分頁 → 新增一列：

| 欄 A | 欄 B |
|------|------|
| `youtube_channel_id` | `UCR6UdT-GtpcdHWfTCUbfxHg` |

- [ ] **步驟 2：部署更新後的 GAS**

在 GAS 編輯器（綁定該試算表的 script）：
1. 將 `Code.gs` 內容換成 worktree 內的 `gas/Code.gs`
2. 點 `部署` → `管理部署` → 既有部署 → 編輯（鉛筆圖示）→ `版本` → `新版本` → `部署`
3. 記下新部署 URL（應該與 `VITE_GAS_URL` 相同；若改變，複製新 URL）

- [ ] **步驟 3：對 endpoint 做 smoke test**

在瀏覽器打：
```
<VITE_GAS_URL>?action=getVideos
```

預期：JSON 回應 `status: "ok"` 且 `data: [...]` 含約 15 筆影片。`videos` 分頁應該已自動建立並寫入資料。如果 `data` 是 `[]` 且 sheet 為空，請再次確認 `youtube_channel_id` 是否與 `UCR6UdT-GtpcdHWfTCUbfxHg` 完全相符。

- [ ] **步驟 4：確認資料格式**

檢查單筆 entry 包含欄位：`video_id`（11 碼字串）、`session_date`（`YYYY-MM-DD`）、`match_no`（數字）、`title`（字串）、`published_at`（ISO 字串）。

無 commit（純手動步驟）。

---

## 第 2 階段 — 前端 API 與 Store

### Task 3：新增 `api.getVideos` 方法與測試（TDD）

**檔案：**
- 修改：`src/services/api.js`
- 修改：`src/services/__tests__/api.test.js`

- [ ] **步驟 1：寫一個會失敗的測試**

在 `src/services/__tests__/api.test.js` 結尾追加：

```js
describe('api.getVideos', () => {
  it('calls GET with action=getVideos and returns data', async () => {
    const mockData = [
      { video_id: 'abc123', session_date: '2026-04-18', match_no: 1, title: '20260418 ... 1', published_at: '2026-04-21T02:29:07Z' },
    ]
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: 'ok', data: mockData }),
    })

    const result = await api.getVideos()

    expect(fetch).toHaveBeenCalledWith(`${FAKE_URL}?action=getVideos`)
    expect(result).toEqual(mockData)
  })
})
```

- [ ] **步驟 2：執行測試確認失敗**

```bash
npx vitest run src/services/__tests__/api.test.js
```

預期：`api.getVideos is not a function` 或類似錯誤。

- [ ] **步驟 3：在 `src/services/api.js` 加入 `getVideos`**

在 `api` 物件內加一行（`getSessions:` 之後）：

```js
export const api = {
  getConfig:    ()                              => gasGet('getConfig'),
  getMembers:   ()                              => gasGet('getMembers'),
  getSessions:  ()                              => gasGet('getSessions'),
  getVideos:    ()                              => gasGet('getVideos'),
  saveSession:   (token, date, attendances)      => gasPost('saveSession',   { admin_token: token, date, attendances }),
  deleteSession: (token, session_id)             => gasPost('deleteSession', { admin_token: token, session_id }),
  saveMember:   (token, member)                 => gasPost('saveMember',   { admin_token: token, ...member }),
  promoteGuest: (token, guest_key, member_id)   => gasPost('promoteGuest', { admin_token: token, guest_key, member_id }),
  demoteMember: (token, member_id)              => gasPost('demoteMember', { admin_token: token, member_id }),
}
```

- [ ] **步驟 4：執行測試確認通過**

```bash
npx vitest run src/services/__tests__/api.test.js
```

預期：所有測試通過，包含新的 `api.getVideos`。

- [ ] **步驟 5：Commit**

```bash
git add src/services/api.js src/services/__tests__/api.test.js
git commit -m "feat(api): add getVideos endpoint client"
```

---

### Task 4：新增 `videos` state、`videosByDate` computed、fetch 串接（TDD）

**檔案：**
- 修改：`src/stores/app.js`
- 修改：`src/stores/__tests__/app.test.js`

- [ ] **步驟 1：擴充既有 mock 加入 `getVideos`**

在 `src/stores/__tests__/app.test.js` 修改 `vi.mock` 區塊（第 6–19 行），加入 `getVideos`：

```js
vi.mock('../../services/api.js', () => ({
  api: {
    getConfig:  vi.fn().mockResolvedValue({ venue_name: '大安體育場', time_start: '09:00', time_end: '11:00', day_of_week: '六' }),
    getMembers: vi.fn().mockResolvedValue([
      { id: 'm1', name: 'Peter', active: true },
    ]),
    getSessions: vi.fn().mockResolvedValue([
      {
        session_id: 's1', date: '2026-04-12',
        attendances: [{ member_id: 'm1', name: 'Peter', type: 'member' }],
      },
    ]),
    getVideos: vi.fn().mockResolvedValue([
      { video_id: 'v1', session_date: '2026-04-12', match_no: 1, title: '20260412 Peter 1', published_at: '2026-04-13T00:00:00Z' },
      { video_id: 'v2', session_date: '2026-04-12', match_no: 2, title: '20260412 Peter 2', published_at: '2026-04-13T00:00:00Z' },
      { video_id: 'v3', session_date: '2026-04-05', match_no: 1, title: '20260405 Peter 1', published_at: '2026-04-06T00:00:00Z' },
    ]),
  },
}))
```

- [ ] **步驟 2：寫會失敗的 videos 與 `videosByDate` 測試**

在 `describe('useAppStore', ...)` 區塊內追加：

```js
  it('loads videos on init', async () => {
    const store = useAppStore()
    await store.init()
    expect(store.videos).toHaveLength(3)
  })

  it('videosByDate groups videos by session_date', async () => {
    const store = useAppStore()
    await store.init()
    expect(store.videosByDate['2026-04-12']).toHaveLength(2)
    expect(store.videosByDate['2026-04-05']).toHaveLength(1)
    expect(store.videosByDate['2026-04-12'][0].match_no).toBe(1)
  })

  it('falls back to empty videos array when getVideos rejects', async () => {
    const { api } = await import('../../services/api.js')
    api.getVideos.mockRejectedValueOnce(new Error('RSS down'))
    const store = useAppStore()
    await store.init()
    expect(store.videos).toEqual([])
  })
```

- [ ] **步驟 3：執行測試確認失敗**

```bash
npx vitest run src/stores/__tests__/app.test.js
```

預期：3 個新測試失敗（`store.videos is undefined` 之類）。

- [ ] **步驟 4：新增 `videos` state 與 `videosByDate` computed**

在 `src/stores/app.js` 將第 6–10 行修改，加入 videos ref：

```js
export const useAppStore = defineStore('app', () => {
  const config   = ref({})
  const members  = ref([])
  const sessions = ref([])
  const videos   = ref([])
  const loading  = ref(true)
  const _token   = ref(localStorage.getItem('admin_token') || null)
```

在 `allUniqueGuests` computed 之後（約第 33 行附近）追加：

```js
  const videosByDate = computed(() => {
    const map = {}
    for (const v of videos.value) {
      (map[v.session_date] ||= []).push(v)
    }
    return map
  })
```

- [ ] **步驟 5：將 video fetch 串入 `_fetchAll`**

在 `src/stores/app.js` 將 `_fetchAll`（第 70–82 行）整段替換為：

```js
  async function _fetchAll() {
    const [cfg, mems, sess, vids] = await Promise.all([
      api.getConfig(),
      api.getMembers(),
      api.getSessions(),
      api.getVideos().catch(err => {
        console.error('Videos fetch failed:', err)
        return []
      }),
    ])
    if (cfg.time_start) cfg.time_start = _normalizeTime(cfg.time_start)
    if (cfg.time_end)   cfg.time_end   = _normalizeTime(cfg.time_end)
    sess.forEach(s => { s.date = _normalizeDate(s.date) })
    config.value   = cfg
    members.value  = mems
    sessions.value = sess
    videos.value   = vids
  }
```

- [ ] **步驟 6：在 store return 加上新欄位**

修改 return 那行（第 98 行）加上 `videos` 與 `videosByDate`：

```js
  return { config, members, sessions, videos, loading, isAdmin, adminToken, activeMembers, allUniqueGuests, videosByDate, setAdminToken, clearAdminToken, init, refresh }
})
```

- [ ] **步驟 7：執行測試確認通過**

```bash
npx vitest run src/stores/__tests__/app.test.js
```

預期：全部通過（包含 3 個新測試）。

- [ ] **步驟 8：執行完整測試套件**

```bash
npx vitest run
```

預期：全部通過。

- [ ] **步驟 9：Commit**

```bash
git add src/stores/app.js src/stores/__tests__/app.test.js
git commit -m "feat(store): load videos and expose videosByDate index"
```

---

## 第 3 階段 — Modal 元件

### Task 5：建立 `VideoListModal.vue`

**檔案：**
- 新增：`src/components/VideoListModal.vue`

- [ ] **步驟 1：建立檔案，內容如下**

新增 `src/components/VideoListModal.vue`：

```vue
<!-- src/components/VideoListModal.vue -->
<template>
  <Teleport to="body">
    <AnimatePresence>
      <motion.div
        v-if="show"
        key="video-backdrop"
        class="modal-backdrop"
        :initial="{ opacity: 0 }"
        :animate="{ opacity: 1 }"
        :exit="{ opacity: 0 }"
        :transition="{ duration: 0.2 }"
        @click.self="$emit('update:show', false)"
      >
        <motion.div
          class="modal"
          role="dialog"
          aria-label="場次影片"
          :initial="{ y: '100%' }"
          :animate="{ y: 0 }"
          :exit="{ y: '100%' }"
          :transition="{ type: 'spring', stiffness: 300, damping: 30 }"
        >
          <div class="modal__header">
            <h2 class="modal__title">{{ formattedDate }} 的影片</h2>
            <button
              class="modal__close"
              aria-label="關閉"
              @click="$emit('update:show', false)"
            >
              <X :size="20" :stroke-width="2" />
            </button>
          </div>

          <ol class="video-list" aria-label="影片清單">
            <li
              v-for="v in videos"
              :key="v.video_id"
              class="video-item"
              role="link"
              tabindex="0"
              @click="openVideo(v.video_id)"
              @keydown.enter="openVideo(v.video_id)"
            >
              <div class="video-item__thumb">
                <img
                  :src="`https://i.ytimg.com/vi/${v.video_id}/mqdefault.jpg`"
                  :alt="`第 ${v.match_no} 局縮圖`"
                  loading="lazy"
                  @error="onThumbError"
                >
                <div class="video-item__thumb-fallback" aria-hidden="true">
                  <Play :size="20" :stroke-width="2" />
                </div>
              </div>
              <div class="video-item__body">
                <p class="video-item__match">第 {{ v.match_no }} 局</p>
                <p class="video-item__names">{{ extractNames(v.title) }}</p>
              </div>
            </li>
          </ol>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  </Teleport>
</template>

<script setup>
import { computed } from 'vue'
import { motion, AnimatePresence } from 'motion-v'
import { X, Play } from 'lucide-vue-next'

const props = defineProps({
  show:        { type: Boolean, default: false },
  sessionDate: { type: String,  default: '' },
  videos:      { type: Array,   default: () => [] },
})

defineEmits(['update:show'])

const formattedDate = computed(() => {
  if (!props.sessionDate) return ''
  const d = new Date(props.sessionDate + 'T00:00:00')
  return new Intl.DateTimeFormat('zh-TW', {
    year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short',
  }).format(d)
})

function extractNames(title) {
  return title.replace(/^\d{8}\s/, '').replace(/\s\d+$/, '')
}

function openVideo(videoId) {
  window.open(`https://www.youtube.com/watch?v=${videoId}`, '_blank', 'noopener')
}

function onThumbError(e) {
  e.target.style.display = 'none'
  const fallback = e.target.nextElementSibling
  if (fallback) fallback.style.display = 'flex'
}
</script>

<style scoped>
.modal-backdrop {
  position: fixed; inset: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 1000;
  display: flex; align-items: flex-end; justify-content: center;
}
.modal {
  background: var(--surface);
  border-radius: 16px 16px 0 0;
  width: 100%;
  max-width: 600px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
.modal__header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 20px 12px;
  border-bottom: 1px solid var(--border);
}
.modal__title {
  font-size: 16px; font-weight: 700; color: var(--text-primary);
  margin: 0;
}
.modal__close {
  background: none; border: none; padding: 4px;
  color: var(--text-tertiary); cursor: pointer;
  display: flex; align-items: center;
  touch-action: manipulation;
}
.video-list {
  list-style: none; margin: 0; padding: 8px 12px;
  overflow-y: auto;
  display: flex; flex-direction: column; gap: 8px;
}
.video-item {
  display: flex; gap: 12px;
  padding: 8px;
  border-radius: 8px;
  cursor: pointer;
  touch-action: manipulation;
  transition: background 0.15s ease;
}
.video-item:active { background: var(--surface-tinted, #f5f0ff); }
@media (hover: hover) {
  .video-item:hover { background: var(--surface-tinted, #f5f0ff); }
}
.video-item__thumb {
  position: relative;
  flex: 0 0 120px;
  aspect-ratio: 16 / 9;
  border-radius: 6px;
  overflow: hidden;
  background: var(--border);
}
.video-item__thumb img {
  width: 100%; height: 100%; object-fit: cover;
  display: block;
}
.video-item__thumb-fallback {
  display: none;
  position: absolute; inset: 0;
  align-items: center; justify-content: center;
  color: var(--text-tertiary);
  background: var(--border);
}
.video-item__body {
  display: flex; flex-direction: column; justify-content: center;
  min-width: 0;
  flex: 1;
}
.video-item__match {
  font-size: 14px; font-weight: 700; color: var(--text-primary);
  margin: 0 0 2px 0;
}
.video-item__names {
  font-size: 12px; color: var(--text-secondary);
  margin: 0;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
</style>
```

- [ ] **步驟 2：用 dev build 確認檔案語法可用**

```bash
npm run dev
```

打開 app 看 console 沒有跟 `VideoListModal` 相關的錯誤即可（這個元件還沒被任何 view 使用，只是確認語法 OK）。停掉 dev server。

- [ ] **步驟 3：Commit**

```bash
git add src/components/VideoListModal.vue
git commit -m "feat: add VideoListModal component"
```

---

## 第 4 階段 — 卡片整合

### Task 6：在 `HistoryCard.vue` 加上影片按鈕

**檔案：**
- 修改：`src/components/HistoryCard.vue`

- [ ] **步驟 1：加入 prop、emit 與 template 按鈕**

將整份 `src/components/HistoryCard.vue` 替換為：

```vue
<!-- src/components/HistoryCard.vue -->
<template>
  <motion.li
    class="card"
    :initial="{ opacity: 0, y: 16 }"
    :animate="{ opacity: 1, y: 0 }"
    :transition="{ duration: 0.3, ease: 'easeOut' }"
    :whileHover="{ y: -2, boxShadow: '0 6px 20px rgba(0,0,0,0.08)' }"
  >
    <time class="card__date" :datetime="session.date">
      {{ formattedDate }}
    </time>
    <p class="card__names">{{ nameList }}</p>
    <div class="card__footer">
      <p class="card__count">
        {{ session.attendances.length }} 人出席
      </p>
      <button
        v-if="videoCount > 0"
        class="card__videos-btn"
        @click.stop="$emit('view-videos')"
      >
        <Video :size="14" :stroke-width="2" />
        {{ videoCount }} 支影片
      </button>
    </div>
  </motion.li>
</template>

<script setup>
import { computed } from 'vue'
import { motion } from 'motion-v'
import { Video } from 'lucide-vue-next'

const props = defineProps({
  session:    { type: Object,  required: true },
  videoCount: { type: Number,  default: 0 },
})

defineEmits(['view-videos'])

const formattedDate = computed(() => {
  const d = new Date(props.session.date + 'T00:00:00')
  return new Intl.DateTimeFormat('zh-TW', {
    year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short',
  }).format(d)
})

const nameList = computed(() =>
  props.session.attendances.map(a => a.name).join('、')
)
</script>

<style scoped>
.card {
  background: var(--surface);
  border-radius: var(--radius-md);
  padding: 14px 16px;
  border: 1px solid var(--border);
  box-shadow: var(--shadow-sm);
  list-style: none;
}
.card__date  { font-size: 12px; color: var(--text-tertiary); margin-bottom: 3px; display: block; }
.card__names {
  font-size: 14px; font-weight: 600; color: var(--text-primary);
  margin-bottom: 4px;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.card__footer {
  display: flex; align-items: center; justify-content: space-between;
}
.card__count { font-size: 12px; font-weight: 700; color: var(--secondary-variant); font-variant-numeric: tabular-nums; }
.card__videos-btn {
  background: none;
  border: 1.5px solid var(--primary);
  color: var(--primary);
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 700;
  display: inline-flex; align-items: center; gap: 4px;
  cursor: pointer;
  touch-action: manipulation;
  transition: background 0.15s ease, color 0.15s ease;
}
.card__videos-btn:active {
  background: var(--primary);
  color: var(--on-primary);
}
@media (hover: hover) {
  .card__videos-btn:hover {
    background: var(--primary);
    color: var(--on-primary);
  }
}
</style>
```

- [ ] **步驟 2：Commit**

```bash
git add src/components/HistoryCard.vue
git commit -m "feat: HistoryCard shows video count button"
```

---

### Task 7：在 `SessionCard.vue` 加上影片按鈕（僅過去場次）

**檔案：**
- 修改：`src/components/SessionCard.vue`

- [ ] **步驟 1：加入 prop、emit、修改 template**

在 `src/components/SessionCard.vue`：

(a) 修改 template 中 `card__footer` 區塊（第 19–37 行），在 `card__actions` **之前**插入影片按鈕：

```vue
    <div class="card__footer">
      <span class="card__count">
        {{ session.attendances.length }} 人{{ isFuture ? '預定' : '出席' }}
      </span>
      <button
        v-if="!isFuture && !isCurrent && videoCount > 0"
        class="card__videos-btn"
        @click.stop="$emit('view-videos')"
      >
        <Video :size="14" :stroke-width="2" />
        {{ videoCount }} 支影片
      </button>
      <div v-if="editable" class="card__actions">
        <button
          class="card__copy-btn"
          aria-label="複製此場次"
          @click="$emit('copy', session)"
        >
          複製
        </button>
        <button
          class="card__edit-btn"
          aria-label="編輯此場次"
          @click="$emit('edit', session)"
        >
          編輯
        </button>
        <button
          class="card__delete-btn"
          aria-label="刪除此場次"
          @click="$emit('delete', session)"
        >
          刪除
        </button>
      </div>
    </div>
```

(b) 修改 `<script setup>` 區塊（第 53–62 行），加入 prop、emit、import：

```js
import { computed } from 'vue'
import { motion } from 'motion-v'
import { Video } from 'lucide-vue-next'

const props = defineProps({
  session:    { type: Object,  required: true },
  isFuture:   { type: Boolean, default: false },
  isCurrent:  { type: Boolean, default: false },
  editable:   { type: Boolean, default: false },
  videoCount: { type: Number,  default: 0 },
})

defineEmits(['edit', 'delete', 'copy', 'view-videos'])
```

(c) 在 `<style scoped>` 區塊結尾（第 212 行 `</style>` 之前）追加：

```css
.card__videos-btn {
  background: none;
  border: 1.5px solid var(--primary);
  color: var(--primary);
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 700;
  display: inline-flex; align-items: center; gap: 4px;
  cursor: pointer;
  touch-action: manipulation;
  transition: background 0.15s ease, color 0.15s ease;
}
.card__videos-btn:active {
  background: var(--primary);
  color: var(--on-primary);
}
@media (hover: hover) {
  .card__videos-btn:hover {
    background: var(--primary);
    color: var(--on-primary);
  }
}
```

- [ ] **步驟 2：Commit**

```bash
git add src/components/SessionCard.vue
git commit -m "feat: SessionCard shows video count for past sessions"
```

---

## 第 5 階段 — View 串接

### Task 8：串接 `HistoryView.vue`

**檔案：**
- 修改：`src/views/HistoryView.vue`

- [ ] **步驟 1：傳入 `video-count`、加入 modal**

在既有 template，將 `HistoryCard` 元素（約第 41 行附近）從：

```vue
        <HistoryCard
          v-for="session in pastSessions"
          :key="session.session_id"
          :session="session"
        />
```

改為：

```vue
        <HistoryCard
          v-for="session in pastSessions"
          :key="session.session_id"
          :session="session"
          :video-count="(store.videosByDate[session.date] || []).length"
          @view-videos="openVideoModal(session)"
        />
```

在 `</motion.main>` 結束標籤之前追加：

```vue
        <VideoListModal
          v-model:show="videoModalOpen"
          :session-date="selectedSessionDate"
          :videos="selectedSessionVideos"
        />
```

- [ ] **步驟 2：在 script 加入 modal state**

在 `<script setup>` 找到既有 import（約第 51–55 行）：

```js
import { computed } from 'vue'
import { motion } from 'motion-v'
import { useAppStore } from '../stores/app.js'
import HistoryCard from '../components/HistoryCard.vue'
import SkeletonBlock from '../components/SkeletonBlock.vue'
```

替換為：

```js
import { computed, ref } from 'vue'
import { motion } from 'motion-v'
import { useAppStore } from '../stores/app.js'
import HistoryCard from '../components/HistoryCard.vue'
import SkeletonBlock from '../components/SkeletonBlock.vue'
import VideoListModal from '../components/VideoListModal.vue'
```

在 `avgAttendance` computed 之後（約第 70 行附近）追加：

```js
const videoModalOpen = ref(false)
const selectedSession = ref(null)
function openVideoModal(session) {
  selectedSession.value = session
  videoModalOpen.value = true
}
const selectedSessionDate = computed(() => selectedSession.value?.date || '')
const selectedSessionVideos = computed(() =>
  selectedSession.value ? store.videosByDate[selectedSession.value.date] || [] : []
)
```

- [ ] **步驟 3：Commit**

```bash
git add src/views/HistoryView.vue
git commit -m "feat(history): wire video list modal"
```

---

### Task 9：串接 `SessionsView.vue`

**檔案：**
- 修改：`src/views/SessionsView.vue`

- [ ] **步驟 1：在「歷史記錄」section 的 `<SessionCard>` 加上 `video-count`**

在 `src/views/SessionsView.vue`，找到「歷史記錄」section 內 `SessionCard` 的渲染（搜尋 `pastSessions` 或 `filteredPastSessions`），加入 `video-count` 與 `@view-videos`。「即將到來」section 的 `SessionCard` 不要改：

```vue
        <SessionCard
          v-for="session in filteredPastSessions"
          :key="session.session_id"
          :session="session"
          :editable="store.isAdmin"
          :video-count="(store.videosByDate[session.date] || []).length"
          @edit="editSession"
          @delete="confirmDeleteSession"
          @copy="copySession"
          @view-videos="openVideoModal(session)"
        />
```

- [ ] **步驟 2：在 template 結尾加入 VideoListModal**

`VideoListModal` 內部已用 `Teleport to="body"`，所以可以當一般 sibling 放置。在既有的「新增場次」「編輯場次」`<Teleport>` 之後、`</template>` 結束標籤之前追加：

```vue
      <VideoListModal
        v-model:show="videoModalOpen"
        :session-date="selectedSessionDate"
        :videos="selectedSessionVideos"
      />
```

- [ ] **步驟 3：在 script 加入 import 與 state**

在 `<script setup>` 加入 import：

```js
import VideoListModal from '../components/VideoListModal.vue'
```

在既有 ref / state 區（建議放在 `showAddModal` 之類的 modal state 附近）追加：

```js
const videoModalOpen = ref(false)
const selectedVideoSession = ref(null)
function openVideoModal(session) {
  selectedVideoSession.value = session
  videoModalOpen.value = true
}
const selectedSessionDate = computed(() => selectedVideoSession.value?.date || '')
const selectedSessionVideos = computed(() =>
  selectedVideoSession.value ? store.videosByDate[selectedVideoSession.value.date] || [] : []
)
```

（用 `selectedVideoSession` 而非 `selectedSession`，避免跟其他 modal 既有的 ref 撞名。）

- [ ] **步驟 4：Commit**

```bash
git add src/views/SessionsView.vue
git commit -m "feat(sessions): wire video list modal for past sessions"
```

---

## 第 6 階段 — 端對端驗證

### Task 10：手動 smoke test

**檔案：** 無（瀏覽器手動驗證）

- [ ] **步驟 1：跑 dev server**

```bash
npm run dev
```

- [ ] **步驟 2：驗證 HistoryView**

切到歷史記錄分頁。預期：
- 有對應影片的歷史場次顯示「📹 N 支影片」按鈕（用 Video icon）
- 沒有影片的場次完全不顯示按鈕
- 點按鈕 → modal 從底部滑上來
- Modal 內影片依「第 1 局 → 第 N 局」排序
- 每筆顯示縮圖、局號、球員名單
- 點任一筆 → 開新分頁到 YouTube
- 點 X 或 backdrop → modal 關閉

- [ ] **步驟 3：驗證 SessionsView**

切到場次分頁。
- 「即將到來」section：所有卡片**不**顯示影片按鈕（正確：未來場次沒影片）
- 「歷史記錄」section：有對應影片的卡片才顯示按鈕
- Modal 行為與 HistoryView 一致

- [ ] **步驟 4：驗證 WeekView 沒被影響**

切到本週分頁。完全沒有影片相關 UI（正確）。

- [ ] **步驟 5：驗證 pull-to-refresh**

在 SessionsView 下拉。預期：skeleton/refresh 正常跑，影片資料保留（或同步到新內容）。

- [ ] **步驟 6：驗證容錯**

DevTools Network 切「Offline」後重新整理。預期：app 仍能載入（sessions 顯示），影片按鈕全部消失，console 出現 `Videos fetch failed: ...` log。沒有 error 阻擋畫面。

- [ ] **步驟 7：最後跑一次完整測試套件**

```bash
npx vitest run
```

預期：全部通過。

- [ ] **步驟 8：Build 檢查**

```bash
npm run build
```

預期：build 完成沒有 error。

無 commit（純手動驗證）。

---

## 完成

全部 task 跑完後，功能即上線：
- GAS 新 endpoint 已部署
- Sheet 有 `youtube_channel_id` 設定，`videos` 分頁自動建立
- 前端在歷史場次顯示影片按鈕、modal 列出可點擊清單
- Sheet 仍可手動補登舊資料（不會被 sync 蓋掉）
