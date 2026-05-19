# 影片事件追蹤設定指南

本系統使用 Google Analytics 4 (GA4) 追蹤影片相關的用戶行為。

## 🎯 追蹤的事件

### 1. `video_button_click` - 點擊「N 支影片」按鈕
**觸發時機：** 用戶在歷史場次卡片或場次卡片上點擊「N 支影片」按鈕

**參數：**
- `session_date` (string) - 場次日期 (YYYY-MM-DD)
- `video_count` (number) - 該場次的影片數量
- `source` (string) - 點擊來源
  - `history_card` - 從歷史記錄卡片點擊
  - `session_card` - 從場次卡片點擊

**分析價值：**
- 了解哪些場次的影片最受關注
- 比較不同入口的點擊率

---

### 2. `video_list_opened` - 影片列表成功展開
**觸發時機：** 影片 modal 成功打開並顯示影片列表

**參數：**
- `session_date` (string) - 場次日期
- `video_count` (number) - 影片數量

**分析價值：**
- 確認影片列表的展開成功率
- 追蹤哪些場次被查看

---

### 3. `video_play_click` - 點擊播放影片
**觸發時機：** 用戶點擊影片縮圖開始播放

**參數：**
- `session_date` (string) - 場次日期
- `video_id` (string) - YouTube 影片 ID
- `match_no` (number) - 局號 (1-13)
- `video_index` (number) - 影片索引 (1-based)
- `total_videos` (number) - 該場次總影片數

**分析價值：**
- 了解用戶最常看第幾局
- 識別熱門影片
- 計算影片點擊率 (播放/列表開啟)

---

### 4. `video_player_navigation` - 使用上/下一局按鈕
**觸發時機：** 用戶點擊「上一局」或「下一局」按鈕

**參數：**
- `direction` (string) - 導航方向
  - `prev` - 上一局
  - `next` - 下一局
- `from_match_no` (number) - 原始局號
- `to_match_no` (number) - 目標局號
- `session_date` (string) - 場次日期

**分析價值：**
- 了解用戶是否連續觀看多局
- 導航按鈕使用率
- 觀看模式分析

---

### 5. `video_player_back` - 返回影片列表
**觸發時機：** 用戶從播放器返回影片列表

**參數：**
- `session_date` (string) - 場次日期
- `match_no` (number) - 剛觀看的局號
- `time_spent_seconds` (number) - 觀看時長（秒）

**分析價值：**
- 平均觀看時長
- 哪些影片被快速跳過

---

### 6. `video_modal_close` - 關閉影片 modal
**觸發時機：** 用戶關閉影片 modal

**參數：**
- `session_date` (string) - 場次日期
- `video_count` (number) - 影片數量
- `was_playing` (boolean) - 關閉時是否在播放狀態
- `match_no` (number|null) - 關閉時的局號（若在播放狀態）
- `view_duration_seconds` (number) - Modal 開啟總時長（秒）

**分析價值：**
- Modal 平均停留時長
- 用戶是看完才關閉，還是中途離開
- 完成率分析

---

## 🚀 設定步驟

### 1. 建立 Google Analytics 4 屬性

1. 前往 [Google Analytics](https://analytics.google.com/)
2. 建立新的 GA4 屬性
3. 記下你的 **Measurement ID** (格式：`G-XXXXXXXXXX`)

### 2. 設定環境變數

編輯 `.env` 檔案，加入你的 Measurement ID：

```bash
VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

**注意：**
- 如果不設定此變數，追蹤功能會自動停用（不會報錯）
- 開發環境也會追蹤，建議使用測試用的 GA4 屬性

### 3. 重新啟動開發伺服器

```bash
npm run dev
```

### 4. 驗證追蹤是否正常運作

#### 方法一：使用瀏覽器開發者工具
1. 打開 Chrome DevTools (F12)
2. 切換到 **Network** 分頁
3. 篩選 `collect?` 或 `google-analytics`
4. 點擊影片相關功能
5. 應該會看到 GA 請求被發送

#### 方法二：使用 GA4 即時報表
1. 登入 Google Analytics
2. 前往 **報表 > 即時**
3. 操作你的應用程式
4. 應該會在即時報表中看到事件

#### 方法三：使用 Console 偵錯
如果 GA 未設定，追蹤函數會在 console 輸出偵錯訊息：
```
[Analytics] video_button_click {session_date: "2026-04-18", video_count: 5, source: "history_card"}
```

---

## 📊 在 GA4 中查看數據

### 即時數據
**位置：** 報表 > 即時

可以看到：
- 當前活躍用戶
- 即時事件流
- 正在觀看的頁面

### 事件報表
**位置：** 報表 > 參與 > 事件

可以看到：
- 各事件的觸發次數
- 每個事件的參數值
- 事件趨勢圖

### 建立自訂報表

#### 範例：影片觀看漏斗分析
1. 前往 **探索 > 漏斗資料探索**
2. 設定步驟：
   - 步驟 1: `video_button_click`
   - 步驟 2: `video_list_opened`
   - 步驟 3: `video_play_click`
3. 查看轉換率

#### 範例：熱門影片排行
1. 前往 **探索 > 任意形式**
2. 維度：`video_id`, `match_no`, `session_date`
3. 指標：`event_count`
4. 篩選器：`event_name = video_play_click`
5. 排序：事件計數 (遞減)

#### 範例：平均觀看時長
1. 前往 **探索 > 任意形式**
2. 維度：`session_date`, `match_no`
3. 指標：`event_count`
4. 篩選器：`event_name = video_player_back`
5. 使用 `time_spent_seconds` 參數計算平均值

---

## 🔧 進階設定

### 停用生產環境追蹤
如果只想在開發環境追蹤，可以這樣設定：

```bash
# .env.development
VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX

# .env.production
# 留空或不設定 VITE_GA_MEASUREMENT_ID
```

### 自訂事件追蹤
如果需要追蹤其他事件，可以使用 `trackVideoEvent` 函數：

```javascript
import { trackVideoEvent } from '@/utils/analytics'

trackVideoEvent('custom_event_name', {
  param1: 'value1',
  param2: 123,
})
```

---

## 📝 注意事項

1. **隱私權**
   - GA4 會收集匿名的用戶行為數據
   - 建議在應用程式中加入隱私權政策說明

2. **數據延遲**
   - 即時報表：約 1-2 分鐘延遲
   - 標準報表：約 24-48 小時延遲

3. **配額限制**
   - GA4 免費版無事件數量限制
   - 但有每秒請求數限制（一般應用不會達到）

4. **開發環境測試**
   - 建議使用獨立的測試 GA4 屬性
   - 避免測試數據污染生產環境報表

---

## 🐛 疑難排解

### 問題：沒有看到追蹤數據
**可能原因：**
1. 未設定 `VITE_GA_MEASUREMENT_ID`
2. Measurement ID 格式錯誤
3. 瀏覽器封鎖了 GA 腳本（廣告攔截器）

**解決方式：**
1. 檢查 `.env` 檔案
2. 確認 Measurement ID 格式為 `G-XXXXXXXXXX`
3. 暫時停用廣告攔截器測試
4. 檢查瀏覽器 Console 是否有錯誤訊息

### 問題：事件沒有參數
**可能原因：**
參數值可能是 `undefined` 或 `null`

**解決方式：**
檢查傳入追蹤函數的參數是否正確

---

## 📚 相關資源

- [Google Analytics 4 文檔](https://support.google.com/analytics/answer/10089681)
- [GA4 事件參數指南](https://support.google.com/analytics/answer/9267735)
- [GA4 自訂報表](https://support.google.com/analytics/answer/9327309)

---

## 📞 技術支援

如有任何問題，請查看：
- 系統代碼：`src/utils/analytics.js`
- GA4 設定：`src/main.js`
- 組件埋點：`src/components/VideoListModal.vue`, `HistoryCard.vue`, `SessionCard.vue`
