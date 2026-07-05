# 公告功能 設計文件

- 日期：2026-07-05
- 狀態：已核可，待寫實作計畫

## 目標與範圍

在羽球排點 App 加入「公告」功能，讓管理員發布**臨時通知**（如本週停打、場地變更）與**活動宣傳**（如報名比賽、聚餐），成員一進 App 就能在首頁看到。

### 使用情境
- 臨時通知：短期、看完就過期的訊息。
- 活動宣傳：常帶行動呼籲或連結。

### 呈現方式
- 首頁（WeekView，`/`）以**橫幅**呈現，只顯示最新一則。
- 橫幅帶**未讀小紅點**，點開後展開列出所有有效公告。

### 管理方式
- App 內 admin 介面，完整 CRUD（新增／編輯／刪除），沿用現有 `admin_token` 與樂觀更新機制。

## 資料模型

Google Sheet 新增 `announcements` 分頁，欄位順序：

| 欄位 | 型別 | 說明 |
|---|---|---|
| `id` | string | `an` + timestamp |
| `title` | string | 標題（必填） |
| `body` | string | 內文（可空） |
| `link_url` | string | 行動連結網址（可空） |
| `link_label` | string | 按鈕文字（可空，前端預設顯示「查看」） |
| `pinned` | boolean | 釘選／重要標記 |
| `expires_at` | string | 到期日 `YYYY-MM-DD`（可空＝永不過期） |
| `created_at` | string | ISO timestamp |

### 有效公告判定
- `expires_at` 為空，**或** `expires_at >= 今天`（當天仍算有效）。
- 過期公告**保留在表裡不刪除**（保留歷史），僅前端過濾不顯示給一般成員；admin 管理介面仍可看到（過期項標灰）。

### 排序
- pinned 優先 → 再依 `created_at` 新到舊。
- 「最新一則」＝排序後第一筆。

## 後端（GAS `gas/Code.gs`）

沿用現有 doGet／doPost 分派模式。

### 讀取（doGet）
- `getAnnouncements`：回傳**全部**公告（含過期）。過期過濾交由前端處理，讓 admin 管理介面也能看到過期項。
- `_getAnnouncements(ss)`：讀 `announcements` sheet，`pinned` 正規化為 boolean，`expires_at` 以 `_formatDate` 格式化。

### 寫入（doPost，皆經 `admin_token` 驗證）
- `saveAnnouncement`：有 `id` 則更新，無則新增（沿用 `_saveMember` 的 upsert 寫法）。
- `deleteAnnouncement`：依 `id` 刪列。

### Sheet 建立
- 若 `announcements` sheet 不存在則自動建立（比照 `_createVideosSheet`），首列為欄位標頭。

## 前端 API（`src/services/api.js`）

新增，對齊現有簽名：

```js
getAnnouncements:   ()          => gasGet('getAnnouncements'),
saveAnnouncement:   (token, a)  => gasPost('saveAnnouncement',   { admin_token: token, ...a }),
deleteAnnouncement: (token, id) => gasPost('deleteAnnouncement', { admin_token: token, id }),
```

## 前端 Store（`src/stores/app.js`）

- 新增 `announcements` ref。
- 納入 `_fetchAll`（`Promise.all` 併發）、`_saveCache` / `_loadCache`、快取直出流程。
- computed `activeAnnouncements`：過濾有效公告 + 排序（pinned → `created_at` 新到舊）。
- computed `latestAnnouncement`：`activeAnnouncements[0] ?? null`。
- 樂觀更新 action：
  - `saveAnnouncementOptimistic`
  - `deleteAnnouncementOptimistic`
  - 比照 `saveSessionOptimistic`：含 `_epoch++`、`_pageUnloading` 判斷不回滾、write-through 快取。
  - **不做刪除墓碑**（tombstone）：公告刪除對 read-after-write 詐屍不敏感，簡化實作。

## 未讀小紅點（純前端，以裝置為單位）

App 無個人登入，未讀狀態存 `localStorage`：

- key：`badminton_ann_seen_v1`，值＝已看過的最新公告 `created_at`。
- **有未讀**：`latestAnnouncement.created_at` > 已看過值 → 顯示紅點。
- 使用者**點開展開全部公告**時，寫入目前最新 `created_at`，紅點消失。
- 紅點位置：橫幅右側「N 則」計數旁。

## UI 元件

### `AnnouncementBanner.vue`
放在 WeekView 的 hero 與 sheet 之間。

- **收合態**：一行橫幅，顯示 `latestAnnouncement.title`；釘選則帶圖示／強調色；右側「N 則 ›」＋未讀紅點。
- **展開態**：點橫幅後展開列出所有 `activeAnnouncements`，每則顯示 title / body / 到期資訊 / 行動連結按鈕（`link_url` 存在時才顯示，文字用 `link_label` 或預設「查看」）。
- 無有效公告時整個元件不渲染，不佔版面。
- 動效沿用專案既有的 `motion-v`。

### `AnnouncementAdminSheet.vue`（admin 專用）
沿用現有 sheet 樣式。

- `store.isAdmin` 為真時，於橫幅／展開區顯示「管理公告」入口。
- 列出**全部**公告（含過期，過期標灰），可新增／編輯／刪除。
- 表單欄位：標題、內文、連結網址、按鈕文字、釘選 checkbox、到期日（date input，可留空）。
- 送出走樂觀更新 action。

## 測試（比照現有 `__tests__`）

- `activeAnnouncements` 過濾：過期／未過期邊界（今天當天算有效）、排序（pinned 優先、再新到舊）。
- 樂觀更新：成功流程、失敗回滾。
- 未讀紅點邏輯：新公告出現→有紅點；看過後→消失。

## 非目標（YAGNI）

- 不做分類標籤。
- 不做多則輪播 carousel。
- 不做彈窗強制彈出。
- 公告刪除不做墓碑機制。
- 不做每位成員的個人已讀狀態（僅裝置層級）。
