# 頭像長按顯示成員資訊彈窗 — 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 首頁出席成員頭像保留點擊翻牌，新增長按 500ms 開啟該成員資訊底部彈窗（上次參加日期、距今天數、上次場次影片入口）。

**Architecture:** 純前端功能。`stats.js` 新增 `getLastAttendance` 查詢邏輯、`date.js` 新增 `daysBetween`；`AttendeeChip.vue` 加入 pointer events 長按偵測並 emit `longpress`；新元件 `AttendeeInfoSheet.vue` 仿照 `MemberBadgeSheet.vue` 的底部 sheet 模式；`WeekView.vue` 持有彈窗狀態並串接既有 `VideoListModal`。GA 埋點沿用 `analytics.js` 模式。

**Tech Stack:** Vue 3 Composition API、motion-v（AnimatePresence/spring）、lucide-vue-next、Vitest、GA4（gtag）。

**設計文件:** `docs/superpowers/specs/2026-06-12-attendee-info-sheet-design.md`

---

## 背景知識（給沒有專案 context 的工程師）

- 資料形狀：`store.sessions` 是場次陣列，每筆 `{ session_id, date: 'YYYY-MM-DD', attendances: [{ member_id, name, type }] }`；臨時成員 `member_id` 為 `null`，所以本功能一律用 `name` 比對（與排行榜對 guest 的處理一致）。
- `store.videosByDate` 是 computed，鍵為 `session_date`（YYYY-MM-DD），值為該場次影片陣列。
- `WeekView.vue` 的 `currentSession` 是「今天（含）之後最近的場次」，首頁頭像顯示的就是它的 `attendances`。
- 專案測試指令：`npm test`（= `vitest run`）。
- 既有底部彈窗範本：`src/components/MemberBadgeSheet.vue`（Teleport + AnimatePresence + 下滑拖曳關閉 + scroll lock）。
- Commit 訊息用英文，遵循 `feat:` / `test:` 前綴慣例。

---

### Task 1: utils — `getLastAttendance` 與 `daysBetween`（TDD）

**Files:**
- Modify: `src/utils/stats.js`（檔尾新增函數）
- Modify: `src/utils/date.js`（檔尾新增函數）
- Modify: `src/utils/__tests__/stats.test.js`（檔尾新增 describe；import 加入 `getLastAttendance`）
- Create: `src/utils/__tests__/date.test.js`

- [ ] **Step 1: 撰寫失敗測試 — getLastAttendance**

在 `src/utils/__tests__/stats.test.js` 檔頭 import 加入 `getLastAttendance`：

```js
import { buildLeaderboard, getAttendanceCount, getCurrentStreak, excludeFutureSessions, getLastAttendance } from '../stats.js'
```

檔尾新增（沿用檔頭既有的共用 `sessions` fixture：s1=2026-04-05 Peter/Andy、s2=2026-04-12 Peter/訪客 John、s3=2026-04-19 Peter/Andy）：

```js
describe('getLastAttendance', () => {
  it('returns the most recent session before the given date that includes the name', () => {
    const result = getLastAttendance(sessions, 'Peter', '2026-04-19')
    expect(result.session_id).toBe('s2')
  })

  it('matches guests by name', () => {
    const result = getLastAttendance(sessions, '訪客 John', '2026-04-19')
    expect(result.session_id).toBe('s2')
  })

  it('excludes the session on the boundary date itself (strictly before)', () => {
    const result = getLastAttendance(sessions, 'Andy', '2026-04-19')
    expect(result.session_id).toBe('s1')
  })

  it('returns null when there is no earlier record', () => {
    expect(getLastAttendance(sessions, 'Peter', '2026-04-05')).toBeNull()
  })

  it('returns null for a name that never attended', () => {
    expect(getLastAttendance(sessions, 'Lisa', '2026-04-19')).toBeNull()
  })

  it('returns null when all sessions are after the given date', () => {
    expect(getLastAttendance(sessions, 'Peter', '2026-01-01')).toBeNull()
  })
})
```

- [ ] **Step 2: 撰寫失敗測試 — daysBetween**

建立 `src/utils/__tests__/date.test.js`：

```js
// src/utils/__tests__/date.test.js
import { describe, it, expect } from 'vitest'
import { daysBetween } from '../date.js'

describe('daysBetween', () => {
  it('counts whole days between two date strings', () => {
    expect(daysBetween('2026-05-29', '2026-06-12')).toBe(14)
  })

  it('returns 0 for the same day', () => {
    expect(daysBetween('2026-06-12', '2026-06-12')).toBe(0)
  })

  it('is not affected by DST-like hour shifts (uses local midnight + rounding)', () => {
    expect(daysBetween('2026-01-01', '2026-01-02')).toBe(1)
  })
})
```

- [ ] **Step 3: 執行測試，確認失敗**

Run: `npx vitest run src/utils/__tests__/stats.test.js src/utils/__tests__/date.test.js`
Expected: FAIL — `getLastAttendance is not a function`、`daysBetween is not a function`（或 import 錯誤）。

- [ ] **Step 4: 實作**

`src/utils/stats.js` 檔尾新增：

```js
/**
 * 取得某成員在 beforeDate 之前（不含當日）最近一次出席的場次。
 * 以 name 比對，固定成員與臨時成員（member_id 為 null）皆適用。
 * 查無紀錄回傳 null。
 */
export function getLastAttendance(sessions, name, beforeDate) {
  const past = sessions
    .filter(s => s.date < beforeDate && s.attendances.some(a => a.name === name))
    .sort((a, b) => b.date.localeCompare(a.date))
  return past[0] ?? null
}
```

`src/utils/date.js` 檔尾新增：

```js
/**
 * 計算兩個 YYYY-MM-DD 日期字串相差的整數天數（to - from）。
 */
export function daysBetween(fromDateStr, toDateStr) {
  const from = new Date(fromDateStr + 'T00:00:00')
  const to = new Date(toDateStr + 'T00:00:00')
  return Math.round((to - from) / 86400000)
}
```

- [ ] **Step 5: 執行測試，確認通過**

Run: `npx vitest run src/utils/__tests__/stats.test.js src/utils/__tests__/date.test.js`
Expected: PASS（全部綠燈，含既有測試）。

- [ ] **Step 6: Commit**

```bash
git add src/utils/stats.js src/utils/date.js src/utils/__tests__/stats.test.js src/utils/__tests__/date.test.js
git commit -m "feat: add getLastAttendance and daysBetween utils"
```

---

### Task 2: analytics — 通用 `trackEvent` 與兩個埋點函數

`analytics.js` 沒有單元測試（與既有程式碼一致），本 task 以 Task 6 的整體回歸與手動驗證把關。

**Files:**
- Modify: `src/utils/analytics.js`

- [ ] **Step 1: 將核心追蹤函數泛化**

把 `src/utils/analytics.js` 中現有的 `trackVideoEvent`（第 9–26 行）改為：

```js
/**
 * 通用事件追蹤
 * @param {string} eventName - 事件名稱
 * @param {object} params - 事件參數
 */
export function trackEvent(eventName, params = {}) {
  // 檢查 gtag 是否可用
  if (typeof window.gtag !== 'function') {
    console.debug('[Analytics]', eventName, params)
    return
  }

  try {
    window.gtag('event', eventName, params)
  } catch (error) {
    console.error('[Analytics] 追蹤失敗:', error)
  }
}

/**
 * 追蹤影片相關事件（向後相容別名）
 * @param {string} eventName - 事件名稱
 * @param {object} params - 事件參數
 */
export function trackVideoEvent(eventName, params = {}) {
  trackEvent(eventName, params)
}
```

- [ ] **Step 2: 新增成員資訊彈窗埋點函數**

`src/utils/analytics.js` 檔尾新增：

```js
/**
 * 追蹤：長按頭像開啟成員資訊彈窗
 */
export function trackAttendeeSheetOpened({ daysSince, hasVideo, hasHistory }) {
  trackEvent('attendee_sheet_opened', {
    days_since: daysSince ?? null,
    has_video: hasVideo,
    has_history: hasHistory,
  })
}

/**
 * 追蹤：從成員資訊彈窗點擊觀看影片
 */
export function trackAttendeeSheetVideoClick({ sessionDate, videoCount }) {
  trackEvent('attendee_sheet_video_click', {
    session_date: sessionDate,
    video_count: videoCount,
  })
}
```

- [ ] **Step 3: 跑全部測試確認無回歸**

Run: `npm test`
Expected: PASS（既有測試全綠；analytics 無測試屬正常）。

- [ ] **Step 4: Commit**

```bash
git add src/utils/analytics.js
git commit -m "feat: add generic trackEvent and attendee sheet analytics"
```

---

### Task 3: AttendeeChip — 長按偵測

**Files:**
- Modify: `src/components/AttendeeChip.vue`

- [ ] **Step 1: template 加上 pointer 事件與 contextmenu 防護**

根節點 `motion.div`（第 3–12 行）改為：

```html
<motion.div
  class="attendee"
  role="listitem"
  :initial="{ opacity: 0, scale: 0.8 }"
  :animate="{ opacity: 1, scale: 1 }"
  :transition="{ type: 'spring', stiffness: 400, damping: 25, delay: delay }"
  :whileHover="{ scale: 1.06, y: -2 }"
  :whilePress="{ scale: 0.95 }"
  @click="flip"
  @pointerdown="onPointerDown"
  @pointermove="onPointerMove"
  @pointerup="cancelPress"
  @pointercancel="cancelPress"
  @pointerleave="cancelPress"
  @contextmenu.prevent
>
```

說明：Android 長按會觸發 `contextmenu`，`.prevent` 避免跳出系統選單；`pointerup` 只取消計時器，`longPressFired` 旗標留給後續 `click` 事件判斷。

- [ ] **Step 2: script 加入長按邏輯與 flip 防護**

`<script setup>` 區塊改為（`ANIMALS`、props、`initial`、`flipped`、`assignedAnimal` 維持不變，僅列出變更處）：

```js
import { ref, onUnmounted } from 'vue'
import { motion } from 'motion-v'
import CuteAnimal from './CuteAnimal.vue'

// ... ANIMALS 與 props 不變 ...

const emit = defineEmits(['longpress'])

const LONG_PRESS_MS = 500
const MOVE_THRESHOLD_PX = 10

let pressTimer = null
let startX = 0
let startY = 0
let longPressFired = false

function onPointerDown(e) {
  startX = e.clientX
  startY = e.clientY
  longPressFired = false
  clearTimeout(pressTimer)
  pressTimer = setTimeout(() => {
    pressTimer = null
    longPressFired = true
    if (navigator.vibrate) navigator.vibrate(10)
    emit('longpress')
  }, LONG_PRESS_MS)
}

function onPointerMove(e) {
  if (pressTimer === null) return
  if (
    Math.abs(e.clientX - startX) > MOVE_THRESHOLD_PX ||
    Math.abs(e.clientY - startY) > MOVE_THRESHOLD_PX
  ) {
    cancelPress()
  }
}

function cancelPress() {
  clearTimeout(pressTimer)
  pressTimer = null
}

onUnmounted(cancelPress)

function flip() {
  // 長按已觸發時，pointerup 後瀏覽器仍會補發 click，須吞掉避免翻牌
  if (longPressFired) {
    longPressFired = false
    return
  }
  if (!flipped.value) {
    assignedAnimal.value = ANIMALS[Math.floor(Math.random() * ANIMALS.length)].id
  }
  flipped.value = !flipped.value
}
```

注意：原本 `import { ref, computed } from 'vue'` 中的 `computed` 沒有被使用，順手移除；新增 `onUnmounted`。

- [ ] **Step 3: CSS 防 iOS 長按系統行為**

`.attendee` 規則（第 61–74 行）加入三行：

```css
.attendee {
  /* ...既有屬性不變... */
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
}
```

- [ ] **Step 4: 跑測試 + 手動驗證翻牌不受影響**

Run: `npm test`
Expected: PASS。

手動：`npm run dev` 開首頁，短點頭像應正常翻牌/翻回；按住 500ms 後放開不應翻牌（此時 `longpress` 事件已 emit，但尚無人監聽，屬預期）。

- [ ] **Step 5: Commit**

```bash
git add src/components/AttendeeChip.vue
git commit -m "feat: add long-press detection to AttendeeChip"
```

---

### Task 4: 新元件 AttendeeInfoSheet

**Files:**
- Create: `src/components/AttendeeInfoSheet.vue`

- [ ] **Step 1: 建立元件（完整檔案）**

```vue
<!-- src/components/AttendeeInfoSheet.vue -->
<template>
  <Teleport to="body">
    <AnimatePresence>
      <motion.div
        v-if="show"
        key="attendee-info-backdrop"
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
          :aria-label="`${name} 的出席資訊`"
          :initial="{ y: '100%' }"
          :animate="{ y: dragOffset }"
          :exit="{ y: '100%' }"
          :transition="isDragging
            ? { duration: 0 }
            : { type: 'spring', stiffness: 300, damping: 30 }
          "
        >
          <div
            class="modal__header"
            @touchstart="handleTouchStart"
            @touchmove="handleTouchMove"
            @touchend="handleTouchEnd"
          >
            <div class="modal__handle" aria-hidden="true"></div>
            <h2 class="modal__title">{{ name }}</h2>
            <button
              class="modal__close"
              aria-label="關閉"
              @click="$emit('update:show', false)"
            >
              <X :size="20" :stroke-width="2" />
            </button>
          </div>

          <div class="modal__body">
            <template v-if="lastSession">
              <div class="info-row">
                <CalendarDays :size="18" :stroke-width="2" class="info-row__icon" />
                <span>上次參加：{{ lastDateLabel }}</span>
              </div>
              <div class="info-row">
                <Clock :size="18" :stroke-width="2" class="info-row__icon" />
                <span>距離上次參加已 {{ daysSince }} 天</span>
              </div>
              <button
                v-if="videoCount > 0"
                class="video-btn"
                @click="$emit('view-videos')"
              >
                <Play :size="16" :stroke-width="2.2" />
                觀看 {{ shortDateLabel }} 場次影片（{{ videoCount }} 支）
              </button>
            </template>
            <p v-else class="no-history">查不到歷史資料，多多來打球</p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  </Teleport>
</template>

<script setup>
import { computed, watch, ref } from 'vue'
import { motion, AnimatePresence } from 'motion-v'
import { X, CalendarDays, Clock, Play } from 'lucide-vue-next'
import { getTodayStr, daysBetween } from '../utils/date.js'

const props = defineProps({
  show:        { type: Boolean, default: false },
  name:        { type: String,  default: '' },
  lastSession: { type: Object,  default: null },
  videoCount:  { type: Number,  default: 0 },
})

const emit = defineEmits(['update:show', 'view-videos'])

const lastDateLabel = computed(() => {
  if (!props.lastSession) return ''
  const d = new Date(props.lastSession.date + 'T00:00:00')
  return new Intl.DateTimeFormat('zh-TW', {
    month: 'numeric', day: 'numeric', weekday: 'short',
  }).format(d)
})

const shortDateLabel = computed(() => {
  if (!props.lastSession) return ''
  const d = new Date(props.lastSession.date + 'T00:00:00')
  return new Intl.DateTimeFormat('zh-TW', {
    month: 'numeric', day: 'numeric',
  }).format(d)
})

const daysSince = computed(() =>
  props.lastSession ? daysBetween(props.lastSession.date, getTodayStr()) : 0
)

// Scroll lock
watch(() => props.show, (isOpen) => {
  document.body.style.overflow = isOpen ? 'hidden' : ''
})

// Swipe down to close
const isDragging = ref(false)
const dragStartY = ref(0)
const dragOffset = ref(0)

function handleTouchStart(e) {
  dragStartY.value = e.touches[0].clientY
  isDragging.value = true
}

function handleTouchMove(e) {
  if (!isDragging.value) return
  const deltaY = e.touches[0].clientY - dragStartY.value
  if (deltaY > 0) {
    dragOffset.value = deltaY
    e.preventDefault()
  }
}

function handleTouchEnd() {
  if (!isDragging.value) return
  if (dragOffset.value > 120) {
    emit('update:show', false)
  }
  isDragging.value = false
  dragOffset.value = 0
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
  display: flex;
  flex-direction: column;
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
.modal__header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 20px 12px;
  border-bottom: 1px solid var(--border);
  position: relative;
  cursor: grab;
  user-select: none;
}
.modal__header:active { cursor: grabbing; }
.modal__handle {
  position: absolute;
  top: 8px;
  left: 50%;
  transform: translateX(-50%);
  width: 36px;
  height: 4px;
  border-radius: 2px;
  background: var(--border);
}
.modal__title {
  font-size: 16px; font-weight: 700; color: var(--text-primary);
  margin: 0;
  padding-top: 8px;
}
.modal__close {
  background: none; border: none; padding: 4px;
  color: var(--text-tertiary); cursor: pointer;
  display: flex; align-items: center;
  touch-action: manipulation;
  margin-top: 8px;
}
.modal__body {
  padding: 16px 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.info-row {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}
.info-row__icon {
  flex-shrink: 0;
  color: var(--primary);
}
.video-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 4px;
  padding: 12px 16px;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--primary);
  color: var(--on-primary);
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  touch-action: manipulation;
}
.no-history {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-secondary);
  text-align: center;
  padding: 12px 0;
}
</style>
```

- [ ] **Step 2: 跑測試確認無回歸**

Run: `npm test`
Expected: PASS。

- [ ] **Step 3: Commit**

```bash
git add src/components/AttendeeInfoSheet.vue
git commit -m "feat: add AttendeeInfoSheet bottom sheet component"
```

---

### Task 5: WeekView — 串接長按、彈窗與影片

**Files:**
- Modify: `src/views/WeekView.vue`

- [ ] **Step 1: template — AttendeeChip 監聽 longpress、加入兩個 modal**

attendee-grid 區塊（約第 77–84 行）改為：

```html
<div class="attendee-grid" role="list" aria-label="出席成員">
  <AttendeeChip
    v-for="(att, i) in attendees"
    :key="att.id"
    :name="att.name"
    :delay="i * 0.05"
    @longpress="openAttendeeSheet(att)"
  />
</div>
```

`</motion.main>` 之前（與管理員 FAB 同層級、`</template>` 內）加入：

```html
<AttendeeInfoSheet
  v-model:show="attendeeSheetOpen"
  :name="selectedAttendee?.name || ''"
  :last-session="selectedLastSession"
  :video-count="selectedLastVideos.length"
  @view-videos="openLastSessionVideos"
/>
<VideoListModal
  v-model:show="videoModalOpen"
  :session-date="selectedLastSession?.date || ''"
  :videos="selectedLastVideos"
/>
```

注意：兩個 modal 元件內部都用 `Teleport to="body"`，放在 `<template v-else>`（有名單）區塊的尾端即可。

- [ ] **Step 2: script — 狀態、computed 與事件處理**

import 區新增/調整（現有 `import { computed } from 'vue'` 改為含 `ref`）：

```js
import { computed, ref } from 'vue'
import { getTodayStr } from '../utils/date.js'   // 既有
import { getLastAttendance } from '../utils/stats.js'
import { trackAttendeeSheetOpened, trackAttendeeSheetVideoClick } from '../utils/analytics.js'
import { daysBetween } from '../utils/date.js'   // 併入既有 date.js import 即可
import AttendeeInfoSheet from '../components/AttendeeInfoSheet.vue'
import VideoListModal from '../components/VideoListModal.vue'
```

（實作時 `getTodayStr` 與 `daysBetween` 合併為同一行 import：`import { getTodayStr, daysBetween } from '../utils/date.js'`）

`<script setup>` 尾端新增：

```js
// --- 成員資訊彈窗 ---
const attendeeSheetOpen = ref(false)
const videoModalOpen = ref(false)
const selectedAttendee = ref(null)

const selectedLastSession = computed(() => {
  if (!selectedAttendee.value || !currentSession.value) return null
  return getLastAttendance(store.sessions, selectedAttendee.value.name, currentSession.value.date)
})

const selectedLastVideos = computed(() =>
  selectedLastSession.value
    ? (store.videosByDate[selectedLastSession.value.date] || [])
    : []
)

function openAttendeeSheet(att) {
  selectedAttendee.value = att
  attendeeSheetOpen.value = true
  const last = selectedLastSession.value
  trackAttendeeSheetOpened({
    daysSince: last ? daysBetween(last.date, getTodayStr()) : null,
    hasVideo: selectedLastVideos.value.length > 0,
    hasHistory: !!last,
  })
}

function openLastSessionVideos() {
  trackAttendeeSheetVideoClick({
    sessionDate: selectedLastSession.value.date,
    videoCount: selectedLastVideos.value.length,
  })
  attendeeSheetOpen.value = false
  videoModalOpen.value = true
}
```

注意執行順序：`openAttendeeSheet` 先設 `selectedAttendee` 再讀 `selectedLastSession`（computed 會即時重算，順序正確）。

- [ ] **Step 3: 跑測試**

Run: `npm test`
Expected: PASS。

- [ ] **Step 4: Commit**

```bash
git add src/views/WeekView.vue
git commit -m "feat: open attendee info sheet on avatar long-press"
```

---

### Task 6: 整體回歸與手動驗證

**Files:** 無新增（驗證與必要的小修正）

- [ ] **Step 1: 全套測試**

Run: `npm test`
Expected: 全部 PASS。

- [ ] **Step 2: build 檢查**

Run: `npm run build`
Expected: build 成功無錯誤。

- [ ] **Step 3: 手動驗證清單**

`npm run dev` 開啟首頁，逐項確認：

1. 短點頭像：翻牌顯示動物、再點翻回（行為與改版前一致）
2. 長按頭像 500ms：開啟資訊彈窗，支援震動的裝置有輕微震動
3. 長按放開後：頭像**不**翻牌
4. 按住但拖動超過 10px（模擬捲動）：不開彈窗
5. 彈窗內容：姓名、上次參加日期、距今天數正確（可對照 `/history` 頁資料）
6. 上次場次有影片的成員：顯示影片按鈕，點擊後資訊彈窗關閉、`VideoListModal` 開啟且可播放
7. 上次場次無影片：不顯示影片按鈕
8. 名單上沒有歷史紀錄的成員（如新訪客）：顯示「查不到歷史資料，多多來打球」
9. 彈窗：背景點擊關閉、X 關閉、下滑拖曳關閉皆正常
10. 手機（或 DevTools 裝置模擬）：長按不跳出系統選單/文字選取
11. DevTools Console 無 GA 以外錯誤；無 `VITE_GA_MEASUREMENT_ID` 時 console.debug 印出 `attendee_sheet_opened` / `attendee_sheet_video_click` 事件與參數

- [ ] **Step 4: 驗證中發現問題則修正並 commit**

修正類 commit 訊息格式：`fix: <description>`。全數通過後本計畫完成。
