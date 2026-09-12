# RELEASE-v0-beta — WEiZ 數位年齡測驗

> 文件版本：20260912_WEiZ營運_數位年齡測驗v0-beta發布報告_v1
> 產出日期：2026-09-12｜狀態：⚠️ AI 產出・待人工審核（風險 B 對外發布，審核人 Gary）

## 結論（3 行）

1. 程式已修完 7 項 iOS／Safari 相容問題，Chromium 自動化驗收 **51／51 通過**，未改任何題目、計分、稱號、文案。
2. **尚未上線**：GitHub Pages 需要開新 repo（`weiz-digital-age`），這個工作階段的 GitHub 權限只到 `gary40/utm`，要 Gary 操作（第 5、6 節）。
3. 真機測試 M1–M13 需要 Gary 在 Mac／iPhone 上跑；其中 M2（靜音鍵）、M8（分享面板）是這次修正的重點，請優先驗。

---

## 1. 版本資訊

| 項目 | 內容 |
|---|---|
| 正式網址 | **待確認**（建議 `https://gary40.github.io/weiz-digital-age/`，或 `https://age.weiz.com.tw`） |
| Pages 部署時間 | 待部署 |
| 程式所在 | repo `gary40/UTM`、分支 `claude/new-session-y5za96`、資料夾 `weiz-digital-age/` |
| 原始包 commit | `3c68b9c` v0-beta 原始包（未修改） |
| 修正 commit | `813c3c1` iOS／Safari 相容修正與驗收腳本誤判修正 |
| 測試環境 | 雲端 Linux 沙箱、Chromium 141（Playwright 1.56）、手機視窗 390×844 @2x |

---

## 2. 自動化驗收結果

### 2-1 Chromium（`report-chromium.txt`）

| 輪次 | 結果 | FAIL 項目與歸因 |
|---|---|---|
| 第 1 輪（原始檔） | 46／51 | A1、E6、I1：沙箱封鎖 Google Fonts 造成的資源錯誤 → **環境限制**。C12：驗收腳本量到進場動畫中的位置 → **腳本誤判**。F3：console 文字預覽截斷 payload → **腳本誤判** |
| 第 2 輪（修正後） | **51／51** | 無 |

第 1 輪的 5 個 FAIL 都不是程式 bug，但修正過程另外從程式碼審閱找出 7 項真正的相容問題（第 4 節）。

### 2-2 WebKit（`report-webkit.txt`）

**未執行。** 沙箱網路政策封鎖 Playwright 的瀏覽器下載站（cdn.playwright.dev、playwright.download.prss.microsoft.com 皆回 403），無法安裝 WebKit。

請 Gary 在 Mac 上補跑（腳本已支援環境變數切換，不用改檔）：

```bash
cd weiz-digital-age
python3 -m venv .venv && source .venv/bin/activate
pip install playwright && python -m playwright install chromium webkit
python3 -m http.server 8080 &
QUIZ_URL=http://localhost:8080/index.html python3 acceptance.py | tee report-chromium.txt
BROWSER=webkit QUIZ_URL=http://localhost:8080/index.html python3 acceptance.py | tee report-webkit.txt
```

WebKit 預期可能 FAIL 且屬環境限制的項目：E1（剪貼簿權限）、A8／C10（Web Audio 自動播放策略）。

---

## 3. 真機測試 M1–M13（待 Gary 執行）

| # | 步驟 | 通過條件 | Safari (Mac) | Chrome (Mac) | iPhone | 備註 |
|---|---|---|---|---|---|---|
| M1 | 開頁 → 點畫面 | 8-bit 音樂、鈕顯示「音效＋音樂」、提示「🎵 音樂已開啟」 | ☐ | ☐ | ☐ | 沙箱 Chromium 已驗：AC running、toast 正確 |
| M2 | iPhone 靜音鍵 → 重載 → 點畫面 | 仍有聲音 | — | — | ☐ | **本次修正重點（B1）**，無聲請記機型與 iOS 版本 |
| M3 | 右下鈕連按三次 | 靜音 → 音效 → 音效＋音樂 | ☐ | ☐ | ☐ | 自動化 A9 已驗 |
| M4 | 作答 15 題 | 每題正解綠、錯選紅、氣泡；1.1 秒後下一題 | ☐ | ☐ | ☐ | 自動化 C3 已驗 15 題 |
| M5 | 選項區上下滑動 | 不誤觸 | — | — | ☐ | |
| M6 | 一題等 15 秒 | 最後 3 秒紅環＋滴答；時間到顯示正解、太空人睡著 | ☐ | ☐ | ☐ | 自動化 C6–C8 已驗 |
| M7 | 答完 | 掃描四步驟 → 結果頁 → 數字滾動 → 對應音效 | ☐ | ☐ | ☐ | 自動化 G1 已驗 |
| M8 | 產生結果圖卡 → 存圖／分享 | iPhone 分享面板含圖；Mac 下載 PNG；中文正常 | ☐ | ☐ | ☐ | **本次修正重點（B3）**。內網 http 不會有分享面板，請用 https 正式網址測 |
| M9 | 分享連結 → 另一支手機開 | 「朋友的數位年齡」、只有「換我測」；測完有對戰卡 | — | — | ☐ | 自動化 E4／E5 已驗；內網 http 下「複製」會變「請手動複製」提示，屬正常 |
| M10 | 錯誤 Email／不勾同意／正確送出 | 三種提示；送出後「收到了」 | ☐ | ☐ | ☐ | 自動化 F1–F3 已驗 |
| M11 | 「再測一次」連點兩下 | 第 1 題不被跳掉 | ☐ | ☐ | ☐ | 自動化 C11 已驗 |
| M12 | 視窗拉到 1200px | 容器置中、光暈漂移 | ☐ | ☐ | — | 自動化 H1 已驗置中 |
| M13 | 系統「減少動態效果」 | 無漂移；答完直接出結果 | ☐ | ☐ | ☐ | 自動化 G2 已驗 |

裝置清單（請填）：Mac 型號／macOS 版本／Safari 版本、iPhone 型號／iOS 版本、第二支手機。

沙箱擷取的畫面在 `screenshots/`（01 首頁、02 選年代、03 答錯反饋、04 倒數轉紅、05 掃描、06 結果頁、07 圖卡），為 Chromium 141 無 Google Fonts 的回退字型畫面，非 iPhone 實機。

---

## 4. 修了什麼（Before／After）

| # | 原狀 | 調整後 | 為什麼改 |
|---|---|---|---|
| B1 | `#unlock` 無聲音檔只有 44 byte 檔頭，data 區塊 0 byte | 真正 0.25 秒靜音 WAV（8 kHz／8-bit） | iOS 對空音檔不會播放，靜音鍵繞過整個失效；這是 M2 的關鍵 |
| B2 | `sfx()` 無防護，`AC` 為 null 就拋錯 | `sfx()` 包 try/catch，`sfx`／`startMusic` 在 `AC` 為 null 時 return | `pick()` 先播音效才記錄答案，音效炸掉會讓作答卡死 |
| B3 | 按「存圖／分享」才 `toBlob`，回呼裡再 `navigator.share` | 圖卡畫完先轉 blob，按下時直接分享 | Safari 要求 share 在手勢有效期內呼叫，非同步回呼可能被拒 |
| B4 | 再測一次用 `location.pathname` 蓋網址 | 加上 `location.search` | 保留 utm 與 `?v=` 參數 |
| B5 | 限定成就徽章寬 340px | 390px | 字型回退時 12 個字會超出 |
| B6 | `.cardprev` 只有 `backdrop-filter` | 補 `-webkit-backdrop-filter` | iOS 16／17 需要前綴 |
| B7 | 音樂鈕／測試版標籤 `bottom:14px` | `calc(14px + env(safe-area-inset-bottom))` | 避開 iPhone 手勢條 |
| — | `drawCard` 只 `fonts.load` | 先 `await document.fonts.ready` | 依任務備忘建議，降低圖卡中文變系統字的機率 |

差異摘要：`index.html` 改 8 處（約 40 行），全部在音訊、分享、CSS 相容層；**題庫、計分公式、稱號、評語、文案、掃描與結果流程一字未動**。`acceptance.py` 改 3 處（C12 等動畫、F3 讀完整參數、新增 `BROWSER`／`QUIZ_OFFLINE` 環境變數）。

### 沒修但記錄的事項

見 `BUGS.md` N1–N7：og 網址待填、內網 http 分享限制、無 favicon、圖卡吉祥物與引號框重疊（原設計）、無聲音檔循環播放的副作用、50 題年份待人工抽查、WebKit 未跑。

---

## 5. 上線設定（需要 Gary，逐項）

| 步驟 | 要做的事 | 完成後給我 |
|---|---|---|
| 5-1 | Google 試算表 → 擴充功能 → Apps Script → 貼 `Code.gs` → 部署為網頁應用程式（執行身分：我；存取：任何人） | `/exec` 網址 |
| 5-2 | 驗證：`curl -s "<網址>"` 應回 `{"count":0,"mean":0,"sd":0}`；再 POST 一筆測試結果（指令見 `CLAUDE_CODE_TASK.md` 第 5 節），GET 應 count=1，**驗完刪掉那列** | 驗證結果 |
| 5-3 | Google 表單回饋（題目見 `README.md`） | 表單網址 |
| 5-4 | GA4 評估 ID（可先空） | `G-XXXXXXX` 或「先不用」 |
| 5-5 | 決定網址：`https://gary40.github.io/weiz-digital-age/` 或 `age.weiz.com.tw`（後者要在 Cloudflare 加 CNAME 指向 `gary40.github.io`） | 網址 |

拿到以上資料後，我會填進 `index.html` 頂端的 `LEAD_ENDPOINT`、`STATS_ENDPOINT`、`FEEDBACK_URL`、`GA_ID`，以及 `og:image`／`og:url`，再 commit「v0-beta 上線設定」。

---

## 6. 部署 GitHub Pages（需要 Gary）

這個工作階段的 GitHub 權限只涵蓋 `gary40/utm`，無法替你開新 repo。兩個做法擇一：

**A. 新 repo（建議）**：在 Mac 上、`weiz-digital-age/` 資料夾內

```bash
gh repo create weiz-digital-age --public --source=. --push
gh api -X POST repos/gary40/weiz-digital-age/pages -f "source[branch]=main" -f "source[path]=/"
gh api repos/gary40/weiz-digital-age/pages --jq .html_url
```

**B. 把 `gary40/utm` 這個 repo 加進我的權限**，我再幫你建 repo 與開 Pages（需要你在 claude.ai 的 GitHub 連接器授權 `weiz-digital-age`）。

部署後：等 1–2 分鐘 `curl -sI <網址>` 回 200 → LINE 傳給自己看預覽大圖 → `QUIZ_URL=<正式網址> python3 acceptance.py` 跑線上回歸。

---

## 7. 測試者邀請文案草稿

> 嗨，我們做了一個小測驗「你的數位年齡是幾歲？」——15 題 3C 與網路時事快問快答，每題 15 秒，會告訴你科技記憶停在哪一年，還能把結果丟給朋友對戰。現在是測試版，想請你玩一輪（約 4 分鐘），順手填一下回饋，特別想知道：有沒有聽到音樂、每題答完有沒有顯示正解、結果準不準。
>
> 測驗：**（正式網址，待填）**
> 回饋表單：**（Google 表單網址，待填）**
>
> 玩完記得截結果圖卡傳給我，看誰比較老 😆

---

## 8. 下一步

1. **Gary 審核本報告與修正內容**（B 級對外發布）。
2. Gary 在 Mac／iPhone 跑 M1–M13，結果填回 `BUGS.md`，優先驗 M2、M8。
3. Gary 提供第 5 節五項資料 → 我填設定、改 og 網址、commit。
4. Gary 開 repo 與 Pages（第 6 節 A）或授權後由我處理（B）。
5. 上線後跑線上回歸與 LINE 預覽確認，再發邀請文案。

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 AI 產出驗證區塊
━━━━━━━━━━━━━━━━━━━━━━━━━━
▸ 產出日期：2026-09-12
▸ 使用 Project：WEiZ 營運（Claude Code 工作階段）
▸ 資料來源：
  - 使用者提供：v0-beta 部署包（index.html、og.png、Code.gs、acceptance.py、README.md）、CLAUDE_CODE_TASK.md
  - 知識庫／檔案：無
  - 網路搜尋：無
  - 自有知識推論：iOS Safari 對空音檔、navigator.share 手勢有效期、backdrop-filter 前綴、
    http 環境下 navigator.share／clipboard 不存在（皆為瀏覽器行為的通用知識，未在 iPhone 實機驗證，標「未經驗證」）
▸ 已驗證項目：Chromium 141 自動化 51／51；無聲音檔 duration 0.25 s 且 paused=false；
  再測一次後 location.search 保留；圖卡 blob 1.9 MB 預先產生、下載檔名正確；兩個 script 區塊語法檢查通過；
  commit hash 3c68b9c／813c3c1 取自 git log
▸ 未確認項目／假設：正式網址；WebKit 自動化結果；M1–M13 真機結果；
  B1／B3 修正在 iPhone 上的實際效果；50 題事實年份
▸ 風險分級：☑ B 對外發布（測驗將公開給測試者與社群）
▸ 建議審核人：Gary
▸ 狀態：⚠️ AI 產出・待人工審核
━━━━━━━━━━━━━━━━━━━━━━━━━━
```
