# RELEASE-v0-beta — WEiZ 數位年齡測驗

> 文件版本：20260912_WEiZ營運_數位年齡測驗v0-beta發布報告_v2（v1 為上線前版本）
> 產出日期：2026-09-12｜狀態：⚠️ AI 產出・待人工審核（風險 B 對外發布，審核人 Gary）

## 結論（3 行）

1. 程式已修完 7 項 iOS／Safari 相容問題，Chromium 自動化驗收 **51／51 通過**，未改任何題目、計分、稱號、文案。
2. **已上線**：https://gary40.github.io/weiz-digital-age/ ，Apps Script 名單／統計與 GA4 皆已接上；回饋表單依 Gary 決定取消，改由 LINE 直接回饋。
3. 真機測試 M1–M13 需要 Gary 在 Mac／iPhone 上跑；其中 M2（靜音鍵）、M8（分享面板）是這次修正的重點，請優先驗。

---

## 1. 版本資訊

| 項目 | 內容 |
|---|---|
| 正式網址 | https://gary40.github.io/weiz-digital-age/ |
| Pages 部署時間 | 2026-09-12（台灣時間下午，Gary 於 Mac 以 git push 部署，Pages 由 main 分支根目錄發布） |
| 程式所在 | 正式 repo `gary40/weiz-digital-age`（main）；備份同步於 `gary40/UTM` 分支 `claude/new-session-y5za96` 的 `weiz-digital-age/` |
| 原始包 commit | `3c68b9c` v0-beta 原始包（未修改） |
| 修正 commit | `813c3c1` iOS／Safari 相容修正與驗收腳本誤判修正（UTM 分支）；正式 repo 上線設定 commit：`5a7f58d` og 網址、`5081db0` Apps Script 端點、`1e6aaee` GA4 |
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

## 5. 上線設定（已完成）

| 項目 | 狀態 | 備註 |
|---|---|---|
| Apps Script `/exec` | ✅ 已填 `LEAD_ENDPOINT`／`STATS_ENDPOINT` | `verify-backend.sh` 驗證：GET 回 JSON、POST 寫入 results、count 由 0→1。**測試那列（persona＝測試資料）請 Gary 刪除** |
| Google 表單回饋 | ➖ 取消 | Gary 決定 v0 不做表單，`FEEDBACK_URL` 留空，左下角只顯示版本標籤；回饋改由 LINE 直接收 |
| GA4 | ✅ `G-DSHJT72D4Z` | 資料串流「數位年齡測驗」；沙箱驗證 gtag 載入與 `finish` 事件送出 |
| og:image／og:url | ✅ | 指向正式網址，另補 `og:image:width/height` 1200×630 |

## 6. 部署 GitHub Pages（已完成）

Gary 於 Mac 以 GitHub 網頁建 repo `gary40/weiz-digital-age`，`git push --force` 覆蓋自動產生的 README 後，在 Settings → Pages 選 main／root 發布。`curl -sI` 回 200 確認。後續程式更新由 Claude 直接推 main，Pages 自動重新部署（約 1–2 分鐘）。

**尚未做**：線上回歸 `QUIZ_URL=https://gary40.github.io/weiz-digital-age/ python3 acceptance.py`（沙箱連不到 github.io，需 Gary 在 Mac 跑）；LINE 分享預覽大圖確認。

## 7. 測試者邀請文案草稿

> 嗨，我們做了一個小測驗「你的數位年齡是幾歲？」——15 題 3C 與網路時事快問快答，每題 15 秒，會告訴你科技記憶停在哪一年，還能把結果丟給朋友對戰。現在是測試版，想請你玩一輪（約 4 分鐘），順手回我幾句感想，特別想知道：有沒有聽到音樂、每題答完有沒有顯示正解、結果準不準。
>
> 測驗：https://gary40.github.io/weiz-digital-age/
>
> 玩完直接在 LINE 回我三件事：用什麼手機、有沒有聽到音樂、結果準不準。順便截結果圖卡傳給我，看誰比較老 😆

---

## 8. 下一步

1. **Gary 審核本報告與修正內容**（B 級對外發布）。
2. Gary 刪除試算表 `results` 分頁的測試資料列。
3. Gary 在 iPhone／Mac 跑 M1–M13，結果填回 `BUGS.md`，優先驗 M2、M8；LINE 傳網址給自己確認分享大圖。
4. Gary 在 Mac 跑線上回歸與 WebKit 一輪（指令見第 2-2 節，`QUIZ_URL` 改正式網址）。
5. 以上無阻斷問題 → 發邀請文案給第一批測試者（建議 10–20 人）。
6. 收到回饋後開 v0.1 修正清單。

---

## 9. v0-beta.1 調整（2026-09-12，依 Gary 回饋）

| # | 原狀 | 調整後 | 為什麼改 |
|---|---|---|---|
| 1 | Email 欄位是單獨的 input | 包成 `<form>`、加 `name="email"`、`autocomplete="email"`、Enter 送出 | 瀏覽器（Safari／Chrome）只對表單內有 name 的欄位提供記憶 Email 自動帶入 |
| 2 | 「想知道全台平均幾歲？」 | 「🎁 領 WEiZ 隱藏版限時折扣碼」、按鈕「領折扣碼」、送出後提示折扣碼會寄到信箱、同意文案加「折扣碼」 | 提高留 Email 意願。**注意：目前只把 Email 寫進試算表，沒有自動寄信；折扣碼需人工寄或另加 Apps Script 自動寄信** |
| 3 | 「分享連結」（系統分享／複製） | 綠色全寬「LINE 一鍵傳給好友」（`line.me/R/share`，手機直接開 LINE 選好友）＋保留「複製連結」 | LINE 是主要擴散管道 |
| 4 | 「產生結果圖卡」 | 「產生專屬：數位年齡報告書」；下載提示同步改「報告書已下載」 | 命名更有價值感 |
| 5 | WEiZ 連結 `https://weiz.com.tw`（憑證錯誤） | `https://www.weiz.com.tw/?utm_source=social&utm_medium=game&utm_campaign=2026091201&utm_content=v1` | 修正憑證警告並帶 UTM |
| 6 | 作答頁有 160px 關鍵字大框（開心農場 '09） | 移除；題目 24px 固定三行高、選項 124px、題目＋選項區塊在剩餘空間垂直置中，太空人貼底 | 版面更聚焦；三種手機尺寸（375×667／390×844／430×932）量測 10 題位置完全一致、無裁切 |

驗收：Chromium 51／51（`report-chromium.txt`，`acceptance.py` C12 改量 `#eraTag`、F3 改抓 POST 內容、離線模式加擋 script.google.com）。截圖：`screenshots/08–11`。

### 待 Gary 決定
- **折扣碼怎麼寄**：A. 人工每週從試算表 `leads` 分頁匯出寄送；B. 我在 `Code.gs` 加 `MailApp.sendEmail`，收到 Email 立即自動寄一封含折扣碼的信（需提供折扣碼與信件文案，Apps Script 免費額度每日 100 封）。
- 折扣碼本身（碼、折扣內容、期限）尚未提供，上線前請確認 Cyberbiz 已建好。

---

## 10. v0-beta.2 調整（2026-09-12，依 GPT 健檢報告 v2 與 Gary 決定）

| 健檢編號 | Gary 決定 | 原狀 | 調整後 |
|---|---|---|---|
| W08 | 執行 | 本人在結果頁重新整理會變成「朋友的數位年齡」 | 完成時把結果存在瀏覽器本機；重整時網址與本機一致就維持本人視角（分享、證書、名單卡、回顧都在） |
| W09 | 執行 | 結果頁底部殘留「AI 產出驗證區塊（原型用，上線前移除）」 | 整段移除 |
| W04 | 執行 | Apps Script `?rows=1` 公開明細；POST 無驗證 | `Code.gs` v0-beta.2：移除明細輸出、欄位白名單、長度上限、數值範圍、公式前綴消毒、LockService。**需 Gary 重新部署（新版本）** |
| W05 | 執行 | 同意預設打勾、無政策連結 | 預設不勾；連結 https://www.weiz.com.tw/pages/privacy ；「可隨時回信取消」 |
| W01 | (b) | 未滿 500 筆用假分布不標示 | 結果頁與證書百分位加「（推估）」 |
| W07 | (b) | 「比實際年輕／老了 N 歲」 | 「比同年代的人年輕／老了 N 歲」（分享文字同步） |
| W06 | 執行 | GA 只有 7 個事件 | 新增 `quiz_start`（年代）、`answer`（題號、順序、對錯、逾時、耗時）、`copy_link`；`finish` 加答對數與總耗時 |
| W02／W03／W10 | 不改 | 計分公式、名單假成功、文案語氣 | 維持 |
| 命名 | Gary 指示 | LINE 一鍵傳給好友／產生專屬：數位年齡報告書／複製連結 | **LINE 揪好友來挑戰**（帶結果的挑戰連結）／**產生專屬數位年齡證書**／**分享遊戲給更多人**（複製不帶結果的遊戲網址） |

驗收：Chromium **53／53**（新增 E1b LINE 連結、E3b 重整仍本人）。截圖：`screenshots/12–14`。

### 待 Gary
- **重新部署 Apps Script**：Apps Script 編輯器貼上新版 `Code.gs` → 部署 → 管理部署作業 → 鉛筆 → 版本「新版本」→ 部署。網址不變，不用改前端。部署後跑 `bash verify-backend.sh "<exec 網址>"`，第 4 步「抓明細」現在應回不含 `rows` 的統計 JSON。

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
▸ 已驗證項目：Chromium 141 自動化 51／51；正式網址 curl 200（Gary）；Apps Script GET／POST（Gary 執行 verify-backend.sh）；GA4 gtag 載入與 finish 事件（沙箱模擬）；無聲音檔 duration 0.25 s 且 paused=false；
  再測一次後 location.search 保留；圖卡 blob 1.9 MB 預先產生、下載檔名正確；兩個 script 區塊語法檢查通過；
  commit hash 3c68b9c／813c3c1 取自 git log
▸ 未確認項目／假設：折扣碼寄送機制與內容（v0-beta.1 文案已承諾，需 Gary 補上）；WebKit 自動化結果；線上回歸；M1–M13 真機結果；
  B1／B3 修正在 iPhone 上的實際效果；LINE 分享預覽；50 題事實年份
▸ 風險分級：☑ B 對外發布（測驗將公開給測試者與社群）
▸ 建議審核人：Gary
▸ 狀態：⚠️ AI 產出・待人工審核
━━━━━━━━━━━━━━━━━━━━━━━━━━
```
