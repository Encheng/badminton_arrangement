# 羽球出席系統 — 設計文件

**日期**：2026-04-15  
**狀態**：已確認

---

## 概覽

每週固定場次的羽球出席管理系統。管理員負責操作（記錄本週出席名單、管理成員），其他成員透過公開連結唯讀查看。系統含歷史記錄與遊戲化統計（排行榜 + 成就徽章）。

---

## 架構方案

**方案 B：Vue.js 主力 + GAS 資料層**

- Google Apps Script 只負責讀寫 Google Sheets，提供 6 個輕薄 endpoint
- 所有商業邏輯（統計計算、徽章判斷、排序）全在 Vue.js 前端處理
- 靜態前端部署至 Vercel，透過 GitHub 自動 CI/CD

---

## 使用者角色

| 角色 | 權限 | 入口 |
|------|------|------|
| 管理員 | 完整操作（新增場次、管理成員） | `/admin?token=xxx` |
| 一般成員 | 唯讀查看所有頁面 | `/`、`/history`、`/stats` |

- 管理員身份由 URL query param `token` 決定，不需要登入
- Token 儲存於 Vercel Environment Variables，不進入版本控制

---

## 頁面結構（Vue Router）

| 路徑 | 元件 | 說明 |
|------|------|------|
| `/` | `WeekView` | 本週出席（唯讀），顯示場次資訊與出席名單 |
| `/history` | `HistoryView` | 歷史記錄列表，每週一張卡片 |
| `/stats` | `StatsView` | 排行榜 + 個人成就徽章 |
| `/admin?token=xxx` | `AdminView` | 管理員模式，勾選出席名單並儲存發布 |

URL 完整反映頁面狀態，支援直接分享連結。

---

## UI 設計規範

- **框架**：Vue.js 3 + Vite
- **手機優先**：所有畫面以 375px 寬度為基準設計
- **色票**（Material Design）：

| 色票 | 值 | 用途 |
|------|----|------|
| Primary | `#6200EE` | 本週出席、主按鈕、active tab |
| Primary Variant | `#3700B3` | 歷史記錄 Hero |
| Secondary | `#03DAC6` | 管理員 Hero、新增按鈕 |
| Secondary Variant | `#018786` | 統計榮譽 Hero、排行進度條 |
| Error | `#B00020` | 訪客身份標示 |
| Surface / Background | `#FFFFFF` | 內容卡片、頁面底色 |

- **Web Interface Guidelines 規範**：語意 HTML（`<button>`、`<label>`、`<fieldset>`）、`aria-label`、`focus-visible`、`touch-action: manipulation`、`env(safe-area-inset-bottom)`、`font-variant-numeric: tabular-nums`、`prefers-reduced-motion`

---

## Google Sheets 結構

單一試算表，4 個分頁。

### `config`
| key | value |
|-----|-------|
| venue_name | 場地名稱 |
| day_of_week | 星期幾 |
| time_start | 開始時間 |
| time_end | 結束時間 |
| admin_token | 管理員 token |

### `members`
| 欄位 | 型別 | 說明 |
|------|------|------|
| id | string | 唯一識別碼（如 `m1`） |
| name | string | 成員姓名 |
| active | boolean | `FALSE` 為軟刪除，保留歷史記錄 |
| created_at | date | 建立日期 |

成員永不實際刪除，`active = FALSE` 為停用狀態。重新啟用只需改回 `TRUE`，歷史出席記錄完整保留。

### `sessions`
| 欄位 | 型別 | 說明 |
|------|------|------|
| session_id | string | 唯一識別碼（如 `s1`） |
| date | date | 場次日期 |
| created_at | date | 建立日期 |
| note | string | 備註（選填） |

### `attendances`
| 欄位 | 型別 | 說明 |
|------|------|------|
| id | string | 唯一識別碼 |
| session_id | string | 對應場次 |
| member_id | string | 對應成員（訪客為空） |
| name | string | 姓名（所有人都記錄） |
| type | string | `member` 或 `guest` |
| guest_key | string | 訪客識別碼（如 `john_2026`），升級成員時用於批次更新 |
| created_at | date | 建立日期 |

**訪客升級流程**：訪客新增為正式成員後，以 `guest_key` 批次更新歷史出席記錄的 `member_id`，統計排行自動回溯。

---

## GAS API Endpoints

GAS 部署為 Web App，提供 6 個 endpoint，不含商業邏輯。

### GET 請求（公開，無需 token）

| action | 回傳 |
|--------|------|
| `getConfig` | 場地設定（不含 admin_token） |
| `getMembers` | 所有成員（含 inactive） |
| `getSessions` | 所有場次及其出席名單 |

### POST 請求（需帶 `admin_token`）

| action | body | 說明 |
|--------|------|------|
| `saveSession` | `{ date, attendances[] }` | 建立或覆寫本週場次與出席名單 |
| `saveMember` | `{ id?, name, active }` | 新增 / 更新 / 停用成員 |
| `promoteGuest` | `{ guest_key, member_id }` | 批次更新歷史出席，將訪客記錄連結至正式成員 |

### 統一回傳格式

```json
{ "status": "ok", "data": { ... } }
{ "status": "error", "message": "..." }
```

---

## 狀態管理（Pinia）

```
useAppStore
├── config          ← 場地設定（venue、time）
├── members[]       ← 所有成員（含 inactive）
├── sessions[]      ← 所有場次與出席記錄
└── isAdmin         ← 由 URL token 比對決定
```

App 啟動時呼叫三支 GET API 一次載入全部資料，後續操作（統計、篩選、排序）全在前端 `computed` 處理，不重複打 API。

---

## 統計與成就徽章

所有計算皆為純前端 `computed`，基於 `sessions` + `attendances` 資料。

### 排行榜
- 統計每位成員的累計出席次數
- 依次數降冪排序，並排同分

### 成就徽章條件

| 徽章 | 條件 |
|------|------|
| 🔥 連續 5 週 | 最近出席日期連續 5 週無間斷 |
| 💯 出席 10 次 | 累計出席 ≥ 10 次 |
| ⭐ 出席 20 次 | 累計出席 ≥ 20 次 |
| 💎 出席 50 次 | 累計出席 ≥ 50 次 |
| 👑 週冠軍 | 最近一次出席場次中排行第一 |
| 🚀 連續 10 週 | 連續出席 ≥ 10 週無間斷 |
| 🎯 全勤一個月 | 單一月份 4 週全數出席 |
| 🏅 最佳球員 | 當年累計出席次數第一名 |

未解鎖徽章以低透明度顯示，視覺上保留目標感。

---

## 部署

| 項目 | 平台 |
|------|------|
| 前端 | Vercel（連接 GitHub repo，push 自動部署） |
| 資料 | Google Sheets |
| API | Google Apps Script Web App |
| 環境變數 | Vercel Environment Variables（`VITE_GAS_URL`、`VITE_ADMIN_TOKEN`） |

`.env` 檔案不進入版本控制（加入 `.gitignore`）。

---

## 安全考量

- 管理員 token 僅存於 Vercel env var 與 Google Sheets `config` 分頁
- GET API 公開無保護（僅唯讀出席資料，無個資疑慮）
- POST API 驗證 `admin_token`，不符回傳 403
- 無用戶帳號系統，安全性靠 token 不公開維持
