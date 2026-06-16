# 成員個人比賽影片牆 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在成員個人檔案（`MemberBadgeSheet`）新增「比賽影片」區塊，彙整該成員出現過的所有比賽錄影，點擊以現有播放器觀看。

**Architecture:** 純前端，無後端改動。影片資料已在 Pinia store（由 GAS 從 YouTube RSS 同步）。抽出共用 util 解析標題球員名，新增 store getter 依成員名過濾影片，泛化既有 `VideoListModal` 使其能吃任意影片清單，最後整合進 `MemberBadgeSheet`。

**Tech Stack:** Vue 3 (Composition API)、Pinia、Vitest。元件層無測試基礎設施（沿用專案慣例），邏輯集中於有測試的 util/store 層；元件改動以 `npm run build` + 手動驗證。

**前提（已確認）：** 影片標題格式固定 `YYYYMMDD <球員名單> <局號>`，球員名與 `member.name` 完全一致且為單一 token（不含空格）。所有已存影片在 GAS 同步時已驗證標題格式。

---

### Task 1: `parseVideoPlayers` 共用 util

把目前內聯於 `VideoListModal.vue` 的 `extractNames`（回傳字串）邏輯，抽成回傳**陣列**的純函式，供顯示與比對共用。

**Files:**
- Create: `src/utils/videos.js`
- Test: `src/utils/__tests__/videos.test.js`

- [ ] **Step 1: Write the failing test**

`src/utils/__tests__/videos.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { parseVideoPlayers } from '../videos.js'

describe('parseVideoPlayers', () => {
  it('extracts player tokens from a well-formed title', () => {
    const title = '20260516 千惠 二馬 阿芝 Timo Ruby Fang Peter Sandy 3'
    expect(parseVideoPlayers(title)).toEqual(
      ['千惠', '二馬', '阿芝', 'Timo', 'Ruby', 'Fang', 'Peter', 'Sandy']
    )
  })

  it('handles a single player', () => {
    expect(parseVideoPlayers('20260412 Peter 1')).toEqual(['Peter'])
  })

  it('collapses multiple spaces between tokens', () => {
    expect(parseVideoPlayers('20260412 Peter   Sandy 2')).toEqual(['Peter', 'Sandy'])
  })

  it('returns [] for a title missing the trailing match number', () => {
    expect(parseVideoPlayers('20260412 Peter Sandy')).toEqual([])
  })

  it('returns [] for a title missing the leading date', () => {
    expect(parseVideoPlayers('Peter Sandy 2')).toEqual([])
  })

  it('returns [] for non-string input', () => {
    expect(parseVideoPlayers(null)).toEqual([])
    expect(parseVideoPlayers(undefined)).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/__tests__/videos.test.js`
Expected: FAIL — cannot import `parseVideoPlayers` (file does not exist)

- [ ] **Step 3: Write minimal implementation**

`src/utils/videos.js`:

```js
// src/utils/videos.js

// 影片標題格式：YYYYMMDD <球員名單> <局號>
// 範例：20260516 千惠 二馬 阿芝 Timo Ruby Fang Peter Sandy 3
const TITLE_RE = /^\d{8}\s+(.+?)\s+\d+$/

/**
 * 從影片標題解析出球員名陣列。
 * 標題格式不合規時回傳空陣列。
 * @param {string} title
 * @returns {string[]}
 */
export function parseVideoPlayers(title) {
  if (typeof title !== 'string') return []
  const m = title.match(TITLE_RE)
  if (!m) return []
  return m[1].split(/\s+/).filter(Boolean)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/utils/__tests__/videos.test.js`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/utils/videos.js src/utils/__tests__/videos.test.js
git commit -m "feat: add parseVideoPlayers util for video title parsing"
```

---

### Task 2: `VideoListModal` 改用共用 util（DRY）

把 `VideoListModal.vue` 內聯的 `extractNames` 改為呼叫 `parseVideoPlayers`，消除重複的標題解析邏輯。顯示行為不變（仍是空白分隔的字串）。

**Files:**
- Modify: `src/components/VideoListModal.vue:311-313`（`extractNames` 函式）

- [ ] **Step 1: 在 `<script setup>` 匯入區加入 import**

在 `VideoListModal.vue` 既有 import 群組中加一行（與其他 `../utils/*` import 並列）：

```js
import { parseVideoPlayers } from '../utils/videos.js'
```

- [ ] **Step 2: 改寫 `extractNames`**

把現有（約 311–313 行）：

```js
function extractNames(title) {
  return title.replace(/^\d{8}\s/, '').replace(/\s\d+$/, '')
}
```

改為：

```js
function extractNames(title) {
  return parseVideoPlayers(title).join(' ')
}
```

- [ ] **Step 3: 跑既有測試與建置，確認無回歸**

Run: `npm test`
Expected: PASS（既有測試全綠）

Run: `npm run build`
Expected: build 成功，無錯誤

- [ ] **Step 4: Commit**

```bash
git add src/components/VideoListModal.vue
git commit -m "refactor: use parseVideoPlayers in VideoListModal extractNames"
```

---

### Task 3: `videosByMember` store getter

新增 store getter，依成員名過濾出該成員出現過的所有影片，依場次日期由新到舊排序。採整 token 精準比對（用 Task 1 的 util），避免子字串誤中。

**Files:**
- Modify: `src/stores/app.js`（import、新增 computed、加入 return）
- Test: `src/stores/__tests__/app.test.js`（新增 describe 區塊）

- [ ] **Step 1: Write the failing test**

在 `src/stores/__tests__/app.test.js` 既有 `describe('useAppStore', ...)` 內，新增以下測試。這些測試直接設定 `store.videos`，不依賴 init 的 mock 資料，以涵蓋多球員與子字串情境：

```js
  it('videosByMember returns videos containing the member, newest session first', () => {
    const store = useAppStore()
    store.videos = [
      { video_id: 'a', session_date: '2026-04-05', match_no: 1, title: '20260405 Peter Sandy 1' },
      { video_id: 'b', session_date: '2026-04-12', match_no: 2, title: '20260412 Timo Peter 2' },
      { video_id: 'c', session_date: '2026-04-12', match_no: 1, title: '20260412 Ruby Sandy 1' },
    ]
    const result = store.videosByMember('Peter')
    expect(result.map(v => v.video_id)).toEqual(['b', 'a'])
  })

  it('videosByMember matches whole tokens only, not substrings', () => {
    const store = useAppStore()
    store.videos = [
      { video_id: 'a', session_date: '2026-04-05', match_no: 1, title: '20260405 Fang Peter 1' },
      { video_id: 'b', session_date: '2026-04-12', match_no: 1, title: '20260412 Fangirl Sandy 1' },
    ]
    expect(store.videosByMember('Fang').map(v => v.video_id)).toEqual(['a'])
  })

  it('videosByMember returns [] when member has no videos', () => {
    const store = useAppStore()
    store.videos = [
      { video_id: 'a', session_date: '2026-04-05', match_no: 1, title: '20260405 Peter Sandy 1' },
    ]
    expect(store.videosByMember('Nobody')).toEqual([])
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/stores/__tests__/app.test.js`
Expected: FAIL — `store.videosByMember is not a function`

- [ ] **Step 3: Write minimal implementation**

在 `src/stores/app.js` 頂部 import 區加入：

```js
import { parseVideoPlayers } from '../utils/videos.js'
```

在既有 `videosByDate` computed（約 54–60 行）之後，新增 computed-returning-function：

```js
  const videosByMember = computed(() => (memberName) => {
    if (!memberName) return []
    return videos.value
      .filter(v => parseVideoPlayers(v.title).includes(memberName))
      .sort((a, b) => b.session_date.localeCompare(a.session_date))
  })
```

在 store 的 `return { ... }`（約 322 行）中，於 `videosByDate` 之後加入 `videosByMember`：

```js
  return { config, members, sessions, videos, loading, toast, isAdmin, adminToken, activeMembers, allUniqueGuests, videosByDate, videosByMember, setAdminToken, clearAdminToken, init, refresh, showToast, saveSessionOptimistic, deleteSessionOptimistic, toggleMemberActiveOptimistic, addMemberOptimistic }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/stores/__tests__/app.test.js`
Expected: PASS（含既有測試 + 3 個新測試）

- [ ] **Step 5: Commit**

```bash
git add src/stores/app.js src/stores/__tests__/app.test.js
git commit -m "feat: add videosByMember store getter"
```

---

### Task 4: 泛化 `VideoListModal`（heading / showItemDate / source）

讓播放器能服務「成員影片」情境：可自訂列表標題、每項顯示場次日期、區分分析來源。既有三個呼叫端（`SessionsView` / `HistoryView` / `WeekView`）不傳新 props，行為與外觀完全不變。

**Files:**
- Modify: `src/components/VideoListModal.vue`（props、list 標題、list 項目、analytics 呼叫、新增 per-item 日期格式化）

- [ ] **Step 1: 擴充 props**

把既有 `defineProps`（約 135–139 行）改為：

```js
const props = defineProps({
  show:        { type: Boolean, default: false },
  sessionDate: { type: String,  default: '' },
  videos:      { type: Array,   default: () => [] },
  heading:     { type: String,  default: '' },      // 有值時覆蓋列表標題（成員模式傳成員名）
  showItemDate:{ type: Boolean, default: false },   // true 時每個清單項目顯示場次日期（跨場次用）
  source:      { type: String,  default: 'session' }, // 分析來源：'session' | 'member_sheet'
})
```

- [ ] **Step 2: 列表標題支援 heading**

把列表模式的標題（約 40 行）：

```html
<h2 v-else class="modal__title">{{ formattedDate }} 的影片</h2>
```

改為：

```html
<h2 v-else class="modal__title">{{ heading || `${formattedDate} 的影片` }}</h2>
```

- [ ] **Step 3: 新增 per-item 日期格式化函式**

在 `<script setup>` 中（緊接 `formattedDate` computed 之後，約 309 行後）新增：

```js
function formatItemDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return new Intl.DateTimeFormat('zh-TW', {
    month: 'numeric', day: 'numeric', weekday: 'short',
  }).format(d)
}
```

- [ ] **Step 4: 清單項目顯示場次日期（成員模式）**

把清單項目的「第 N 局」行（約 74 行）：

```html
<p class="video-item__match">第 {{ v.match_no }} 局</p>
```

改為：

```html
<p class="video-item__match">
  <span v-if="showItemDate">{{ formatItemDate(v.session_date) }}　</span>第 {{ v.match_no }} 局
</p>
```

- [ ] **Step 5: 把 source 帶入「列表展開」分析事件**

把 `trackVideoListOpened` 呼叫（約 240–243 行）：

```js
    trackVideoListOpened({
      sessionDate: props.sessionDate,
      videoCount: props.videos.length,
    })
```

改為帶入 source：

```js
    trackVideoListOpened({
      sessionDate: props.sessionDate,
      videoCount: props.videos.length,
      source: props.source,
    })
```

- [ ] **Step 6: analytics 函式接受 source**

`src/utils/analytics.js` 的 `trackVideoListOpened`（約 51–56 行）改為接受並帶出 `source`：

```js
export function trackVideoListOpened({ sessionDate, videoCount, source }) {
  trackVideoEvent('video_list_opened', {
    session_date: sessionDate,
    video_count: videoCount,
    source,
  })
}
```

（既有呼叫端不傳 source 時為 `undefined`，GA4 會忽略該參數，行為相容。）

- [ ] **Step 7: 確認無回歸**

Run: `npm test`
Expected: PASS

Run: `npm run build`
Expected: build 成功

- [ ] **Step 8: 手動驗證既有場次流程未改變**

Run: `npm run dev`，在瀏覽器開啟某有影片的歷史場次，點「N 支影片」：
- 列表標題仍為「<日期> 的影片」
- 清單項目仍只顯示「第 N 局」（無日期）
- 播放、上/下一支、滑動關閉皆正常

- [ ] **Step 9: Commit**

```bash
git add src/components/VideoListModal.vue src/utils/analytics.js
git commit -m "feat: generalize VideoListModal with heading/showItemDate/source props"
```

---

### Task 5: `MemberBadgeSheet` 整合「比賽影片」區塊

在成員個人檔案中、成就徽章下方，加入「比賽影片」縮圖列；點擊以泛化後的 `VideoListModal` 觀看該成員所有比賽。無影片則整塊不顯示。

**Files:**
- Modify: `src/components/MemberBadgeSheet.vue`（template、script：store、computed、影片 modal 狀態與開啟）

- [ ] **Step 1: 匯入相依並取得該成員影片**

`MemberBadgeSheet.vue` 既有 import 為 `import { watch, ref } from 'vue'`。把它改為含 `computed`，並新增 store 與播放器的 import：

```js
import { watch, ref, computed } from 'vue'
import { useAppStore } from '../stores/app.js'
import VideoListModal from './VideoListModal.vue'
```

在 `defineProps` / `defineEmits` 之後加入：

```js
const store = useAppStore()

const memberVideos = computed(() =>
  props.memberName ? store.videosByMember(props.memberName) : []
)

const showVideoModal = ref(false)
const videoStartIndex = ref(0)

function openVideos(index) {
  videoStartIndex.value = index
  showVideoModal.value = true
}
```

- [ ] **Step 2: 在 body 加入「比賽影片」區塊**

把 `modal__body`（約 44–47 行）：

```html
<div class="modal__body">
  <AttendanceHeatmap v-if="memberId" :member-id="memberId" />
  <BadgeGrid v-if="memberId" :member-id="memberId" />
</div>
```

改為（在 BadgeGrid 之後新增區塊）：

```html
<div class="modal__body">
  <AttendanceHeatmap v-if="memberId" :member-id="memberId" />
  <BadgeGrid v-if="memberId" :member-id="memberId" />

  <section v-if="memberVideos.length" class="member-videos">
    <h3 class="member-videos__title">比賽影片 ({{ memberVideos.length }})</h3>
    <ul class="member-videos__list">
      <li
        v-for="(v, index) in memberVideos"
        :key="v.video_id"
        class="member-videos__item"
      >
        <button class="member-videos__btn" @click="openVideos(index)">
          <img
            :src="`https://i.ytimg.com/vi/${v.video_id}/mqdefault.jpg`"
            :alt="`第 ${v.match_no} 局縮圖`"
            class="member-videos__thumb"
            loading="lazy"
          >
        </button>
      </li>
    </ul>
  </section>
</div>
```

- [ ] **Step 3: 在 template 末端加入影片 modal**

把 `MemberBadgeSheet` 既有的 `<Teleport>...</Teleport>` 結構維持不動，並在其後（`</template>` 之前、與外層同級）加入播放器：

```html
    <VideoListModal
      v-model:show="showVideoModal"
      :videos="memberVideos"
      :heading="`${memberName} 的比賽`"
      :show-item-date="true"
      source="member_sheet"
      :start-index="videoStartIndex"
    />
```

- [ ] **Step 4: 讓 `VideoListModal` 支援起始索引**

`VideoListModal` 目前開啟後預設停在列表（`activeVideoIndex = null`）。為了從成員縮圖點哪支就播哪支，新增 `startIndex` prop 並在開啟時套用。

在 `VideoListModal.vue` 的 `defineProps` 加入：

```js
  startIndex:  { type: Number, default: null },
```

在控制 `show` 的 `watch`（約 234 行）的 `if (isOpen) { ... }` 區塊內、設定 `modalOpenedAt` 之後加入：

```js
    if (props.startIndex !== null && props.startIndex >= 0 && props.startIndex < props.videos.length) {
      activeVideoIndex.value = props.startIndex
    }
```

（既有呼叫端不傳 `startIndex`，預設 `null` → 維持停在列表的原行為。）

- [ ] **Step 5: 加入區塊樣式**

在 `MemberBadgeSheet.vue` 的 `<style scoped>` 末端加入：

```css
.member-videos { margin-top: 16px; }
.member-videos__title {
  font-size: 14px; font-weight: 700; color: var(--text-primary);
  margin: 0 0 10px;
}
.member-videos__list {
  display: flex; gap: 10px; overflow-x: auto;
  list-style: none; margin: 0; padding: 0 0 4px;
  -webkit-overflow-scrolling: touch;
}
.member-videos__item { flex: 0 0 auto; }
.member-videos__btn {
  border: none; padding: 0; background: none; cursor: pointer;
  border-radius: 8px; overflow: hidden; display: block;
  touch-action: manipulation;
}
.member-videos__thumb {
  width: 120px; height: 67px; object-fit: cover; display: block;
  border-radius: 8px;
}
```

- [ ] **Step 6: 確認無回歸與建置**

Run: `npm test`
Expected: PASS

Run: `npm run build`
Expected: build 成功

- [ ] **Step 7: 手動驗證**

Run: `npm run dev`，到「統計 → 排行榜」點一位有比賽影片的成員：
- 個人 sheet 在成就徽章下出現「比賽影片 (N)」縮圖列
- 點縮圖開啟播放器，標題為「<成員名> 的比賽」，直接播放被點的那支
- 清單項目顯示「場次日期 + 第 N 局」，可上/下一支、滑動關閉
- 點一位沒有影片的成員 → 不顯示「比賽影片」區塊

- [ ] **Step 8: Commit**

```bash
git add src/components/MemberBadgeSheet.vue src/components/VideoListModal.vue
git commit -m "feat: add match videos section to member profile sheet"
```

---

## 完成後

全部 5 個 Task 完成後，跑一次完整驗證：

```bash
npm test && npm run build
```

預期：所有測試通過、build 成功。功能即可在「排行榜 → 點成員 → 比賽影片」使用。
