# 羽球出席系統 — 部署步驟

## 前置條件

- Google 帳號（用於 Google Sheets + Apps Script）
- GitHub 帳號
- Vercel 帳號（可用 GitHub 登入）

---

## 步驟一：建立 Google Sheets

1. 前往 [Google Sheets](https://sheets.google.com)，建立新試算表，命名為 **羽球出席系統**。

2. 在試算表底部新增 **4 個分頁**，名稱如下：

   | 分頁名稱 | 說明 |
   |----------|------|
   | `config` | 系統設定（key-value 格式） |
   | `members` | 成員名單 |
   | `sessions` | 每週場次 |
   | `attendances` | 出席記錄 |

3. 依照以下格式填入各分頁內容：

### `config` 分頁（無標題列，直接填 key-value）

| A 欄 | B 欄 |
|------|------|
| `venue_name` | `大安體育場 第 3 場`（可自行修改） |
| `day_of_week` | `六` |
| `time_start` | `09:00` |
| `time_end` | `11:00` |
| `admin_token` | `your-secret-token`（**自訂一組密碼，記下來**） |

### `members` 分頁（第一列為標題）

```
id | name | active | created_at
```

> 留空即可，系統會自動寫入。

### `sessions` 分頁（第一列為標題）

```
session_id | date | created_at | note
```

### `attendances` 分頁（第一列為標題）

```
id | session_id | member_id | name | type | guest_key | created_at
```

---

## 步驟二：部署 Google Apps Script

1. 在試算表上方選單：**擴充功能 → Apps Script**

2. 刪除編輯器中的預設內容（通常是空的 `function myFunction() {}`）

3. 將專案根目錄 `gas/Code.gs` 的全部內容貼入編輯器

4. 點左上角儲存圖示（或 `Ctrl+S`）

5. 點右上角 **「部署 → 新增部署」**

6. 設定如下：
   - 類型：**網路應用程式（Web app）**
   - 執行身份：**我（your Google account）**
   - 存取權：**任何人（包括匿名使用者）**

7. 點 **「部署」**，授權 Google 帳號存取試算表

8. **複製 Web App URL**，格式如下：
   ```
   https://script.google.com/macros/s/AKfycby.../exec
   ```
   這就是 `VITE_GAS_URL`。

> **注意**：之後每次修改 `Code.gs` 都需要重新部署（「部署 → 管理部署 → 編輯 → 新增版本」），否則線上版本不會更新。

### 測試 GAS 是否正常

在瀏覽器分別開啟以下網址（替換 `{URL}` 為你的 Web App URL）：

```
{URL}?action=getConfig
{URL}?action=getMembers
{URL}?action=getSessions
```

每個應回傳：
```json
{"status":"ok","data":{...}}
```

---

## 步驟三：設定本機環境變數

在專案根目錄執行：

```bash
cp .env.example .env
```

編輯 `.env`，填入實際值：

```
VITE_GAS_URL=https://script.google.com/macros/s/你的ID/exec
VITE_ADMIN_TOKEN=your-secret-token
```

> `VITE_ADMIN_TOKEN` 必須與 Google Sheets `config` 分頁中的 `admin_token` 值**完全相同**。

驗證本機 build 正常：

```bash
npm run build
```

---

## 步驟四：推送到 GitHub

確認目前在 `release` 分支，推送到 GitHub：

```bash
git push origin release
```

---

## 步驟五：部署到 Vercel

1. 前往 [vercel.com](https://vercel.com)，使用 GitHub 帳號登入

2. 點 **「Add New → Project」**，選擇你的 GitHub repository

3. 設定如下：
   - **Framework Preset**：`Vite`
   - **Root Directory**：`./`（預設即可）

4. 展開 **「Environment Variables」**，新增以下兩個變數：

   | 名稱 | 值 |
   |------|----|
   | `VITE_GAS_URL` | 你的 GAS Web App URL |
   | `VITE_ADMIN_TOKEN` | 你設定的密碼 |

5. 點 **「Deploy」**

6. 部署完成後，Vercel 會提供一個網址，例如：
   ```
   https://badminton-arrangement.vercel.app
   ```

> 之後每次 `git push origin release`，Vercel 會自動重新部署。

---

## 步驟六：驗收測試

部署完成後，在**手機瀏覽器**開啟以下網址逐一測試：

| 測試項目 | 網址 | 預期結果 |
|----------|------|----------|
| 本週出席 | `/` | 顯示紫色 hero + 出席名單（或 empty state） |
| 歷史記錄 | `/history` | 顯示深紫 hero + 歷史列表 |
| 排行榜 | `/stats` | 顯示深青 hero + 排行榜 + 徽章 |
| 管理員畫面 | `/admin?token=your-secret-token` | 顯示淺青 hero + 編輯名單 |
| 無權限 | `/admin?token=wrong` | 顯示「需要管理員權限」🔒 |
| 儲存名單 | 管理員畫面勾選成員 → 儲存 | 畫面更新 + Google Sheets 資料寫入 |

---

## 日常使用方式

### 管理員操作

每週活動前，用以下網址開啟管理員畫面：

```
https://your-vercel-url/admin?token=your-secret-token
```

- 勾選本週出席成員
- 在「臨時成員」區塊新增訪客姓名
- 點「儲存並發布 ✓」

### 分享給其他成員

直接分享根網址即可（無 token）：

```
https://your-vercel-url/
```

成員可查看本週出席、歷史記錄、排行榜，但無法修改。

### 新增 / 停用成員

目前需透過 Google Sheets `members` 分頁手動操作：

- **新增成員**：在 `members` 分頁新增一列，`id` 欄填 `m` + 任意數字，`active` 欄填 `TRUE`
- **停用成員**：將 `active` 欄改為 `FALSE`（歷史記錄保留）
- **重新啟用**：將 `active` 欄改回 `TRUE`

---

## 常見問題

**Q：管理員儲存後畫面沒更新？**
儲存成功會顯示「已成功發布！」並自動重新載入資料。若出現錯誤訊息，請確認 `VITE_ADMIN_TOKEN` 與 Sheets `config` 分頁的 `admin_token` 相同。

**Q：GAS 回傳 500 或沒有回應？**
確認 GAS 部署時「存取權」設為「任何人（包括匿名使用者）」。修改程式後記得重新部署。

**Q：Vercel 部署失敗？**
確認 `VITE_GAS_URL` 和 `VITE_ADMIN_TOKEN` 兩個環境變數都已正確填入。

**Q：想修改場地名稱 / 時間？**
直接在 Google Sheets `config` 分頁修改對應的值，頁面重新整理後即生效（不需重新部署）。
