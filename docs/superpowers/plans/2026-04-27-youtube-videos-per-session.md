# YouTube Videos Per Session — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "videos" button to past-session cards that opens a modal listing the YouTube recordings for that day, sourced via the channel RSS feed.

**Architecture:** GAS backend reads YouTube channel RSS, parses video titles to extract `session_date` and `match_no`, upserts into a new `videos` sheet. Frontend fetches the videos list alongside sessions on init/refresh and indexes it by date. Cards display a count button; clicking opens a modal which links each row to YouTube.

**Tech Stack:** Google Apps Script (XmlService, UrlFetchApp), Vue 3 + Pinia, Vitest, lucide-vue-next, motion-v.

**Spec:** [docs/superpowers/specs/2026-04-27-youtube-videos-per-session-design.md](../specs/2026-04-27-youtube-videos-per-session-design.md)

---

## File Structure

**Files to create:**
- `src/components/VideoListModal.vue` — bottom-sheet modal listing videos for a session

**Files to modify:**
- `gas/Code.gs` — add `_fetchYouTubeRss`, `_syncVideos`, `_createVideosSheet`, `_getVideos`, wire `getVideos` action
- `src/services/api.js` — add `getVideos` method
- `src/services/__tests__/api.test.js` — add test for `getVideos`
- `src/stores/app.js` — add `videos` ref, `videosByDate` computed, fetch in `_fetchAll`
- `src/stores/__tests__/app.test.js` — extend mock + add tests for `videosByDate`
- `src/components/HistoryCard.vue` — add `videoCount` prop, video button, `view-videos` emit
- `src/components/SessionCard.vue` — same as HistoryCard, gated to past sessions
- `src/views/HistoryView.vue` — wire modal state, pass `video-count`
- `src/views/SessionsView.vue` — wire modal state, pass `video-count`

**Manual changes (non-code):**
- Google Sheet `config` tab: add row `youtube_channel_id | UCR6UdT-GtpcdHWfTCUbfxHg`
- GAS deployment: redeploy after `Code.gs` changes (existing deploy procedure)

---

## Phase 1 — GAS Backend

GAS code is not covered by the existing JS test suite. Verification is via deployment + curl/browser hit on the deployed endpoint.

### Task 1: Add RSS sync helpers and `getVideos` action to `Code.gs`

**Files:**
- Modify: `gas/Code.gs`

- [ ] **Step 1: Add `getVideos` action to `doGet`**

In `gas/Code.gs`, find the `doGet` function (lines 7–20). Add `getVideos` to the action dispatch:

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

- [ ] **Step 2: Add `_fetchYouTubeRss` helper**

Append at the end of `gas/Code.gs`:

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

- [ ] **Step 3: Add `_createVideosSheet` helper**

Append at the end of `gas/Code.gs`:

```js
function _createVideosSheet(ss) {
  const sheet = ss.insertSheet('videos')
  sheet.appendRow(['video_id', 'session_date', 'match_no', 'title', 'published_at', 'synced_at'])
  return sheet
}
```

- [ ] **Step 4: Add `_syncVideos` helper**

Append at the end of `gas/Code.gs`:

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

- [ ] **Step 5: Add `_getVideos` helper**

Append at the end of `gas/Code.gs`:

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

- [ ] **Step 6: Commit**

```bash
git add gas/Code.gs
git commit -m "feat(gas): add YouTube RSS sync and getVideos endpoint"
```

---

### Task 2: Manual — configure sheet and deploy GAS

**Files:** none (manual steps in Google Sheet UI + GAS editor)

- [ ] **Step 1: Add config row in Google Sheet**

Open the linked Google Spreadsheet → `config` tab → append a new row:

| col A | col B |
|-------|-------|
| `youtube_channel_id` | `UCR6UdT-GtpcdHWfTCUbfxHg` |

- [ ] **Step 2: Deploy updated GAS**

In the GAS editor (script bound to the spreadsheet):
1. Replace `Code.gs` content with the worktree's `gas/Code.gs`
2. Click `部署` → `管理部署` → existing deployment → edit (pencil icon) → `版本` → `新版本` → `部署`
3. Note the new deployment URL (should match `VITE_GAS_URL`; if URL changed, copy the new one)

- [ ] **Step 3: Smoke test the endpoint**

In a browser, hit:
```
<VITE_GAS_URL>?action=getVideos
```

Expected: JSON with `status: "ok"` and `data: [...]` array of 15-ish video entries. The `videos` sheet should now exist with rows. If `data` is `[]` and the sheet is empty, double-check `youtube_channel_id` matches `UCR6UdT-GtpcdHWfTCUbfxHg` exactly.

- [ ] **Step 4: Verify entries shape**

Check one entry has fields: `video_id` (string, 11 chars), `session_date` (`YYYY-MM-DD`), `match_no` (number), `title` (string), `published_at` (ISO string).

No commit (manual step only).

---

## Phase 2 — Frontend API & Store

### Task 3: Add `api.getVideos` method with test (TDD)

**Files:**
- Modify: `src/services/api.js`
- Modify: `src/services/__tests__/api.test.js`

- [ ] **Step 1: Write the failing test**

Append at the end of `src/services/__tests__/api.test.js` (before the final newline):

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

- [ ] **Step 2: Run test to confirm failure**

```bash
npx vitest run src/services/__tests__/api.test.js
```

Expected: `api.getVideos is not a function` or similar.

- [ ] **Step 3: Add `getVideos` to `src/services/api.js`**

Add a line in the `api` object (after `getSessions:`):

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

- [ ] **Step 4: Run tests to confirm pass**

```bash
npx vitest run src/services/__tests__/api.test.js
```

Expected: all tests pass, including the new `api.getVideos` block.

- [ ] **Step 5: Commit**

```bash
git add src/services/api.js src/services/__tests__/api.test.js
git commit -m "feat(api): add getVideos endpoint client"
```

---

### Task 4: Add `videos` state, `videosByDate` computed, fetch wiring (TDD)

**Files:**
- Modify: `src/stores/app.js`
- Modify: `src/stores/__tests__/app.test.js`

- [ ] **Step 1: Update existing mock to include `getVideos`**

In `src/stores/__tests__/app.test.js`, modify the `vi.mock` call (lines 6–19) to add `getVideos`:

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

- [ ] **Step 2: Add failing tests for videos state and `videosByDate`**

Append inside the `describe('useAppStore', ...)` block in `src/stores/__tests__/app.test.js`:

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

- [ ] **Step 3: Run tests to confirm failure**

```bash
npx vitest run src/stores/__tests__/app.test.js
```

Expected: 3 new tests fail with `store.videos is undefined` or similar.

- [ ] **Step 4: Add `videos` state and `videosByDate` computed**

In `src/stores/app.js`, modify lines 6–10 to add the videos ref:

```js
export const useAppStore = defineStore('app', () => {
  const config   = ref({})
  const members  = ref([])
  const sessions = ref([])
  const videos   = ref([])
  const loading  = ref(true)
  const _token   = ref(localStorage.getItem('admin_token') || null)
```

After `allUniqueGuests` computed (around line 33), add:

```js
  const videosByDate = computed(() => {
    const map = {}
    for (const v of videos.value) {
      (map[v.session_date] ||= []).push(v)
    }
    return map
  })
```

- [ ] **Step 5: Wire video fetch into `_fetchAll`**

In `src/stores/app.js`, replace the `_fetchAll` function (lines 70–82) with:

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

- [ ] **Step 6: Export new fields from store**

Modify the return statement (line 98) to include `videos` and `videosByDate`:

```js
  return { config, members, sessions, videos, loading, isAdmin, adminToken, activeMembers, allUniqueGuests, videosByDate, setAdminToken, clearAdminToken, init, refresh }
})
```

- [ ] **Step 7: Run tests to confirm pass**

```bash
npx vitest run src/stores/__tests__/app.test.js
```

Expected: all tests pass (including 3 new ones).

- [ ] **Step 8: Run full test suite**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 9: Commit**

```bash
git add src/stores/app.js src/stores/__tests__/app.test.js
git commit -m "feat(store): load videos and expose videosByDate index"
```

---

## Phase 3 — Modal Component

### Task 5: Create `VideoListModal.vue`

**Files:**
- Create: `src/components/VideoListModal.vue`

- [ ] **Step 1: Create the file with full content**

Create `src/components/VideoListModal.vue`:

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

- [ ] **Step 2: Verify the file imports cleanly via dev build**

```bash
npm run dev
```

Open the app in a browser. The console should have no errors related to `VideoListModal`. (Component is not yet used by any view — this just confirms the syntax is valid.)

Stop the dev server.

- [ ] **Step 3: Commit**

```bash
git add src/components/VideoListModal.vue
git commit -m "feat: add VideoListModal component"
```

---

## Phase 4 — Card Integration

### Task 6: Add video button to `HistoryCard.vue`

**Files:**
- Modify: `src/components/HistoryCard.vue`

- [ ] **Step 1: Add prop, emit, and template button**

Replace the entire `src/components/HistoryCard.vue` with:

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

- [ ] **Step 2: Commit**

```bash
git add src/components/HistoryCard.vue
git commit -m "feat: HistoryCard shows video count button"
```

---

### Task 7: Add video button to `SessionCard.vue` (past sessions only)

**Files:**
- Modify: `src/components/SessionCard.vue`

- [ ] **Step 1: Add prop and emit, modify template**

In `src/components/SessionCard.vue`:

(a) Modify the `card__footer` block in the template (lines 19–37) to add the video button **before** `card__actions`:

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

(b) Modify the `<script setup>` block (lines 53–62) to add the prop, emit, and import:

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

(c) Append to the `<style scoped>` block (just before `</style>` at line 212):

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

- [ ] **Step 2: Commit**

```bash
git add src/components/SessionCard.vue
git commit -m "feat: SessionCard shows video count for past sessions"
```

---

## Phase 5 — View Wiring

### Task 8: Wire `HistoryView.vue`

**Files:**
- Modify: `src/views/HistoryView.vue`

- [ ] **Step 1: Add modal import, state, and pass `video-count`**

Replace `src/views/HistoryView.vue` template's `<HistoryCard>` block AND add modal at the end of `<motion.main>`:

In the existing template, change the `HistoryCard` element (around line 41) from:

```vue
        <HistoryCard
          v-for="session in pastSessions"
          :key="session.session_id"
          :session="session"
        />
```

to:

```vue
        <HistoryCard
          v-for="session in pastSessions"
          :key="session.session_id"
          :session="session"
          :video-count="(store.videosByDate[session.date] || []).length"
          @view-videos="openVideoModal(session)"
        />
```

Right before the closing `</motion.main>` tag, add:

```vue
        <VideoListModal
          v-model:show="videoModalOpen"
          :session-date="selectedSessionDate"
          :videos="selectedSessionVideos"
        />
```

- [ ] **Step 2: Add modal state in script**

In the `<script setup>` block, replace the imports and add modal state. Find the existing imports (around lines 51–55):

```js
import { computed } from 'vue'
import { motion } from 'motion-v'
import { useAppStore } from '../stores/app.js'
import HistoryCard from '../components/HistoryCard.vue'
import SkeletonBlock from '../components/SkeletonBlock.vue'
```

Replace with:

```js
import { computed, ref } from 'vue'
import { motion } from 'motion-v'
import { useAppStore } from '../stores/app.js'
import HistoryCard from '../components/HistoryCard.vue'
import SkeletonBlock from '../components/SkeletonBlock.vue'
import VideoListModal from '../components/VideoListModal.vue'
```

After the existing computeds (after `avgAttendance`, around line 70), append:

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

- [ ] **Step 3: Commit**

```bash
git add src/views/HistoryView.vue
git commit -m "feat(history): wire video list modal"
```

---

### Task 9: Wire `SessionsView.vue`

**Files:**
- Modify: `src/views/SessionsView.vue`

- [ ] **Step 1: Pass `video-count` to past `<SessionCard>` instances**

In `src/views/SessionsView.vue`, locate the `SessionCard` rendering for past sessions inside the "歷史記錄" section. The card render in the future section should remain unchanged. Find the past-sessions iteration (search for `pastSessions` or `filteredPastSessions`) and add `video-count` + `@view-videos`:

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

(Keep the future-session SessionCard usage unchanged — no `video-count` needed there.)

- [ ] **Step 2: Add VideoListModal at end of template**

`VideoListModal` already uses `Teleport to="body"` internally, so it can be placed as a normal sibling. Add this just before the closing `</template>` tag, after the existing add/edit modal `<Teleport>` blocks:

```vue
      <VideoListModal
        v-model:show="videoModalOpen"
        :session-date="selectedSessionDate"
        :videos="selectedSessionVideos"
      />
```

- [ ] **Step 3: Add imports and state in script**

In the `<script setup>` block, add to the imports:

```js
import VideoListModal from '../components/VideoListModal.vue'
```

After the existing refs/state (find a logical spot near other modal state like `showAddModal`), add:

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

(Naming `selectedVideoSession` instead of `selectedSession` to avoid collision if the file already has a `selectedSession` ref for another modal.)

- [ ] **Step 4: Commit**

```bash
git add src/views/SessionsView.vue
git commit -m "feat(sessions): wire video list modal for past sessions"
```

---

## Phase 6 — End-to-End Verification

### Task 10: Manual smoke test

**Files:** none (manual browser verification)

- [ ] **Step 1: Run dev server**

```bash
npm run dev
```

- [ ] **Step 2: Verify HistoryView**

Navigate to the History tab. Expected:
- Past sessions with matching videos show a `📹 N 支影片` button (using Video icon)
- Past sessions without videos show NO button
- Tap the button → modal slides up from bottom
- Modal lists videos sorted by `第 1 局 → 第 N 局`
- Each item shows thumbnail + match number + player names
- Tapping an item opens YouTube in a new tab
- Tapping the X or backdrop closes the modal

- [ ] **Step 3: Verify SessionsView**

Navigate to the Sessions tab.
- "即將到來" section: NO video button on any card (correct — future sessions have no videos)
- "歷史記錄" section: video button appears on cards with matching videos
- Same modal behavior as HistoryView

- [ ] **Step 4: Verify WeekView is unaffected**

Navigate to the Week tab. No video UI should appear (correct).

- [ ] **Step 5: Verify pull-to-refresh**

In SessionsView, pull down. Expected: skeleton/refresh runs and videos remain (or get updated if new ones synced).

- [ ] **Step 6: Verify resilience**

In DevTools Network tab, throttle to "Offline", then refresh app. Expected: app still loads (sessions show), video buttons disappear, console has `Videos fetch failed: ...` log. No error blocks the UI.

- [ ] **Step 7: Run full test suite one more time**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 8: Build check**

```bash
npm run build
```

Expected: build completes without errors.

No commit (manual verification only).

---

## Done

All tasks complete. The feature is shipped end-to-end:
- GAS deployed with new endpoint
- Sheet has `youtube_channel_id` config and auto-created `videos` tab
- Frontend fetches and displays videos on past sessions
- Manual sheet edits possible for backfilling old data
