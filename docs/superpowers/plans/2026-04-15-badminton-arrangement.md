# 羽球出席系統 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立一個手機優先的羽球出席管理系統，管理員透過 Vue.js 前端勾選本週出席名單並儲存至 Google Sheets，所有成員可公開查看出席、歷史記錄與統計榮譽。

**Architecture:** Vue.js 3 + Pinia 前端負責所有商業邏輯（統計、徽章）。Google Apps Script 作為輕薄資料層，提供 6 個 endpoint 讀寫 Google Sheets。靜態前端部署至 Vercel，透過 GitHub 自動 CI/CD。

**Tech Stack:** Vue 3, Vite, Pinia, Vue Router 4, Vitest, @vue/test-utils, Google Apps Script, Vercel

---

## File Map

```
badminton_arrangement/
├── index.html
├── vite.config.js
├── package.json
├── vercel.json
├── .env.example
├── .gitignore
├── gas/
│   └── Code.gs                        ← GAS API（6 endpoints）
└── src/
    ├── main.js
    ├── App.vue                         ← RouterView + TabBar
    ├── assets/
    │   └── main.css                    ← CSS 變數、reset、全域樣式
    ├── router/
    │   └── index.js                    ← 4 routes
    ├── stores/
    │   ├── app.js                      ← Pinia store（config/members/sessions/isAdmin）
    │   └── __tests__/app.test.js
    ├── services/
    │   ├── api.js                      ← fetch wrapper for GAS
    │   └── __tests__/api.test.js
    ├── utils/
    │   ├── stats.js                    ← buildLeaderboard, getAttendanceCount, getCurrentStreak
    │   ├── badges.js                   ← BADGE_DEFINITIONS, getBadges
    │   └── __tests__/
    │       ├── stats.test.js
    │       └── badges.test.js
    ├── components/
    │   ├── TabBar.vue
    │   ├── AttendeeChip.vue
    │   ├── HistoryCard.vue
    │   ├── RankCard.vue
    │   ├── BadgeGrid.vue
    │   └── MemberCheckItem.vue
    └── views/
        ├── WeekView.vue
        ├── HistoryView.vue
        ├── StatsView.vue
        └── AdminView.vue
```

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `vite.config.js`
- Create: `index.html`
- Create: `src/main.js`
- Create: `.env.example`
- Create: `.gitignore`
- Create: `vercel.json`

- [ ] **Step 1: 初始化專案**

```bash
cd /Users/peterlu/docker/mount/var/www/badminton_arrangement
npm create vite@latest . -- --template vue
```

選擇覆寫現有目錄時選 `Yes`。

- [ ] **Step 2: 安裝依賴**

```bash
npm install pinia vue-router@4
npm install -D vitest @vue/test-utils jsdom @vitejs/plugin-vue
```

- [ ] **Step 3: 設定 vite.config.js**

```js
// vite.config.js
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    globals: true,
  },
})
```

- [ ] **Step 4: 更新 package.json scripts**

```json
{
  "name": "badminton-arrangement",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "pinia": "^2.1.7",
    "vue": "^3.4.0",
    "vue-router": "^4.3.0"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^5.0.0",
    "@vue/test-utils": "^2.4.0",
    "jsdom": "^24.0.0",
    "vite": "^5.0.0",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 5: 建立 vercel.json（SPA routing）**

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

- [ ] **Step 6: 建立 .env.example**

```
VITE_GAS_URL=https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec
VITE_ADMIN_TOKEN=your-secret-token-here
```

- [ ] **Step 7: 更新 .gitignore**

確保 `.gitignore` 包含：

```
node_modules/
dist/
.env
.env.local
.superpowers/
```

- [ ] **Step 8: 清理 Vite 預設範例檔案**

```bash
rm -rf src/components/HelloWorld.vue src/assets/vue.svg public/vite.svg src/style.css
```

- [ ] **Step 9: 確認能跑起來**

```bash
npm run dev
```

Expected: `Local: http://localhost:5173/` 出現在終端，瀏覽器可開啟。

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: scaffold Vue 3 + Vite + Pinia + Vue Router project"
```

---

## Task 2: 全域樣式 + main.js

**Files:**
- Create: `src/assets/main.css`
- Create: `src/main.js`

- [ ] **Step 1: 建立全域 CSS 變數與 reset**

```css
/* src/assets/main.css */
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

:root {
  --primary:           #6200EE;
  --primary-variant:   #3700B3;
  --secondary:         #03DAC6;
  --secondary-variant: #018786;
  --error:             #B00020;
  --background:        #FFFFFF;
  --surface:           #FFFFFF;
  --on-primary:        #FFFFFF;
  --on-secondary:      #000000;
  --on-error:          #FFFFFF;

  --text-primary:      #111827;
  --text-secondary:    #555555;
  --text-tertiary:     #888888;
  --border:            rgba(0, 0, 0, 0.08);
  --surface-tinted:    #f7f4ff;
  --surface-secondary: #f0fdfc;

  --radius-sm: 8px;
  --radius-md: 16px;
  --radius-lg: 20px;
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.05);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.06);
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif;
  background: var(--background);
  color: var(--text-primary);
  -webkit-tap-highlight-color: transparent;
  min-height: 100dvh;
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    transition: none !important;
    animation: none !important;
  }
}
```

- [ ] **Step 2: 建立 main.js**

```js
// src/main.js
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router/index.js'
import './assets/main.css'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
```

- [ ] **Step 3: Commit**

```bash
git add src/assets/main.css src/main.js
git commit -m "feat: add global CSS variables and main.js setup"
```

---

## Task 3: API Service Layer

**Files:**
- Create: `src/services/api.js`
- Create: `src/services/__tests__/api.test.js`

- [ ] **Step 1: 寫測試（先讓測試失敗）**

```js
// src/services/__tests__/api.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { api } from '../api.js'

const FAKE_URL = 'https://fake-gas.example.com/exec'

beforeEach(() => {
  import.meta.env.VITE_GAS_URL = FAKE_URL
  vi.restoreAllMocks()
})

describe('api.getConfig', () => {
  it('calls GET with action=getConfig and returns data', async () => {
    const mockData = { venue_name: '大安體育場', time_start: '09:00' }
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: 'ok', data: mockData }),
    })

    const result = await api.getConfig()

    expect(fetch).toHaveBeenCalledWith(`${FAKE_URL}?action=getConfig`)
    expect(result).toEqual(mockData)
  })

  it('throws when GAS returns error status', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: 'error', message: 'Sheet not found' }),
    })

    await expect(api.getConfig()).rejects.toThrow('Sheet not found')
  })
})

describe('api.saveSession', () => {
  it('calls POST with action=saveSession and admin_token in body', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: 'ok', data: { session_id: 's1' } }),
    })

    await api.saveSession('my-token', '2026-04-19', [
      { member_id: 'm1', name: 'Peter', type: 'member', guest_key: null },
    ])

    expect(fetch).toHaveBeenCalledWith(
      `${FAKE_URL}?action=saveSession`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          admin_token: 'my-token',
          date: '2026-04-19',
          attendances: [{ member_id: 'm1', name: 'Peter', type: 'member', guest_key: null }],
        }),
      })
    )
  })
})
```

- [ ] **Step 2: 執行測試確認失敗**

```bash
npm test
```

Expected: FAIL — `Cannot find module '../api.js'`

- [ ] **Step 3: 實作 api.js**

```js
// src/services/api.js
const GAS_URL = import.meta.env.VITE_GAS_URL

async function gasGet(action) {
  const res = await fetch(`${GAS_URL}?action=${action}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json()
  if (json.status === 'error') throw new Error(json.message)
  return json.data
}

async function gasPost(action, body) {
  const res = await fetch(`${GAS_URL}?action=${action}`, {
    method: 'POST',
    redirect: 'follow',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json()
  if (json.status === 'error') throw new Error(json.message)
  return json.data
}

export const api = {
  getConfig:    ()                              => gasGet('getConfig'),
  getMembers:   ()                              => gasGet('getMembers'),
  getSessions:  ()                              => gasGet('getSessions'),
  saveSession:  (token, date, attendances)      => gasPost('saveSession',  { admin_token: token, date, attendances }),
  saveMember:   (token, member)                 => gasPost('saveMember',   { admin_token: token, ...member }),
  promoteGuest: (token, guest_key, member_id)   => gasPost('promoteGuest', { admin_token: token, guest_key, member_id }),
}
```

> **注意**：GAS Web App POST 會發生 redirect，`Content-Type: text/plain` 可避免 CORS preflight 問題。`redirect: 'follow'` 確保 fetch 跟隨重定向。

- [ ] **Step 4: 執行測試確認通過**

```bash
npm test
```

Expected: PASS — 3 tests passed

- [ ] **Step 5: Commit**

```bash
git add src/services/api.js src/services/__tests__/api.test.js
git commit -m "feat: add GAS API service layer with tests"
```

---

## Task 4: Stats & Badge Utilities

**Files:**
- Create: `src/utils/stats.js`
- Create: `src/utils/badges.js`
- Create: `src/utils/__tests__/stats.test.js`
- Create: `src/utils/__tests__/badges.test.js`

### 4a: Stats

- [ ] **Step 1: 寫 stats 測試**

```js
// src/utils/__tests__/stats.test.js
import { describe, it, expect } from 'vitest'
import { buildLeaderboard, getAttendanceCount, getCurrentStreak } from '../stats.js'

const sessions = [
  {
    session_id: 's1', date: '2026-04-05',
    attendances: [
      { member_id: 'm1', name: 'Peter', type: 'member' },
      { member_id: 'm2', name: 'Andy',  type: 'member' },
    ],
  },
  {
    session_id: 's2', date: '2026-04-12',
    attendances: [
      { member_id: 'm1', name: 'Peter', type: 'member' },
      { member_id: null, name: '訪客 John', type: 'guest' },
    ],
  },
  {
    session_id: 's3', date: '2026-04-19',
    attendances: [
      { member_id: 'm1', name: 'Peter', type: 'member' },
      { member_id: 'm2', name: 'Andy',  type: 'member' },
    ],
  },
]

const members = [
  { id: 'm1', name: 'Peter', active: true },
  { id: 'm2', name: 'Andy',  active: true },
  { id: 'm3', name: 'Lisa',  active: true },
]

describe('getAttendanceCount', () => {
  it('counts sessions where member attended', () => {
    expect(getAttendanceCount('m1', sessions)).toBe(3)
    expect(getAttendanceCount('m2', sessions)).toBe(2)
    expect(getAttendanceCount('m3', sessions)).toBe(0)
  })
})

describe('getCurrentStreak', () => {
  it('returns consecutive streak from most recent session', () => {
    // m1 attended s3, s2, s1 — streak 3
    expect(getCurrentStreak('m1', sessions)).toBe(3)
    // m2 attended s3, s1 (missed s2) — streak 1
    expect(getCurrentStreak('m2', sessions)).toBe(1)
    // m3 never attended — streak 0
    expect(getCurrentStreak('m3', sessions)).toBe(0)
  })
})

describe('buildLeaderboard', () => {
  it('returns members sorted by attendance count descending', () => {
    const board = buildLeaderboard(members, sessions)
    expect(board[0]).toMatchObject({ member: { id: 'm1' }, count: 3 })
    expect(board[1]).toMatchObject({ member: { id: 'm2' }, count: 2 })
    expect(board[2]).toMatchObject({ member: { id: 'm3' }, count: 0 })
  })

  it('includes inactive members who have attendance records', () => {
    const withInactive = [
      ...members,
      { id: 'm4', name: 'Tom', active: false },
    ]
    const sessionsWithTom = [
      ...sessions,
      {
        session_id: 's4', date: '2026-03-29',
        attendances: [{ member_id: 'm4', name: 'Tom', type: 'member' }],
      },
    ]
    const board = buildLeaderboard(withInactive, sessionsWithTom)
    expect(board.some(e => e.member.id === 'm4')).toBe(true)
  })
})
```

- [ ] **Step 2: 執行確認失敗**

```bash
npm test
```

Expected: FAIL — `Cannot find module '../stats.js'`

- [ ] **Step 3: 實作 stats.js**

```js
// src/utils/stats.js

export function getAttendanceCount(memberId, sessions) {
  return sessions.filter(s =>
    s.attendances.some(a => a.member_id === memberId)
  ).length
}

export function getCurrentStreak(memberId, sessions) {
  const sorted = [...sessions].sort((a, b) => b.date.localeCompare(a.date))
  let streak = 0
  for (const session of sorted) {
    if (session.attendances.some(a => a.member_id === memberId)) {
      streak++
    } else {
      break
    }
  }
  return streak
}

export function buildLeaderboard(members, sessions) {
  const counts = {}
  for (const session of sessions) {
    for (const att of session.attendances) {
      if (att.member_id) {
        counts[att.member_id] = (counts[att.member_id] || 0) + 1
      }
    }
  }
  return members
    .filter(m => m.active || counts[m.id])
    .map(m => ({ member: m, count: counts[m.id] || 0 }))
    .sort((a, b) => b.count - a.count)
}
```

- [ ] **Step 4: 執行確認通過**

```bash
npm test
```

Expected: PASS — stats tests pass

### 4b: Badges

- [ ] **Step 5: 寫 badges 測試**

```js
// src/utils/__tests__/badges.test.js
import { describe, it, expect } from 'vitest'
import { getBadges } from '../badges.js'

function makeSession(date, memberIds) {
  return {
    session_id: `s-${date}`,
    date,
    attendances: memberIds.map(id => ({ member_id: id, name: id, type: 'member' })),
  }
}

const members = [
  { id: 'm1', name: 'Peter', active: true },
  { id: 'm2', name: 'Andy',  active: true },
]

describe('getBadges', () => {
  it('unlocks count_10 when member attended 10+ times', () => {
    const sessions = Array.from({ length: 10 }, (_, i) =>
      makeSession(`2026-0${Math.floor(i/4)+1}-${String((i%4)*7+1).padStart(2,'0')}`, ['m1'])
    )
    const badges = getBadges('m1', sessions, members)
    expect(badges.find(b => b.id === 'count_10').unlocked).toBe(true)
    expect(badges.find(b => b.id === 'count_20').unlocked).toBe(false)
  })

  it('unlocks streak_5 when member has 5 consecutive sessions', () => {
    const sessions = [
      makeSession('2026-03-22', ['m1']),
      makeSession('2026-03-29', ['m1']),
      makeSession('2026-04-05', ['m1']),
      makeSession('2026-04-12', ['m1']),
      makeSession('2026-04-19', ['m1']),
    ]
    const badges = getBadges('m1', sessions, members)
    expect(badges.find(b => b.id === 'streak_5').unlocked).toBe(true)
  })

  it('does not unlock streak_5 when streak is broken', () => {
    const sessions = [
      makeSession('2026-03-22', ['m1']),
      makeSession('2026-03-29', []),        // missed
      makeSession('2026-04-05', ['m1']),
      makeSession('2026-04-12', ['m1']),
      makeSession('2026-04-19', ['m1']),
    ]
    const badges = getBadges('m1', sessions, members)
    expect(badges.find(b => b.id === 'streak_5').unlocked).toBe(false)
  })

  it('unlocks annual_top for the member with most attendance this year', () => {
    const sessions = [
      makeSession('2026-04-05', ['m1', 'm2']),
      makeSession('2026-04-12', ['m1']),
      makeSession('2026-04-19', ['m1']),
    ]
    const m1Badges = getBadges('m1', sessions, members)
    const m2Badges = getBadges('m2', sessions, members)
    expect(m1Badges.find(b => b.id === 'annual_top').unlocked).toBe(true)
    expect(m2Badges.find(b => b.id === 'annual_top').unlocked).toBe(false)
  })

  it('returns all 8 badge definitions for any member', () => {
    const badges = getBadges('m1', [], members)
    expect(badges).toHaveLength(8)
  })
})
```

- [ ] **Step 6: 執行確認失敗**

```bash
npm test
```

Expected: FAIL — `Cannot find module '../badges.js'`

- [ ] **Step 7: 實作 badges.js**

```js
// src/utils/badges.js
import { getAttendanceCount, getCurrentStreak } from './stats.js'

function hasMonthlyPerfectAttendance(memberId, sessions) {
  const byMonth = {}
  for (const s of sessions) {
    const month = s.date.slice(0, 7) // 'YYYY-MM'
    if (!byMonth[month]) byMonth[month] = { total: 0, attended: 0 }
    byMonth[month].total++
    if (s.attendances.some(a => a.member_id === memberId)) {
      byMonth[month].attended++
    }
  }
  return Object.values(byMonth).some(m => m.total >= 4 && m.attended === m.total)
}

function isAnnualTop(memberId, sessions, members) {
  const currentYear = new Date().getFullYear().toString()
  const yearSessions = sessions.filter(s => s.date.startsWith(currentYear))
  const counts = members.map(m => ({
    id: m.id,
    count: getAttendanceCount(m.id, yearSessions),
  }))
  const max = Math.max(...counts.map(c => c.count))
  if (max === 0) return false
  const topId = counts.find(c => c.count === max)?.id
  return topId === memberId
}

export const BADGE_DEFINITIONS = [
  {
    id: 'streak_5',
    icon: '🔥',
    name: '連續 5 週',
    check: (id, sessions) => getCurrentStreak(id, sessions) >= 5,
  },
  {
    id: 'count_10',
    icon: '💯',
    name: '出席 10 次',
    check: (id, sessions) => getAttendanceCount(id, sessions) >= 10,
  },
  {
    id: 'count_20',
    icon: '⭐',
    name: '出席 20 次',
    check: (id, sessions) => getAttendanceCount(id, sessions) >= 20,
  },
  {
    id: 'count_50',
    icon: '💎',
    name: '出席 50 次',
    check: (id, sessions) => getAttendanceCount(id, sessions) >= 50,
  },
  {
    id: 'streak_10',
    icon: '🚀',
    name: '連續 10 週',
    check: (id, sessions) => getCurrentStreak(id, sessions) >= 10,
  },
  {
    id: 'monthly_4',
    icon: '🎯',
    name: '全勤一個月',
    check: (id, sessions) => hasMonthlyPerfectAttendance(id, sessions),
  },
  {
    id: 'annual_top',
    icon: '🏅',
    name: '最佳球員',
    check: (id, sessions, members) => isAnnualTop(id, sessions, members),
  },
  {
    id: 'week_champ',
    icon: '👑',
    name: '週冠軍',
    check: (id, sessions, members) => {
      if (!sessions.length) return false
      const latest = [...sessions].sort((a, b) => b.date.localeCompare(a.date))[0]
      const counts = members.map(m => ({
        id: m.id,
        count: getAttendanceCount(m.id, sessions),
      }))
      const max = Math.max(...counts.map(c => c.count))
      if (max === 0) return false
      const topId = counts.find(c => c.count === max)?.id
      return topId === id && latest.attendances.some(a => a.member_id === id)
    },
  },
]

export function getBadges(memberId, sessions, members) {
  return BADGE_DEFINITIONS.map(def => ({
    id: def.id,
    icon: def.icon,
    name: def.name,
    unlocked: def.check(memberId, sessions, members),
  }))
}
```

- [ ] **Step 8: 執行所有測試確認通過**

```bash
npm test
```

Expected: PASS — all stats + badges tests pass

- [ ] **Step 9: Commit**

```bash
git add src/utils/
git commit -m "feat: add stats and badge utility functions with tests"
```

---

## Task 5: Pinia Store

**Files:**
- Create: `src/stores/app.js`
- Create: `src/stores/__tests__/app.test.js`

- [ ] **Step 1: 寫 store 測試**

```js
// src/stores/__tests__/app.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAppStore } from '../app.js'

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
  },
}))

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('useAppStore', () => {
  it('loads config, members, sessions on init', async () => {
    const store = useAppStore()
    await store.init()

    expect(store.config.venue_name).toBe('大安體育場')
    expect(store.members).toHaveLength(1)
    expect(store.sessions).toHaveLength(1)
  })

  it('isAdmin is true when token matches VITE_ADMIN_TOKEN', () => {
    import.meta.env.VITE_ADMIN_TOKEN = 'secret'
    const store = useAppStore()
    store.setAdminToken('secret')
    expect(store.isAdmin).toBe(true)
  })

  it('isAdmin is false when token is wrong', () => {
    import.meta.env.VITE_ADMIN_TOKEN = 'secret'
    const store = useAppStore()
    store.setAdminToken('wrong')
    expect(store.isAdmin).toBe(false)
  })

  it('activeMembers returns only active members', async () => {
    const store = useAppStore()
    await store.init()
    expect(store.activeMembers).toHaveLength(1)
    expect(store.activeMembers[0].id).toBe('m1')
  })
})
```

- [ ] **Step 2: 執行確認失敗**

```bash
npm test
```

Expected: FAIL — `Cannot find module '../app.js'`

- [ ] **Step 3: 實作 store**

```js
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
```

- [ ] **Step 4: 執行確認通過**

```bash
npm test
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/stores/
git commit -m "feat: add Pinia store with init, isAdmin, activeMembers"
```

---

## Task 6: Router + App Shell + TabBar

**Files:**
- Create: `src/router/index.js`
- Create: `src/App.vue`
- Create: `src/components/TabBar.vue`

- [ ] **Step 1: 建立 router**

```js
// src/router/index.js
import { createRouter, createWebHistory } from 'vue-router'
import { useAppStore } from '../stores/app.js'

const routes = [
  { path: '/',        component: () => import('../views/WeekView.vue') },
  { path: '/history', component: () => import('../views/HistoryView.vue') },
  { path: '/stats',   component: () => import('../views/StatsView.vue') },
  { path: '/admin',   component: () => import('../views/AdminView.vue') },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to) => {
  if (to.query.token) {
    const store = useAppStore()
    store.setAdminToken(to.query.token)
  }
})

export default router
```

- [ ] **Step 2: 建立 TabBar.vue**

```vue
<!-- src/components/TabBar.vue -->
<template>
  <nav class="tabbar" aria-label="主選單">
    <button
      v-for="tab in tabs"
      :key="tab.path"
      class="tab"
      :class="{ active: isActive(tab.path) }"
      :aria-label="tab.label"
      :aria-current="isActive(tab.path) ? 'page' : undefined"
      @click="router.push(tab.path)"
    >
      <span class="tab-icon" aria-hidden="true">{{ tab.icon }}</span>
      <span>{{ tab.label }}</span>
    </button>
  </nav>
</template>

<script setup>
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route  = useRoute()

const tabs = [
  { path: '/',        icon: '🏸', label: '本週' },
  { path: '/history', icon: '📋', label: '歷史' },
  { path: '/stats',   icon: '🏆', label: '榮譽' },
]

function isActive(path) {
  return route.path === path
}
</script>

<style scoped>
.tabbar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(255, 255, 255, 0.93);
  backdrop-filter: blur(16px) saturate(180%);
  -webkit-backdrop-filter: blur(16px) saturate(180%);
  border-top: 1px solid var(--border);
  display: flex;
  z-index: 100;
  padding-bottom: env(safe-area-inset-bottom, 0px);
  max-width: 480px;
  margin: 0 auto;
}

.tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 10px 4px 12px;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 10px;
  font-weight: 500;
  color: var(--text-tertiary);
  touch-action: manipulation;
  transition: color 0.15s ease;
}

.tab:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: -2px;
  border-radius: 8px;
}

.tab.active { color: var(--primary); }
.tab.active::after {
  content: '';
  display: block;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: currentColor;
}

.tab-icon { font-size: 22px; line-height: 1; }
</style>
```

- [ ] **Step 3: 建立 App.vue**

```vue
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
```

- [ ] **Step 4: 確認路由正常**

```bash
npm run dev
```

瀏覽器開啟 `http://localhost:5173`，底部應出現 TabBar 三個頁籤（view 頁面尚未建立所以會有 error，這是正常的）。

- [ ] **Step 5: Commit**

```bash
git add src/router/ src/App.vue src/components/TabBar.vue
git commit -m "feat: add router, App shell, and TabBar component"
```

---

## Task 7: WeekView + AttendeeChip

**Files:**
- Create: `src/components/AttendeeChip.vue`
- Create: `src/views/WeekView.vue`

- [ ] **Step 1: 建立 AttendeeChip.vue**

```vue
<!-- src/components/AttendeeChip.vue -->
<template>
  <div
    class="chip"
    :class="type === 'guest' ? 'chip--guest' : 'chip--member'"
    role="listitem"
  >
    <div class="avatar" aria-hidden="true">{{ initial }}</div>
    <span>{{ name }}</span>
  </div>
</template>

<script setup>
const props = defineProps({
  name: { type: String, required: true },
  type: { type: String, default: 'member' }, // 'member' | 'guest'
})

const initial = props.name.charAt(0).toUpperCase()
</script>

<style scoped>
.chip {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 8px 13px 8px 8px;
  border-radius: 100px;
  font-size: 14px;
  font-weight: 600;
  border: 1px solid var(--border);
  box-shadow: var(--shadow-sm);
}

.chip--member {
  background: var(--surface);
  color: var(--primary);
  border-color: rgba(98, 0, 238, 0.15);
}

.chip--guest {
  background: #fff8f8;
  color: var(--error);
  border-color: rgba(176, 0, 32, 0.2);
}

.avatar {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  color: var(--on-primary);
  background: var(--primary);
  flex-shrink: 0;
}

.chip--guest .avatar {
  background: var(--error);
}
</style>
```

- [ ] **Step 2: 建立 WeekView.vue**

```vue
<!-- src/views/WeekView.vue -->
<template>
  <div class="view">
    <!-- Hero -->
    <header class="hero hero--primary">
      <div class="status-bar" aria-hidden="true">
        <span>{{ formattedDate }}</span>
      </div>
      <div class="hero__content">
        <p class="hero__eyebrow">本週場次</p>
        <h1 class="hero__title">
          {{ sessionDateLabel }}<br>{{ config.time_start }}–{{ config.time_end }}
        </h1>
        <p class="hero__meta">📍 {{ config.venue_name }}</p>
      </div>
    </header>

    <!-- Sheet -->
    <main class="sheet">
      <!-- 尚未設定 -->
      <div v-if="!currentSession" class="empty-state">
        <p class="empty-state__icon">🏸</p>
        <p class="empty-state__title">本週名單尚未設定</p>
        <p class="empty-state__sub">管理員稍後會更新…</p>
      </div>

      <!-- 有名單 -->
      <template v-else>
        <div class="count-row" role="status" aria-live="polite">
          <span class="count-num" :aria-label="`${attendees.length} 人出席`">
            {{ attendees.length }}
          </span>
          <div>
            <p class="count-desc">人確認出席</p>
            <p class="count-sub">{{ lastUpdatedLabel }}</p>
          </div>
        </div>

        <div class="chip-wrap" role="list" aria-label="出席成員">
          <AttendeeChip
            v-for="att in attendees"
            :key="att.id"
            :name="att.name"
            :type="att.type"
          />
        </div>
      </template>
    </main>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useAppStore } from '../stores/app.js'
import AttendeeChip from '../components/AttendeeChip.vue'

const store = useAppStore()

const config = computed(() => store.config)

const formattedDate = new Intl.DateTimeFormat('zh-TW', {
  month: 'numeric', day: 'numeric', weekday: 'short',
}).format(new Date())

// 找最近未來（或今日）的場次
const currentSession = computed(() => {
  const today = new Date().toISOString().slice(0, 10)
  return store.sessions.find(s => s.date >= today) ??
         store.sessions[0] ?? null
})

const attendees = computed(() =>
  currentSession.value?.attendances ?? []
)

const sessionDateLabel = computed(() => {
  if (!currentSession.value) return '—'
  const d = new Date(currentSession.value.date + 'T00:00:00')
  return new Intl.DateTimeFormat('zh-TW', {
    month: 'numeric', day: 'numeric', weekday: 'short',
  }).format(d)
})

const lastUpdatedLabel = computed(() => {
  if (!currentSession.value) return ''
  const d = new Date(currentSession.value.created_at)
  return `由管理員更新於 ${d.getMonth() + 1}/${d.getDate()}`
})
</script>

<style scoped>
.view { min-height: 100dvh; display: flex; flex-direction: column; }

.hero { padding-bottom: 0; }
.hero--primary { background: var(--primary); }
.status-bar {
  display: flex;
  justify-content: flex-end;
  padding: 14px 22px 2px;
  font-size: 12px;
  font-weight: 600;
  color: var(--on-primary);
}
.hero__content { padding: 4px 22px 30px; color: var(--on-primary); }
.hero__eyebrow {
  font-size: 11px; font-weight: 600; text-transform: uppercase;
  letter-spacing: 1.2px; opacity: 0.75; margin-bottom: 6px;
}
.hero__title {
  font-size: 28px; font-weight: 800;
  letter-spacing: -0.6px; line-height: 1.15;
  text-wrap: balance; margin-bottom: 6px;
}
.hero__meta { font-size: 13px; opacity: 0.8; }

.sheet {
  flex: 1;
  background: var(--background);
  border-radius: 24px 24px 0 0;
  padding: 20px 16px calc(80px + env(safe-area-inset-bottom, 0px));
  margin-top: -20px;
}

.empty-state {
  text-align: center;
  padding: 48px 16px;
}
.empty-state__icon { font-size: 48px; margin-bottom: 12px; }
.empty-state__title { font-size: 16px; font-weight: 600; margin-bottom: 6px; }
.empty-state__sub   { font-size: 13px; color: var(--text-tertiary); }

.count-row {
  background: var(--surface-tinted);
  border-radius: var(--radius-md);
  padding: 14px 16px;
  display: flex; align-items: center; gap: 14px;
  margin-bottom: 14px;
  border: 1px solid rgba(98, 0, 238, 0.12);
}
.count-num {
  font-size: 36px; font-weight: 800;
  color: var(--primary);
  font-variant-numeric: tabular-nums;
  line-height: 1;
}
.count-desc { font-size: 14px; font-weight: 600; }
.count-sub  { font-size: 12px; color: var(--text-tertiary); margin-top: 2px; }

.chip-wrap  { display: flex; flex-wrap: wrap; gap: 8px; }
</style>
```

- [ ] **Step 3: 確認畫面**

```bash
npm run dev
```

開啟 `http://localhost:5173`，應看到紫色 hero + 本週出席畫面（資料 API 尚未設定時會顯示 empty state）。

- [ ] **Step 4: Commit**

```bash
git add src/components/AttendeeChip.vue src/views/WeekView.vue
git commit -m "feat: add WeekView and AttendeeChip component"
```

---

## Task 8: HistoryView + HistoryCard

**Files:**
- Create: `src/components/HistoryCard.vue`
- Create: `src/views/HistoryView.vue`

- [ ] **Step 1: 建立 HistoryCard.vue**

```vue
<!-- src/components/HistoryCard.vue -->
<template>
  <li class="card">
    <time class="card__date" :datetime="session.date">
      {{ formattedDate }}
    </time>
    <p class="card__names">{{ nameList }}</p>
    <p class="card__count">
      {{ session.attendances.length }} 人出席
    </p>
  </li>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  session: { type: Object, required: true },
})

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
.card__count { font-size: 12px; font-weight: 700; color: var(--secondary-variant); font-variant-numeric: tabular-nums; }
</style>
```

- [ ] **Step 2: 建立 HistoryView.vue**

```vue
<!-- src/views/HistoryView.vue -->
<template>
  <div class="view">
    <header class="hero hero--variant">
      <div class="status-bar" aria-hidden="true"></div>
      <div class="hero__content">
        <p class="hero__eyebrow">出席紀錄</p>
        <h1 class="hero__title">歷史記錄</h1>
        <p class="hero__meta">共 {{ pastSessions.length }} 週 · 平均 {{ avgAttendance }} 人</p>
      </div>
    </header>

    <main class="sheet">
      <div v-if="!pastSessions.length" class="empty-state">
        <p class="empty-state__icon">📋</p>
        <p class="empty-state__title">尚無歷史記錄</p>
      </div>
      <ol v-else aria-label="歷史出席記錄" class="list">
        <HistoryCard
          v-for="session in pastSessions"
          :key="session.session_id"
          :session="session"
        />
      </ol>
    </main>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useAppStore } from '../stores/app.js'
import HistoryCard from '../components/HistoryCard.vue'

const store = useAppStore()

const pastSessions = computed(() => {
  const today = new Date().toISOString().slice(0, 10)
  return store.sessions
    .filter(s => s.date < today)
    .sort((a, b) => b.date.localeCompare(a.date))
})

const avgAttendance = computed(() => {
  if (!pastSessions.value.length) return '0'
  const total = pastSessions.value.reduce((sum, s) => sum + s.attendances.length, 0)
  return (total / pastSessions.value.length).toFixed(1)
})
</script>

<style scoped>
.view { min-height: 100dvh; display: flex; flex-direction: column; }
.hero--variant { background: var(--primary-variant); }

.status-bar { height: 44px; }
.hero__content { padding: 4px 22px 30px; color: var(--on-primary); }
.hero__eyebrow {
  font-size: 11px; font-weight: 600; text-transform: uppercase;
  letter-spacing: 1.2px; opacity: 0.75; margin-bottom: 6px;
}
.hero__title {
  font-size: 28px; font-weight: 800;
  letter-spacing: -0.6px; line-height: 1.15; margin-bottom: 6px;
  text-wrap: balance;
}
.hero__meta { font-size: 13px; opacity: 0.8; }

.sheet {
  flex: 1;
  background: var(--background);
  border-radius: 24px 24px 0 0;
  padding: 20px 16px calc(80px + env(safe-area-inset-bottom, 0px));
  margin-top: -20px;
}

.list { display: flex; flex-direction: column; gap: 10px; }

.empty-state {
  text-align: center; padding: 48px 16px;
}
.empty-state__icon  { font-size: 48px; margin-bottom: 12px; }
.empty-state__title { font-size: 16px; font-weight: 600; }
</style>
```

- [ ] **Step 3: Commit**

```bash
git add src/components/HistoryCard.vue src/views/HistoryView.vue
git commit -m "feat: add HistoryView and HistoryCard component"
```

---

## Task 9: StatsView + RankCard + BadgeGrid

**Files:**
- Create: `src/components/RankCard.vue`
- Create: `src/components/BadgeGrid.vue`
- Create: `src/views/StatsView.vue`

- [ ] **Step 1: 建立 RankCard.vue**

```vue
<!-- src/components/RankCard.vue -->
<template>
  <li class="rank-card" :class="{ 'rank-card--top': rank === 1 }">
    <span class="rank-icon" aria-hidden="true">{{ rankIcon }}</span>
    <div class="rank-body">
      <span class="rank-name">{{ member.name }}</span>
      <div class="rank-bar-bg" role="presentation">
        <div class="rank-bar" :style="{ width: barWidth }"></div>
      </div>
    </div>
    <span class="rank-count" :aria-label="`${count} 次`">
      {{ count }} 次
    </span>
  </li>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  rank:     { type: Number, required: true },
  member:   { type: Object, required: true },
  count:    { type: Number, required: true },
  maxCount: { type: Number, required: true },
})

const rankIcon = computed(() => {
  const icons = { 1: '🥇', 2: '🥈', 3: '🥉' }
  return icons[props.rank] ?? `${props.rank}.`
})

const barWidth = computed(() =>
  props.maxCount > 0 ? `${(props.count / props.maxCount) * 100}%` : '0%'
)
</script>

<style scoped>
.rank-card {
  background: var(--surface);
  border-radius: var(--radius-md);
  padding: 12px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  border: 1px solid var(--border);
  box-shadow: var(--shadow-sm);
  list-style: none;
}
.rank-card--top {
  background: var(--surface-secondary);
  border-color: rgba(3, 218, 198, 0.3);
}
.rank-icon { font-size: 22px; width: 28px; text-align: center; flex-shrink: 0; }
.rank-body { flex: 1; min-width: 0; }
.rank-name { font-size: 15px; font-weight: 700; color: var(--text-primary); display: block; }
.rank-bar-bg { height: 4px; background: #eeeeee; border-radius: 4px; margin-top: 4px; }
.rank-bar    { height: 4px; border-radius: 4px; background: var(--secondary-variant); }
.rank-count  {
  font-size: 13px; font-weight: 700; color: var(--primary);
  font-variant-numeric: tabular-nums; flex-shrink: 0;
}
</style>
```

- [ ] **Step 2: 建立 BadgeGrid.vue**

```vue
<!-- src/components/BadgeGrid.vue -->
<template>
  <div>
    <h2 class="section-heading" :id="headingId">成就徽章</h2>
    <div class="grid" role="list" :aria-labelledby="headingId">
      <div
        v-for="badge in badges"
        :key="badge.id"
        class="badge"
        :class="{ 'badge--locked': !badge.unlocked }"
        role="listitem"
        :aria-label="`${badge.name}（${badge.unlocked ? '已解鎖' : '未解鎖'}）`"
      >
        <div class="badge__icon" aria-hidden="true">{{ badge.icon }}</div>
        <div class="badge__name">{{ badge.name }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useAppStore } from '../stores/app.js'
import { getBadges } from '../utils/badges.js'

const props = defineProps({
  memberId: { type: String, required: true },
})

const store = useAppStore()

const headingId = `badge-heading-${props.memberId}`

const badges = computed(() =>
  getBadges(props.memberId, store.sessions, store.members)
)
</script>

<style scoped>
.section-heading {
  font-size: 12px; font-weight: 700; color: var(--text-secondary);
  text-transform: uppercase; letter-spacing: 0.8px; margin: 16px 0 10px;
}
.grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}
.badge {
  background: var(--surface-tinted);
  border-radius: var(--radius-sm);
  padding: 10px 6px;
  text-align: center;
  border: 1px solid rgba(98, 0, 238, 0.1);
  box-shadow: var(--shadow-sm);
}
.badge--locked { opacity: 0.28; }
.badge__icon { font-size: 22px; margin-bottom: 4px; }
.badge__name { font-size: 10px; color: var(--text-secondary); line-height: 1.3; }
</style>
```

- [ ] **Step 3: 建立 StatsView.vue**

```vue
<!-- src/views/StatsView.vue -->
<template>
  <div class="view">
    <header class="hero hero--sec-variant">
      <div class="status-bar" aria-hidden="true"></div>
      <div class="hero__content">
        <p class="hero__eyebrow">統計 &amp; 榮譽</p>
        <h1 class="hero__title">排行榜</h1>
        <p class="hero__meta">共 {{ store.sessions.length }} 週統計</p>
      </div>
    </header>

    <main class="sheet">
      <div v-if="!leaderboard.length" class="empty-state">
        <p class="empty-state__icon">🏆</p>
        <p class="empty-state__title">尚無出席記錄</p>
      </div>
      <template v-else>
        <ol aria-label="出席排行榜" class="rank-list">
          <RankCard
            v-for="(entry, i) in leaderboard"
            :key="entry.member.id"
            :rank="i + 1"
            :member="entry.member"
            :count="entry.count"
            :max-count="leaderboard[0].count"
          />
        </ol>

        <!-- 選取成員查看徽章 -->
        <div class="member-selector">
          <label for="badge-member-select" class="section-heading">
            查看個人成就
          </label>
          <select
            id="badge-member-select"
            v-model="selectedMemberId"
            class="member-select"
            autocomplete="off"
          >
            <option v-for="m in store.activeMembers" :key="m.id" :value="m.id">
              {{ m.name }}
            </option>
          </select>
        </div>

        <BadgeGrid v-if="selectedMemberId" :member-id="selectedMemberId" />
      </template>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useAppStore } from '../stores/app.js'
import { buildLeaderboard } from '../utils/stats.js'
import RankCard from '../components/RankCard.vue'
import BadgeGrid from '../components/BadgeGrid.vue'

const store = useAppStore()

const leaderboard = computed(() =>
  buildLeaderboard(store.members, store.sessions)
)

const selectedMemberId = ref(null)
watch(() => store.activeMembers, (members) => {
  if (!selectedMemberId.value && members.length) {
    selectedMemberId.value = members[0].id
  }
}, { immediate: true })
</script>

<style scoped>
.view { min-height: 100dvh; display: flex; flex-direction: column; }
.hero--sec-variant { background: var(--secondary-variant); }

.status-bar { height: 44px; }
.hero__content { padding: 4px 22px 30px; color: var(--on-primary); }
.hero__eyebrow {
  font-size: 11px; font-weight: 600; text-transform: uppercase;
  letter-spacing: 1.2px; opacity: 0.75; margin-bottom: 6px;
}
.hero__title {
  font-size: 28px; font-weight: 800;
  letter-spacing: -0.6px; line-height: 1.15; margin-bottom: 6px;
  text-wrap: balance;
}
.hero__meta { font-size: 13px; opacity: 0.8; }

.sheet {
  flex: 1;
  background: var(--background);
  border-radius: 24px 24px 0 0;
  padding: 20px 16px calc(80px + env(safe-area-inset-bottom, 0px));
  margin-top: -20px;
}

.rank-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 4px; }

.member-selector { margin-top: 20px; }
.section-heading {
  display: block;
  font-size: 12px; font-weight: 700; color: var(--text-secondary);
  text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 8px;
}
.member-select {
  width: 100%;
  background: var(--surface);
  border: 1.5px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 12px 14px;
  font-size: 15px;
  color: var(--text-primary);
  touch-action: manipulation;
  outline: none;
  color-scheme: light;
}
.member-select:focus-visible {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(98, 0, 238, 0.15);
}

.empty-state {
  text-align: center; padding: 48px 16px;
}
.empty-state__icon  { font-size: 48px; margin-bottom: 12px; }
.empty-state__title { font-size: 16px; font-weight: 600; }
</style>
```

- [ ] **Step 4: Commit**

```bash
git add src/components/RankCard.vue src/components/BadgeGrid.vue src/views/StatsView.vue
git commit -m "feat: add StatsView, RankCard, and BadgeGrid components"
```

---

## Task 10: AdminView + MemberCheckItem

**Files:**
- Create: `src/components/MemberCheckItem.vue`
- Create: `src/views/AdminView.vue`

- [ ] **Step 1: 建立 MemberCheckItem.vue**

```vue
<!-- src/components/MemberCheckItem.vue -->
<template>
  <div class="item" :class="{ 'item--guest': isGuest }">
    <label :for="`check-${uid}`" class="item__label">
      <input
        :id="`check-${uid}`"
        type="checkbox"
        :name="`member-${uid}`"
        :checked="checked"
        autocomplete="off"
        class="item__checkbox"
        @change="$emit('update:checked', $event.target.checked)"
      >
      <span class="item__name" :class="{ 'item__name--guest': isGuest }">
        {{ name }}
      </span>
      <span v-if="meta" class="item__meta">{{ meta }}</span>
    </label>
  </div>
</template>

<script setup>
defineProps({
  uid:     { type: String,  required: true },
  name:    { type: String,  required: true },
  checked: { type: Boolean, default: false },
  meta:    { type: String,  default: '' },
  isGuest: { type: Boolean, default: false },
})

defineEmits(['update:checked'])
</script>

<style scoped>
.item {
  background: var(--surface);
  border-radius: var(--radius-md);
  margin-bottom: 8px;
  border: 1px solid var(--border);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}
.item--guest {
  background: #fff8f8;
  border-color: rgba(176, 0, 32, 0.15);
}
.item__label {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  cursor: pointer;
  touch-action: manipulation;
}
.item__label:focus-within {
  outline: 2px solid var(--primary);
  outline-offset: -2px;
  border-radius: var(--radius-md);
}
@media (hover: hover) {
  .item__label:hover { background: var(--surface-tinted); }
}
.item__checkbox {
  width: 22px; height: 22px;
  border-radius: 50%;
  accent-color: var(--primary);
  cursor: pointer;
  flex-shrink: 0;
}
.item__name         { font-size: 15px; font-weight: 600; color: var(--text-primary); flex: 1; }
.item__name--guest  { color: var(--error); }
.item__meta         { font-size: 11px; color: var(--text-tertiary); flex-shrink: 0; }
</style>
```

- [ ] **Step 2: 建立 AdminView.vue**

```vue
<!-- src/views/AdminView.vue -->
<template>
  <div class="view">
    <!-- 未授權 -->
    <div v-if="!store.isAdmin" class="unauthorized">
      <p class="unauthorized__icon">🔒</p>
      <p class="unauthorized__title">需要管理員權限</p>
      <p class="unauthorized__sub">請使用含有 token 的管理員連結</p>
    </div>

    <!-- 管理畫面 -->
    <template v-else>
      <header class="hero hero--secondary">
        <div class="status-bar" aria-hidden="true"></div>
        <div class="hero__content">
          <p class="hero__eyebrow">管理模式</p>
          <h1 class="hero__title">編輯本週名單</h1>
          <p class="hero__meta">{{ sessionDateLabel }}</p>
        </div>
      </header>

      <main class="sheet">
        <form @submit.prevent="handleSave">
          <!-- 固定成員 -->
          <fieldset class="fieldset">
            <legend class="section-heading">固定成員</legend>
            <MemberCheckItem
              v-for="m in store.activeMembers"
              :key="m.id"
              :uid="m.id"
              :name="m.name"
              :checked="checkedIds.has(m.id)"
              :meta="streakLabel(m.id)"
              @update:checked="toggleMember(m.id, $event)"
            />
          </fieldset>

          <!-- 訪客 -->
          <fieldset class="fieldset" style="margin-top: 12px;">
            <legend class="section-heading">臨時成員</legend>
            <MemberCheckItem
              v-for="g in guests"
              :key="g.guest_key"
              :uid="g.guest_key"
              :name="g.name"
              :checked="true"
              :meta="'臨時'"
              :is-guest="true"
              @update:checked="removeGuest(g.guest_key)"
            />

            <div class="input-row">
              <label for="guest-input" class="sr-only">新增訪客姓名</label>
              <input
                id="guest-input"
                v-model="guestInput"
                class="guest-field"
                type="text"
                name="guest-name"
                placeholder="輸入訪客姓名…"
                autocomplete="off"
                spellcheck="false"
                inputmode="text"
                @keydown.enter.prevent="addGuest"
              >
              <button
                type="button"
                class="add-btn"
                aria-label="新增訪客"
                :disabled="!guestInput.trim()"
                @click="addGuest"
              >
                + 新增
              </button>
            </div>
          </fieldset>

          <button
            type="submit"
            class="save-btn"
            :disabled="saving"
            aria-label="儲存並發布本週名單"
          >
            {{ saving ? '儲存中…' : '儲存並發布 ✓' }}
          </button>

          <p v-if="saveError" class="error-msg" role="alert">{{ saveError }}</p>
          <p v-if="saveSuccess" class="success-msg" role="status">已成功發布！</p>
        </form>
      </main>
    </template>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useAppStore } from '../stores/app.js'
import { getCurrentStreak } from '../utils/stats.js'
import { api } from '../services/api.js'
import MemberCheckItem from '../components/MemberCheckItem.vue'

const store = useAppStore()

// 本週日期（下一個或本週 config.day_of_week）
const sessionDate = computed(() => {
  const today = new Date()
  // 找最近的場次日期，或使用今天
  const existing = store.sessions.find(s => s.date >= today.toISOString().slice(0, 10))
  return existing?.date ?? today.toISOString().slice(0, 10)
})

const sessionDateLabel = computed(() => {
  const d = new Date(sessionDate.value + 'T00:00:00')
  return new Intl.DateTimeFormat('zh-TW', {
    year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short',
  }).format(d)
})

// 預填本週已存在的出席名單
const checkedIds = ref(new Set(
  store.sessions
    .find(s => s.date >= new Date().toISOString().slice(0, 10))
    ?.attendances.filter(a => a.type === 'member').map(a => a.member_id) ?? []
))

const guests = ref(
  store.sessions
    .find(s => s.date >= new Date().toISOString().slice(0, 10))
    ?.attendances.filter(a => a.type === 'guest').map(a => ({
      name: a.name, guest_key: a.guest_key,
    })) ?? []
)

const guestInput = ref('')
const saving     = ref(false)
const saveError  = ref('')
const saveSuccess = ref(false)

function toggleMember(id, checked) {
  if (checked) checkedIds.value.add(id)
  else checkedIds.value.delete(id)
}

function addGuest() {
  const name = guestInput.value.trim()
  if (!name) return
  const guest_key = `${name.toLowerCase().replace(/\s+/g, '_')}_${new Date().getFullYear()}`
  if (!guests.value.find(g => g.guest_key === guest_key)) {
    guests.value.push({ name, guest_key })
  }
  guestInput.value = ''
}

function removeGuest(key) {
  guests.value = guests.value.filter(g => g.guest_key !== key)
}

function streakLabel(memberId) {
  const streak = getCurrentStreak(memberId, store.sessions)
  return streak > 1 ? `連 ${streak} 週` : ''
}

async function handleSave() {
  saving.value    = true
  saveError.value = ''
  saveSuccess.value = false
  try {
    const attendances = [
      ...store.activeMembers
        .filter(m => checkedIds.value.has(m.id))
        .map(m => ({ member_id: m.id, name: m.name, type: 'member', guest_key: null })),
      ...guests.value.map(g => ({
        member_id: null, name: g.name, type: 'guest', guest_key: g.guest_key,
      })),
    ]
    await api.saveSession(
      import.meta.env.VITE_ADMIN_TOKEN,
      sessionDate.value,
      attendances
    )
    await store.init() // 重新載入資料
    saveSuccess.value = true
  } catch (err) {
    saveError.value = `儲存失敗：${err.message}`
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.view { min-height: 100dvh; display: flex; flex-direction: column; }

.unauthorized {
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  min-height: 100dvh; text-align: center; padding: 32px;
}
.unauthorized__icon  { font-size: 64px; margin-bottom: 16px; }
.unauthorized__title { font-size: 20px; font-weight: 700; margin-bottom: 8px; }
.unauthorized__sub   { font-size: 14px; color: var(--text-tertiary); }

.hero--secondary { background: var(--secondary); }
.status-bar { height: 44px; }
.hero__content { padding: 4px 22px 30px; color: var(--on-secondary); }
.hero__eyebrow {
  font-size: 11px; font-weight: 600; text-transform: uppercase;
  letter-spacing: 1.2px; opacity: 0.6; margin-bottom: 6px;
}
.hero__title {
  font-size: 28px; font-weight: 800;
  letter-spacing: -0.6px; line-height: 1.15; margin-bottom: 6px;
  text-wrap: balance; color: var(--on-secondary);
}
.hero__meta { font-size: 13px; opacity: 0.7; color: var(--on-secondary); }

.sheet {
  flex: 1;
  background: var(--background);
  border-radius: 24px 24px 0 0;
  padding: 20px 16px calc(32px + env(safe-area-inset-bottom, 0px));
  margin-top: -20px;
}

.fieldset { border: none; padding: 0; margin: 0; }
.section-heading {
  display: block;
  font-size: 12px; font-weight: 700; color: var(--text-secondary);
  text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 8px;
}

.input-row { display: flex; gap: 8px; margin: 10px 0 0; }
.sr-only {
  position: absolute; width: 1px; height: 1px;
  overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap;
}
.guest-field {
  flex: 1; background: var(--surface);
  border: 1.5px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 12px 14px; font-size: 15px; color: var(--text-primary);
  touch-action: manipulation; outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.guest-field:focus-visible {
  border-color: var(--secondary-variant);
  box-shadow: 0 0 0 3px rgba(1, 135, 134, 0.2);
}
.guest-field::placeholder { color: var(--text-tertiary); }
.add-btn {
  background: var(--secondary); color: var(--on-secondary);
  border: none; border-radius: var(--radius-sm);
  padding: 12px 16px; font-size: 14px; font-weight: 700;
  cursor: pointer; touch-action: manipulation; outline: none;
  transition: opacity 0.15s ease, transform 0.1s ease;
}
.add-btn:focus-visible { box-shadow: 0 0 0 3px rgba(3, 218, 198, 0.4); }
.add-btn:disabled { opacity: 0.4; cursor: default; }
@media (hover: hover) { .add-btn:hover:not(:disabled) { opacity: 0.85; } }
.add-btn:active:not(:disabled) { transform: scale(0.96); }

.save-btn {
  display: block; width: 100%;
  background: var(--primary); color: var(--on-primary);
  border: none; border-radius: var(--radius-lg);
  padding: 16px; font-size: 16px; font-weight: 700;
  cursor: pointer; touch-action: manipulation; outline: none;
  box-shadow: 0 4px 18px rgba(98, 0, 238, 0.3);
  margin-top: 20px;
  transition: opacity 0.15s ease, transform 0.1s ease;
}
.save-btn:focus-visible { box-shadow: 0 0 0 3px rgba(98, 0, 238, 0.35); }
.save-btn:disabled { opacity: 0.6; cursor: default; }
@media (hover: hover) { .save-btn:hover:not(:disabled) { opacity: 0.9; } }
.save-btn:active:not(:disabled) { transform: scale(0.98); }

.error-msg   { color: var(--error);      font-size: 13px; margin-top: 12px; text-align: center; }
.success-msg { color: var(--secondary-variant); font-size: 13px; margin-top: 12px; text-align: center; font-weight: 600; }
</style>
```

- [ ] **Step 3: 執行全部測試**

```bash
npm test
```

Expected: PASS — all tests pass

- [ ] **Step 4: 確認四個畫面都能正常顯示**

```bash
npm run dev
```

- `/` → WeekView（紫色 hero）
- `/history` → HistoryView（深紫 hero）
- `/stats` → StatsView（深青 hero）
- `/admin?token=test` → AdminView（淺青 hero，若 `VITE_ADMIN_TOKEN=test`）

- [ ] **Step 5: Commit**

```bash
git add src/components/MemberCheckItem.vue src/views/AdminView.vue
git commit -m "feat: add AdminView and MemberCheckItem component"
```

---

## Task 11: Google Apps Script

**Files:**
- Create: `gas/Code.gs`

> GAS 無法用 Vitest 測試，改用手動測試流程記錄在步驟中。

- [ ] **Step 1: 建立 gas/Code.gs**

```javascript
// gas/Code.gs
// 部署方式：GAS 編輯器 → 部署 → 新增部署 → 網路應用程式
//   執行身份：我（你的 Google 帳號）
//   存取權：任何人（包括匿名使用者）
// 注意：每次修改後需重新部署才會生效

function doGet(e) {
  const action = e.parameter.action
  const ss = SpreadsheetApp.getActiveSpreadsheet()
  try {
    let data
    if      (action === 'getConfig')   data = _getConfig(ss, false)
    else if (action === 'getMembers')  data = _getMembers(ss)
    else if (action === 'getSessions') data = _getSessions(ss)
    else return _json({ status: 'error', message: 'Unknown action: ' + action })
    return _json({ status: 'ok', data })
  } catch (err) {
    return _json({ status: 'error', message: err.message })
  }
}

function doPost(e) {
  const body   = JSON.parse(e.postData.contents)
  const action = e.parameter.action
  const ss     = SpreadsheetApp.getActiveSpreadsheet()
  const config = _getConfig(ss, true)
  if (body.admin_token !== config.admin_token) {
    return _json({ status: 'error', message: 'Unauthorized' })
  }
  try {
    let data
    if      (action === 'saveSession')  data = _saveSession(ss, body)
    else if (action === 'saveMember')   data = _saveMember(ss, body)
    else if (action === 'promoteGuest') data = _promoteGuest(ss, body)
    else return _json({ status: 'error', message: 'Unknown action: ' + action })
    return _json({ status: 'ok', data })
  } catch (err) {
    return _json({ status: 'error', message: err.message })
  }
}

function _json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON)
}

function _getConfig(ss, includeToken) {
  const rows   = ss.getSheetByName('config').getDataRange().getValues()
  const config = {}
  rows.forEach(function(row) { if (row[0]) config[row[0]] = row[1] })
  if (!includeToken) delete config.admin_token
  return config
}

function _getMembers(ss) {
  const rows = ss.getSheetByName('members').getDataRange().getValues()
  return rows.slice(1).map(function(r) {
    return { id: r[0], name: r[1], active: r[2] === true || r[2] === 'TRUE', created_at: String(r[3] || '') }
  })
}

function _getSessions(ss) {
  const sessionRows = ss.getSheetByName('sessions').getDataRange().getValues().slice(1)
  const attRows     = ss.getSheetByName('attendances').getDataRange().getValues().slice(1)

  var sessionMap = {}
  var sessions = sessionRows.map(function(r) {
    var date = r[1] instanceof Date
      ? Utilities.formatDate(r[1], 'Asia/Taipei', 'yyyy-MM-dd')
      : String(r[1])
    var s = { session_id: r[0], date: date, created_at: String(r[2] || ''), note: r[3] || '', attendances: [] }
    sessionMap[r[0]] = s
    return s
  })

  attRows.forEach(function(r) {
    if (sessionMap[r[1]]) {
      sessionMap[r[1]].attendances.push({
        id: r[0], session_id: r[1], member_id: r[2] || null,
        name: r[3], type: r[4], guest_key: r[5] || null, created_at: String(r[6] || '')
      })
    }
  })

  return sessions.sort(function(a, b) { return b.date.localeCompare(a.date) })
}

function _saveSession(ss, body) {
  var date         = body.date
  var attendances  = body.attendances
  var sessSheet    = ss.getSheetByName('sessions')
  var attSheet     = ss.getSheetByName('attendances')

  // 找或建立 session
  var rows      = sessSheet.getDataRange().getValues().slice(1)
  var sessionId = null
  rows.forEach(function(r) {
    var d = r[1] instanceof Date
      ? Utilities.formatDate(r[1], 'Asia/Taipei', 'yyyy-MM-dd')
      : String(r[1])
    if (d === date) sessionId = r[0]
  })
  if (!sessionId) {
    sessionId = 's' + Date.now()
    sessSheet.appendRow([sessionId, date, new Date().toISOString(), ''])
  }

  // 刪除此場次舊出席記錄
  var attData     = attSheet.getDataRange().getValues()
  var toDelete    = []
  for (var i = 1; i < attData.length; i++) {
    if (attData[i][1] === sessionId) toDelete.push(i + 1)
  }
  toDelete.reverse().forEach(function(row) { attSheet.deleteRow(row) })

  // 新增出席記錄
  var now = new Date().toISOString()
  attendances.forEach(function(att) {
    attSheet.appendRow([
      'a' + Date.now() + Math.random().toString(36).slice(2, 5),
      sessionId,
      att.member_id || '',
      att.name,
      att.type,
      att.guest_key || '',
      now
    ])
  })
  return { session_id: sessionId }
}

function _saveMember(ss, body) {
  var sheet = ss.getSheetByName('members')
  var data  = sheet.getDataRange().getValues()

  if (body.id) {
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === body.id) {
        if (body.name   !== undefined) sheet.getRange(i + 1, 2).setValue(body.name)
        if (body.active !== undefined) sheet.getRange(i + 1, 3).setValue(body.active)
        return { id: body.id }
      }
    }
  }

  var newId = 'm' + Date.now()
  sheet.appendRow([newId, body.name, true, new Date().toISOString()])
  return { id: newId }
}

function _promoteGuest(ss, body) {
  var sheet   = ss.getSheetByName('attendances')
  var data    = sheet.getDataRange().getValues()
  var updated = 0
  for (var i = 1; i < data.length; i++) {
    if (data[i][5] === body.guest_key && data[i][4] === 'guest') {
      sheet.getRange(i + 1, 3).setValue(body.member_id)
      sheet.getRange(i + 1, 5).setValue('member')
      updated++
    }
  }
  return { updated: updated }
}
```

- [ ] **Step 2: 建立 Google Sheets 結構**

在 Google Sheets 建立新試算表，命名為「羽球出席系統」，建立 4 個分頁並填入標題列：

**`config` 分頁**（無標題列，直接填 key-value）：
```
venue_name    大安體育場 第 3 場
day_of_week   六
time_start    09:00
time_end      11:00
admin_token   your-secret-token
```

**`members` 分頁** — 第一列：`id | name | active | created_at`

**`sessions` 分頁** — 第一列：`session_id | date | created_at | note`

**`attendances` 分頁** — 第一列：`id | session_id | member_id | name | type | guest_key | created_at`

- [ ] **Step 3: 部署 GAS**

1. 在 Google Sheets 開啟「擴充功能 → Apps Script」
2. 刪除預設內容，貼入 `gas/Code.gs` 全部內容
3. 點「部署 → 新增部署」
4. 類型選「網路應用程式」
5. 執行身份：「我」；存取權：「任何人（包括匿名使用者）」
6. 複製部署的 Web App URL → 存到 `.env` 的 `VITE_GAS_URL`

- [ ] **Step 4: 手動測試 GET endpoints**

在瀏覽器開啟：
```
{VITE_GAS_URL}?action=getConfig
{VITE_GAS_URL}?action=getMembers
{VITE_GAS_URL}?action=getSessions
```

Expected：每個都回傳 `{"status":"ok","data":{...}}`

- [ ] **Step 5: Commit gas/ 目錄**

```bash
git add gas/Code.gs
git commit -m "feat: add Google Apps Script API with 6 endpoints"
```

---

## Task 12: Vercel 部署

**Files:**
- Already created: `vercel.json`

- [ ] **Step 1: 建立 .env 檔案（本機）**

```bash
cp .env.example .env
```

編輯 `.env`，填入 GAS URL 和 admin token：
```
VITE_GAS_URL=https://script.google.com/macros/s/YOUR_ACTUAL_ID/exec
VITE_ADMIN_TOKEN=your-secret-token
```

- [ ] **Step 2: 確認本機 build 成功**

```bash
npm run build
```

Expected: `dist/` 目錄建立成功，無錯誤。

- [ ] **Step 3: Push 到 GitHub**

```bash
git add -A
git commit -m "chore: final pre-deployment cleanup"
git push origin release
```

- [ ] **Step 4: Vercel 設定**

1. 前往 vercel.com，匯入 GitHub repo
2. Framework Preset 選 **Vite**
3. 在 **Environment Variables** 新增：
   - `VITE_GAS_URL` = 你的 GAS Web App URL
   - `VITE_ADMIN_TOKEN` = 你的 secret token
4. 點 Deploy

- [ ] **Step 5: 驗收測試**

部署完成後，在手機瀏覽器開啟 Vercel URL：

| 測試項目 | 預期結果 |
|----------|----------|
| `/` | 顯示本週出席畫面（或 empty state） |
| `/history` | 顯示歷史記錄列表 |
| `/stats` | 顯示排行榜 + 徽章選擇 |
| `/admin?token=your-secret-token` | 顯示管理員編輯畫面 |
| `/admin?token=wrong` | 顯示「需要管理員權限」 |
| 管理員儲存名單 | 畫面更新 + Sheets 資料寫入 |

- [ ] **Step 6: 最終 Commit**

```bash
git add -A
git commit -m "chore: add deployment documentation and final config"
git push origin release
```

---

## 完成標準

- [ ] `npm test` 全部通過（stats、badges、api、store）
- [ ] `npm run build` 無錯誤
- [ ] 四個畫面手機瀏覽器正常顯示
- [ ] 管理員可儲存名單並即時反映在 `/` 頁面
- [ ] 歷史記錄 + 排行榜 + 徽章計算正確
- [ ] Vercel 部署成功，GitHub push 自動觸發重新部署
