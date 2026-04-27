# YouTube 影片連結到場次 — 設計文件

日期：2026-04-27
範圍：在「歷史場次」卡片上顯示當日的 YouTube 錄影清單，點擊跳轉到該影片。

---

## 背景

球團每週上傳比賽錄影到自有頻道（[@Badmintonweekends](https://www.youtube.com/@Badmintonweekends)），影片標題格式固定：

```
YYYYMMDD <球員名單> <局號>
範例：20260418 阿嵐 育萱 Pei Wei Carla Fred Timo Nick Sandy 11
```

- 一場通常切 10–13 局，每局一支影片
- 不一定每週都會錄

目前系統內沒有任何影片資訊。本次目標是讓使用者在「歷史場次」上能直接看到當日有哪些影片，點擊跳轉到 YouTube。

## 目標與非目標

**目標：**
- 歷史場次卡片上顯示「N 支影片」按鈕
- 點擊後彈出 modal 列出該場所有影片（縮圖 + 第 N 局 + 球員名單）
- 點擊影片開新分頁到 YouTube

**非目標：**
- 不嵌入影片播放器（直接跳轉到 YouTube）
- 不顯示在未來/本週場次（規劃中還沒有錄影）
- 不做影片管理介面（影片資料來自 YouTube channel，不在 app 內編輯）

## 整體架構

```
[YouTube 頻道 RSS]
        ↓ (每次 _fetchAll 觸發一次)
[GAS: _syncVideos]  ──→  [Sheet: videos 分頁]
                              ↓
                        [GAS: _getVideos]
                              ↓
                        [Vue store: videos / videosByDate]
                              ↓
        ┌──────────────────────┴────────────────────┐
[HistoryCard]                              [SessionCard (past)]
    ↓ 點擊                                       ↓ 點擊
        └──────────► [VideoListModal] ◄──────────┘
                            ↓
                  點擊 → window.open(youtube)
```

## 設計選擇

### 資料來源：YouTube RSS（不用 YouTube Data API）

**原因：**
- 零設定（不用申請 API key）
- 沒有 quota 風險
- 配合系統使用頻率（每週使用），RSS 上限 15 支足以滾動覆蓋最近 1.5 週
- 缺點是無法回頭抓老資料 → 用「人工補登 sheet」作為退路

**RSS endpoint：**
```
https://www.youtube.com/feeds/videos.xml?channel_id={channel_id}
```

### 同步策略：Best-effort，前端 store 自然 throttle

- GAS `_getVideos` 內部先 try sync，失敗也回傳 sheet 既有資料
- 前端 `_fetchAll` 把 `getVideos` 跟既有 API 用 `Promise.all` 平行呼叫
- 影片獨立 `.catch` → 失敗不影響其他資料
- 前端只在 `init()` 與 `refresh()` 觸發 → 一次 app session 通常 1–2 次 sync

---

## 第 1 部分：資料層

### Sheet `videos` 分頁

| 欄位 | 型別 | 範例 | 說明 |
|------|------|------|------|
| `video_id` | string | `OtqKe2zJOXY` | YouTube 影片 ID（11 碼），主鍵 |
| `session_date` | string | `2026-04-18` | 從標題前 8 碼解析（YYYY-MM-DD） |
| `match_no` | number | `11` | 標題尾數，用於排序 / 顯示「第 N 局」 |
| `title` | string | `20260418 阿嵐 育萱 ... Sandy 11` | 完整原始標題 |
| `published_at` | string | `2026-04-21T06:50:27Z` | RSS 給的發布時間 |
| `synced_at` | string | `2026-04-27T10:00:00Z` | 寫入 sheet 的時間 |

### Config sheet 新增一筆設定

| key | value |
|-----|-------|
| `youtube_channel_id` | `UCR6UdT-GtpcdHWfTCUbfxHg` |

### 標題解析規則

```
^(\d{8})\s.+\s(\d+)$
```

- 開頭 8 碼數字必須是合法 YYYYMMDD
- 結尾必須是純數字（局號）
- 兩者都符合才寫入；不符合 skip
- 結果：未來如果有「集錦」「練習」等不合命名規則的影片，不會出現在場次清單裡

### Upsert 規則

- 以 `video_id` 為主鍵
- 已存在的 `video_id` 一律 skip（不覆蓋）
- 退路：人工可在 sheet 直接新增列補老資料；下次 sync 不會被覆蓋

---

## 第 2 部分：GAS 後端

### (A) Config 取得 channel id

`_syncVideos` 內呼叫 `_getConfig(ss, false)` 取得 `youtube_channel_id`。

### (B) `_fetchYouTubeRss(channelId)` — 純 IO

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

### (C) `_syncVideos(ss)` — RSS → sheet upsert

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

### (D) `_createVideosSheet(ss)` — 自動建表（部署便利）

如果 `videos` 分頁不存在，自動建立並寫入表頭。讓部署不需要手動建分頁。

```js
function _createVideosSheet(ss) {
  const sheet = ss.insertSheet('videos')
  sheet.appendRow(['video_id', 'session_date', 'match_no', 'title', 'published_at', 'synced_at'])
  return sheet
}
```

### (E) `_getVideos(ss)` — best-effort 同步 + 讀取

```js
function _getVideos(ss) {
  try { _syncVideos(ss) } catch (err) {
    console.error('Video sync failed:', err.message)
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
      // session_date DESC, match_no ASC
      if (a.session_date !== b.session_date) return b.session_date.localeCompare(a.session_date)
      return a.match_no - b.match_no
    })
}
```

### (F) doGet 註冊

```js
else if (action === 'getVideos') data = _getVideos(ss)
```

不需要 admin_token：影片清單跟 sessions 一樣是公開資訊。

### 風險與緩解

- **GAS doGet 6 秒上限**：RSS fetch ~500ms + sheet 寫入 ~1s = 安全範圍內
- **RSS 暫時掛掉**：try/catch 包住 sync，回傳 sheet 既有資料
- **頻道改名/換 ID**：透過 config sheet 修改即可，無需改程式碼

---

## 第 3 部分：前端 Store

### `src/services/api.js` 加一個方法

```js
getVideos: () => _get('getVideos'),
```

### `src/stores/app.js` 改動

**新增 state：**
```js
const videos = ref([])
```

**新增 computed：**
```js
const videosByDate = computed(() => {
  const map = {}
  for (const v of videos.value) {
    (map[v.session_date] ||= []).push(v)
  }
  return map
})
```

**修改 `_fetchAll`：**
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
  // ... 既有邏輯不動
  videos.value = vids
}
```

**Return 新增：**
```js
return { ..., videos, videosByDate, ... }
```

### 觸發點

| 進入點 | 是否觸發 GAS sync |
|-------|----------------|
| App 第一次進入 → `init()` | ✅ |
| Pull-to-refresh → `refresh()` | ✅ |
| TabBar 切 view | ❌（讀 store 快取） |
| 點卡片開 Modal | ❌（讀 store 快取） |

→ 一次 app session 通常 1–2 次 sync。

---

## 第 4 部分：UI 元件

### 4.1 新增 `src/components/VideoListModal.vue`

採用現有 modal 模式：`Teleport to="body"` + `AnimatePresence` + bottom-sheet 動畫（`y: 100% → 0`）。

**Props：**
```js
{
  show:        Boolean,        // v-model:show
  sessionDate: String,         // '2026-04-18'
  videos:      Array,          // 已排序好的 videos array
}
```

**Emit：** `update:show`

**結構：**

```
┌──────────────────────────────────┐
│ 2026/4/18（六）的影片        ✕   │
├──────────────────────────────────┤
│ ┌─────┐                          │
│ │縮圖│ 第 1 局                   │  ← 點 row 開新分頁
│ │     │ 阿嵐 育萱 Pei Wei ...    │
│ └─────┘                          │
│ ...                              │
└──────────────────────────────────┘
```

**每個 item 顯示：**
- **縮圖**：`https://i.ytimg.com/vi/{video_id}/mqdefault.jpg`
- **第 N 局**：`第 {match_no} 局`
- **球員名單**：標題萃取
  ```js
  title.replace(/^\d{8}\s/, '').replace(/\s\d+$/, '')
  ```
- **點擊**：`window.open('https://www.youtube.com/watch?v=' + video_id, '_blank', 'noopener')`

**邊界處理：**
- 縮圖載入失敗 → `@error` 換成灰底 + Play icon placeholder
- `videos` 為空 → modal 不會被開（呼叫端的 button 已隱藏）

### 4.2 修改 `src/components/HistoryCard.vue`

**新增 props：**
```js
videoCount: { type: Number, default: 0 }
```

**新增 emit：**
```js
defineEmits(['view-videos'])
```

**Template 新增按鈕：**
```vue
<button
  v-if="videoCount > 0"
  class="card__videos-btn"
  @click.stop="$emit('view-videos')"
>
  <Video :size="14" :stroke-width="2" />
  {{ videoCount }} 支影片
</button>
```

### 4.3 修改 `src/components/SessionCard.vue`

跟 HistoryCard 同步驟，但條件加上「只有過去場次」：

```vue
<button
  v-if="!isFuture && !isCurrent && videoCount > 0"
  class="card__videos-btn"
  @click.stop="$emit('view-videos')"
>
  <Video :size="14" :stroke-width="2" />
  {{ videoCount }} 支影片
</button>
```

### 4.4 修改 `src/views/HistoryView.vue`

```vue
<HistoryCard
  v-for="session in pastSessions"
  :key="session.session_id"
  :session="session"
  :video-count="(store.videosByDate[session.date] || []).length"
  @view-videos="openVideoModal(session)"
/>

<VideoListModal
  v-model:show="videoModalOpen"
  :session-date="selectedSessionDate"
  :videos="selectedSessionVideos"
/>
```

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

### 4.5 修改 `src/views/SessionsView.vue`

跟 HistoryView 同步驟（兩個 view 各自管 modal state）。SessionCard 傳入 `video-count`、註冊 `@view-videos`。

### 4.6 圖示

`lucide-vue-next` 的 `Video` icon（已在 dependencies）。

### 設計要點

1. **Card 不直接讀 store**：保持純展示元件，count 從父層傳入
2. **`@click.stop`**：避免按鈕事件冒泡到卡片其他互動
3. **Modal 兩個 view 各自一份**：state 太簡單，不抽全局
4. **沒影片就完全不顯示按鈕**：不要顯示 disabled / 0 支
5. **新分頁開啟用 `noopener`**：安全 + 不阻擋 referer

---

## 部署步驟

1. **Sheet：** `config` 分頁加一行 `youtube_channel_id`，值填頻道 ID
2. **GAS：** 部署新版 Code.gs（`videos` 分頁第一次 sync 時自動建立，不需手動建）
3. **前端：** 部署新版 Vue（不需要 env var 改動）
4. **驗證：** 進到 HistoryView，看歷史場次卡片是否出現「N 支影片」按鈕；點擊應彈出 modal

## 測試重點

- **正常路徑**：歷史場次有影片 → 顯示按鈕 → 點擊 → modal 列出 → 點擊 row 開 YouTube
- **沒影片的歷史場次**：完全不顯示按鈕（不是 disabled）
- **未來場次**：完全不顯示按鈕
- **影片未對應到任何 session**：不顯示在 app 內（合理降級）
- **RSS 失敗**：app 仍可正常使用，影片列表為空（Console 有 error log）
- **頻道有不合規則的影片**（例如「集錦」）：被 sync 過程 skip，不會出現
- **同 session_date 的影片排序**：第 1 局 → 第 N 局（match_no asc）
- **不同 session_date 的場次排序**：新 → 舊（date desc）

## YAGNI（明確排除）

- ❌ 影片內嵌播放器
- ❌ 上傳/編輯影片介面
- ❌ 預先抓取縮圖到 sheet（YouTube CDN 已穩定）
- ❌ 影片描述、長度、觀看次數（資訊密度過高）
- ❌ WeekView 顯示影片（規劃用，沒影片）
- ❌ 未來場次顯示影片入口（沒影片）
- ❌ Modal 內搜尋/篩選（10 支左右不需要）
