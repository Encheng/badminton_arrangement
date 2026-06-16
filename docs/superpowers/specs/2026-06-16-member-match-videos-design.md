# 成員個人比賽影片牆 — 設計文件

日期：2026-06-16
範圍：在成員個人檔案（`MemberBadgeSheet`）中，新增一塊「比賽影片」，彙整該成員出現過的所有比賽錄影，點擊以現有播放器觀看。

---

## 背景

球團每週上傳比賽錄影到自有 YouTube 頻道，影片標題格式固定：

```
YYYYMMDD <球員名單> <局號>
範例：20260516 千惠 二馬 阿芝 Timo Ruby Fang Peter Sandy 3
```

目前影片只能從「場次」進入（`SessionsView` / `HistoryView` / `WeekView` 上的「N 支影片」按鈕，開啟 `VideoListModal` 播放該場次的影片）。使用者無法以「人」為單位回顧自己跨場次的所有比賽。

App 沒有個人登入概念，但已有「點任一成員 → 看其個人檔案」的模式：排行榜（`StatsView`）點成員會開啟 `MemberBadgeSheet`，內含出席熱力圖與成就徽章。本功能把「個人比賽影片」加進這個既有的個人檔案視角。

**關鍵前提（已與需求方確認）：** 影片標題中的球員名與成員清單的 `member.name` 完全一致，且每個名字都是不含空格的單一 token。因此「標題以空格切開 → 精準比對 `member.name`」即可可靠地把影片對應到成員。

## 目標與非目標

**目標：**
- 在 `MemberBadgeSheet` 中，於成就徽章下方顯示「比賽影片 (N)」區塊，列出該成員出現過的所有影片（依場次日期新到舊）
- 點擊任一影片，以現有 `VideoListModal` 播放器觀看，清單即為該成員的所有比賽影片
- 沿用現有播放器的所有能力（嵌入播放、上/下一支、滑動關閉、觀看時間追蹤、GA4 事件）

**非目標：**
- 不做個人登入 / 「設定我是誰」（本期維持「點任一成員看其檔案」模式）
- 不改動既有「從場次進入影片」的流程與外觀
- 不做影片管理 / 編輯（影片資料仍由 YouTube 頻道單向同步）
- 不做 AI 影片分析（另案評估）

## 整體架構

沿用現有資料流，不新增後端。影片資料已存在於 store（由 GAS 從 YouTube RSS 同步）。本功能純前端：把既有影片清單依「成員名是否出現在標題」過濾，餵給泛化後的播放器。

```
[store.videos]（已存在）
      │
      ├─ parseVideoPlayers(title)  ← 抽出共用 util（切名字）
      │
      └─ videosByMember(memberName)（新 getter，依日期新到舊）
                  ↓
        MemberBadgeSheet「比賽影片」區塊（縮圖列）
                  ↓ 點擊
        VideoListModal（泛化：可吃任意影片清單 + 標題）
```

## 元件與資料

### 1. `parseVideoPlayers(title)` — 共用 util（`src/utils/`）

把目前內聯/重複的「從標題切球員名」邏輯抽成單一函式。

- 輸入：影片標題字串
- 輸出：球員名陣列，例如 `['千惠','二馬','阿芝','Timo','Ruby','Fang','Peter','Sandy']`
- 規則：去掉開頭 `YYYYMMDD ` 與結尾 ` <局號>`，其餘以空白切開
- 標題格式不合規（切不出名字）→ 回傳空陣列，呼叫端略過該影片

現有顯示球員名的地方（如 `VideoListModal` 清單）改為呼叫此 util，消除重複。

### 2. `videosByMember(memberName)` — store getter（`src/stores/app.js`）

- 對 `store.videos` 逐支以 `parseVideoPlayers(title)` 取出名單
- 以**整個 token 精準比對**（非子字串 `includes`），判斷 `memberName` 是否在名單中
- 命中者收集，依 `session_date` 由新到舊排序後回傳
- 找不到任何影片 → 回傳空陣列

精準比對可避免「`Fang` 誤中含 fang 的較長字串」這類問題。

### 3. `VideoListModal` 泛化（`src/components/VideoListModal.vue`）

目前以「場次」為中心（`sessionDate` 用於標題日期 label 與 GA4 參數）。泛化為可吃任意清單：

- 新增可選 prop `heading`（字串）：有值時，標題列顯示它（成員模式傳成員名，如「千惠 的比賽」）；沒值時維持現有以 `sessionDate` 算出的日期 label，既有呼叫端不受影響
- 新增可選 prop `source`（字串，預設 `'session'`）：寫進 GA4 事件參數，用以區分進入來源（成員檔案傳 `'member_sheet'`）
- 清單列每項顯示「場次日期 + 第 N 局」：場次模式同一天日期重複可省略；**成員模式跨多場次，需顯示各影片的場次日期**以利辨識
- 既有三個呼叫端（`SessionsView` / `HistoryView` / `WeekView`）的行為與外觀不變

### 4. `MemberBadgeSheet` 整合（`src/components/MemberBadgeSheet.vue`）

- 在 `modal__body` 中、`BadgeGrid` 之下，新增「比賽影片」區塊
- 透過 `videosByMember(memberName)` 取得清單；數量為 0 時整塊不顯示（與「沒影片就不顯示按鈕」一致）
- 區塊形式：標題「比賽影片 (N)」+ 橫向可捲動縮圖列（縮圖沿用 YouTube CDN `mqdefault.jpg`，與既有清單一致）
- 點擊任一縮圖 → 開啟 `VideoListModal`，傳入該成員影片清單、`heading=成員名`、`source='member_sheet'`，並以被點擊的影片為起始

## 邊界情況

- **成員無任何影片**：不顯示「比賽影片」區塊
- **標題格式不合規**：`parseVideoPlayers` 回空陣列，該影片在比對中被略過，不報錯
- **名字為另一名字的子字串**：採整 token 精準比對，不會誤中
- **同一成員在同一場多局**：全部列出，依日期新到舊；同日內維持既有（局號）順序

## 測試

- `parseVideoPlayers`：正常標題、缺局號、多重空白、非法格式（回空陣列）
- `videosByMember`：精準命中、不誤中子字串、無影片回空陣列、跨場次排序正確
- `VideoListModal` 泛化：傳 `heading` 時顯示自訂標題、不傳時維持日期 label（確保既有呼叫端不回歸）

## 分析（GA4）

沿用現有影片相關事件，透過新增的 `source` 參數區分來源（`'session'` vs `'member_sheet'`），日後可分析「從個人檔案進入觀看」的占比與行為。
