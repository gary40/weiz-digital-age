# 任務指令稿：WEiZ 數位年齡測驗 v0-beta — Mac 測試、修復、上線

> 給 Claude Code 使用。把這個資料夾（解壓後）當工作目錄，貼上以下指令：
> 「請讀 CLAUDE_CODE_TASK.md，依序執行全部步驟，每個階段結束回報，遇到需要我操作的地方停下來問我。」

## 0. 背景（先讀）
- `index.html`：測驗本體，單檔、素材與 50 題題庫已內嵌。設定集中在檔案頂端「部署設定」區：`LEAD_ENDPOINT`、`STATS_ENDPOINT`、`FEEDBACK_URL`、`GA_ID`、`AB_TEST`。
- `og.png`：分享預覽圖。`Code.gs`：Apps Script 後端。`acceptance.py`：51 項自動化驗收（Playwright）。
- 目標：在 Mac 上真機驗證 → 修掉發現的問題 → 部署到 GitHub Pages 當 v0-beta → 交一份測試報告。
- 原則：**不改遊戲規則與文案**（計分、稱號、評語、題目），只修 bug 與相容性。改任何東西前先 `git commit` 一版原始檔。

## 1. 環境準備
```bash
git init && git add -A && git commit -m "v0-beta 原始包"
python3 -m venv .venv && source .venv/bin/activate
pip install playwright && python -m playwright install chromium webkit
python3 -m http.server 8080 &   # 本機預覽 http://localhost:8080/index.html
```
沒有 `gh`：`brew install gh && gh auth login`。

## 2. 自動化驗收（Chromium + WebKit）
```bash
QUIZ_URL=http://localhost:8080/index.html QUIZ_FILE=index.html python3 acceptance.py | tee report-chromium.txt
```
再把 `acceptance.py` 裡 `p.chromium.launch(...)` 改成 `p.webkit.launch()` 跑一次，存 `report-webkit.txt`（WebKit 最接近 iOS Safari）。
- 預期 51/51。任一 FAIL：先判斷是測試環境問題還是程式問題，程式問題修好後**重跑整套**，不要只重跑單項。
- WebKit 已知可能差異：`navigator.share`、剪貼簿權限、Web Audio 自動播放。這三類 FAIL 若確認是 API 不支援，記錄為「環境限制」而非 bug。

## 3. 真機／真瀏覽器手動測試（需要 Gary 操作，逐項打勾）
用 `open -a Safari http://localhost:8080/index.html` 與 `open -a "Google Chrome" ...` 各跑一次；手機用 `ipconfig getifaddr en0` 取內網 IP，iPhone 同 Wi-Fi 開 `http://<IP>:8080/index.html`。

| # | 步驟 | 通過條件 |
|---|---|---|
| M1 | 開頁 → 點畫面任一處 | 聽到 8-bit 背景音樂，右下鈕顯示「音效＋音樂」，有「🎵 音樂已開啟」提示 |
| M2 | iPhone 切靜音鍵再重載、點畫面 | 仍有聲音（無聲 audio 解鎖生效）；若無聲，記錄機型與 iOS 版本 |
| M3 | 右下鈕連按三次 | 靜音 → 音效 → 音效＋音樂 循環；靜音時作答無 blip |
| M4 | 選出生年代 → 作答 15 題 | **每題**點選後立刻：正解綠、錯選紅、太空人氣泡出現；約 1.1 秒後自動下一題 |
| M5 | 作答中在選項區上下滑動捲頁 | 不會誤觸作答 |
| M6 | 一題故意不答等 15 秒 | 最後 3 秒環轉紅＋滴答；時間到顯示正解、太空人睡著、跳下一題 |
| M7 | 答完 | 掃描頁四步驟依序亮、有掃描音、約 3 秒後結果頁、年齡數字滾動、對應音效（年輕上行／老了下滑／符合和聲） |
| M8 | 結果頁「產生結果圖卡」→「存圖／分享」 | iPhone 跳出系統分享面板且含圖片；Mac 下載 PNG；圖卡中文正常、無亂碼 |
| M9 | 「分享連結」→ 貼到備忘錄 → 用另一支手機開 | 看到「朋友的數位年齡」、只有「換我測」；測完有「好友對戰」卡與勝負文案 |
| M10 | 結果頁輸入錯誤 Email／不勾同意／正確送出 | 三種提示正確；送出後卡片變「收到了」 |
| M11 | 結果頁連點「再測一次」兩下 | 第 1 題不會被跳掉 |
| M12 | Mac 視窗拉到 1200px 寬 | 手機容器置中、背景光暈漂移 |
| M13 | 系統設定開「減少動態效果」重載 | 無漂移／浮動動畫，答完直接出結果不掃描 |

發現問題：截圖存到 `bugs/`，檔名 `M4-safari-解答未顯示.png`，並在 `BUGS.md` 記錄重現步驟。**修完重跑第 2 節。**

## 4. 常見修法備忘（只在真的遇到時用）
- iOS 圖卡中文變系統字：在 `drawCard` 前加 `await document.fonts.ready`，或把字型改為 `-apple-system, "PingFang TC"` 優先。
- iOS 無聲：確認 `#unlock` audio 在手勢內 `play()`；仍無聲則改用 `<audio>` 播放預錄 8-bit 檔（用 Web Audio 離線渲染成 wav 內嵌）。
- WebKit `navigator.share({files})` 不支援：fallback 已有下載；確認 toast 有出現即可。
- Canvas 圖卡跨域：素材皆為 data URI，不應發生；若發生檢查是否有人改成外部圖片。

## 5. 上線設定（需要 Gary 提供，逐項向他索取）
1. **Apps Script**：請 Gary 建一個 Google 試算表 → 擴充功能 → Apps Script → 貼 `Code.gs` → 部署為網頁應用程式（執行身分：我；存取：任何人）→ 取得 `/exec` 網址。
   - 驗證：`curl -s "<網址>"` 回 `{"count":0,...}`；`curl -s -X POST -d '{"type":"result","age":33,"centerYear":2013,"newRate":50,"persona":"數位主力","decade":"1980 年代","rightN":9,"variant":"instant","challenger":0,"ts":"2026-09-12T00:00:00Z"}' "<網址>"` 後試算表 results 多一列，再 GET 應 count=1。驗證完**刪掉這列測試資料**。
2. **Google 表單**回饋（題目見 README）→ 取表單網址。
3. **GA4** 評估 ID（可先空著，v0 不一定要）。
4. 填進 `index.html` 頂端：`LEAD_ENDPOINT`、`STATS_ENDPOINT`（同一網址）、`FEEDBACK_URL`、`GA_ID`。
5. 決定網址：預設 GitHub Pages。repo 名建議 `weiz-digital-age`，Pages 網址 `https://<帳號>.github.io/weiz-digital-age/`。若 Gary 要 `age.weiz.com.tw`，在 repo 加 `CNAME` 檔並請他在 Cloudflare 加 CNAME 指向 `<帳號>.github.io`。
6. 把 `og:image` 改成完整網址 `https://.../og.png`，`og:url` 填正式網址。
7. `git commit -m "v0-beta 上線設定"`。

## 6. 部署 GitHub Pages
```bash
gh repo create weiz-digital-age --public --source=. --push
gh api -X POST repos/{owner}/weiz-digital-age/pages -f "source[branch]=main" -f "source[path]=/" || true
gh api repos/{owner}/weiz-digital-age/pages --jq .html_url
```
- 等 1–2 分鐘後 `curl -sI <網址>` 回 200。
- 用 https://www.opengraph.xyz 或 LINE 傳給自己，確認分享預覽有大圖。
- 把 `QUIZ_URL=<正式網址>` 再跑一次 `acceptance.py`（線上版回歸）。

## 7. 交付
產出 `RELEASE-v0-beta.md`，內容：
- 正式網址、Pages 部署時間、commit hash
- 第 2 節兩份自動化結果摘要（通過數／FAIL 與歸因）
- 第 3 節 M1–M13 勾選結果與裝置清單
- 修了什麼（diff 摘要）、沒修但記錄的事項
- 測試者邀請文案草稿（一段話＋網址＋回饋表單）
- 末端附「AI 產出驗證區塊」（風險 B 對外發布、建議審核人 Gary）

## 8. 停下來問 Gary 的時機
- 任何需要他登入的動作（Google、GitHub、Cloudflare）
- 準備刪除或覆寫檔案時
- 想改動遊戲規則、文案、計分才能修 bug 時（先問，不要自行改）
