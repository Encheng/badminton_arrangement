# 頭像長按顯示成員資訊彈窗 — 設計文件

日期：2026-06-12

## 背景與目標

首頁（WeekView）出席成員頭像目前點擊後會 3D 翻牌，背面顯示隨機可愛動物（`AttendeeChip.vue` + `CuteAnimal.vue`）。此互動純屬視覺彩蛋，與成員本人無關聯，缺乏實質意義。

本設計在**保留翻牌趣味**的前提下，新增第二段互動：**長按頭像開啟該成員的資訊彈窗**，讓點擊頭像產生實用價值。

## 互動設計

### 點擊（維持現狀）
- 第一次點擊：翻牌顯示隨機動物
- 再次點擊：翻回正面
- 動物維持每次隨機，不固定

### 長按（新增）
- 長按頭像 **500ms** 開啟「成員資訊彈窗」
- 長按觸發時給輕微震動回饋：`navigator.vibrate(10)`（不支援的裝置靜默略過）
- 長按計時期間若指標移動超過 **10px** 則取消（避免捲動誤觸）
- 長按成功觸發後，**不**觸發點擊翻牌（需阻斷後續 click）
- 頭像卡片加上 `-webkit-touch-callout: none` 與 `user-select: none`，防止 iOS 長按跳出系統選單／文字選取

### 已知取捨
長按為隱性互動，新使用者不一定會發現。此為保留翻牌行為下的取捨，後續可依 GA 數據決定是否加入提示。

## 彈窗內容（新元件 `AttendeeInfoSheet.vue`）

底部 sheet 樣式，仿照既有 `MemberBadgeSheet.vue` 模式（`Teleport to="body"` + `AnimatePresence` + 拖曳下滑關閉 + 背景點擊關閉）。

由上而下：

1. **標題**：成員姓名
2. **上次參加日期**：在目前顯示場次日期**之前**、出席名單含此人的最近一場。格式沿用專案慣例 `Intl.DateTimeFormat('zh-TW')`，如「上次參加：5/29（四）」
3. **距今天數**：「距離上次參加已 N 天」，以**今天**為基準計算
4. **影片入口**（條件顯示）：若上次參加場次有 YT 影片，顯示按鈕「觀看 5/29 場次影片（N 支）」
   - 點擊後：**先關閉**資訊彈窗，**再開啟**現有 `VideoListModal`（傳入該場次的 videos 與 sessionDate），避免雙層 modal 疊加
5. **查無過往紀錄**：顯示「查不到歷史資料，多多來打球」，不顯示上次日期、天數與影片區塊

文案不使用 emoji。

## 資料邏輯

### 新增 utils 函數

```js
// src/utils/stats.js
getLastAttendance(sessions, name, beforeDate)
```

- 回傳：該成員在 `beforeDate` 之前（`date < beforeDate`）、`attendances` 含其 name 的**最近**一場 session；查無則回傳 `null`
- 比對鍵：成員 `name`（固定成員與臨時成員皆適用，假設同名即同人，與現有排行榜邏輯一致）

### 影片查詢
- 使用 store 既有的 `videosByDate` computed：`videosByDate[lastSession.date]`
- 純前端計算，**不需更動後端（GAS）**

## 元件變更

| 檔案 | 變更 |
|------|------|
| `src/components/AttendeeChip.vue` | 新增長按偵測（pointerdown/pointermove/pointerup + timer）；emit `longpress` 事件；CSS 防系統選單 |
| `src/components/AttendeeInfoSheet.vue` | **新增**：成員資訊底部彈窗 |
| `src/views/WeekView.vue` | 持有彈窗狀態（選中成員、show）；計算上次參加與影片資料；串接 `AttendeeInfoSheet` 與 `VideoListModal` |
| `src/utils/stats.js` | 新增 `getLastAttendance` |
| `src/utils/analytics.js` | 新增通用 `trackEvent(eventName, params)`（或將現有 `trackVideoEvent` 泛化），供本功能埋點使用 |

## GA 埋點

沿用 `analytics.js` 既有模式（`window.gtag('event', ...)`）：

- `attendee_sheet_opened`：參數 `daysSince`（數字；查無紀錄給 `null` 或不帶）、`hasVideo`（boolean）、`hasHistory`（boolean）。**不帶成員姓名**等個資。
- `attendee_sheet_video_click`：參數 `sessionDate`、`videoCount`

## 測試策略

- **單元測試（Vitest）**：`getLastAttendance`
  - 一般情況：多場歷史紀錄取最近一場
  - 查無紀錄：回傳 `null`
  - 只有未來場次：回傳 `null`
  - 同日邊界：`date === beforeDate` 不算（嚴格小於）
  - 名單中無此人：回傳 `null`
- **手動驗證**：長按觸發/取消、翻牌不受影響、彈窗開關、影片連動開啟 `VideoListModal`、iOS 不跳系統選單

## 不做的事（YAGNI）

- 不改後端
- 不做完整個人頁／成就徽章整合（已有 `/stats` 承載）
- 不改動物隨機邏輯
- 不在頭像上加長按提示 UI（先觀察 GA 數據）
