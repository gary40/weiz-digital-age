# BUGS.md — WEiZ 數位年齡測驗 v0-beta

> 記錄自動化驗收與程式碼審閱發現的問題。狀態：✅ 已修｜📝 已記錄未修｜⏳ 待真機確認
> 真機測試（M1–M13）發現的問題請往下加，截圖放 `bugs/`，檔名 `M4-safari-解答未顯示.png`。

## 已修（commit 813c3c1）

| # | 問題 | 重現 | 原因 | 修法 | 狀態 |
|---|---|---|---|---|---|
| B1 | iPhone 靜音鍵開著時應仍有音樂，但無聲解鎖失效 | iPhone 切靜音 → 開頁 → 點畫面 | `#unlock` 內嵌的 WAV 只有檔頭、data 區塊 0 byte，iOS 對空音檔不會真的播放，媒體通道沒被打開 | 換成真正 0.25 秒靜音 WAV（8 kHz／8-bit，約 2.7 KB base64） | ✅（⏳ M2 真機確認） |
| B2 | Web Audio 一旦例外，作答會卡死 | 不支援／被封鎖 AudioContext 的 WebView | `pick()` 內先呼叫 `sfx('tap')` 才記錄答案，`sfx` 沒有防護，`AC` 為 null 時拋錯，`locked=true` 後不會跳下一題 | `sfx()` 全包 try/catch；`sfx`／`startMusic` 在 `AC` 為 null 時直接 return | ✅ |
| B3 | iPhone「存圖／分享」可能不跳系統分享面板 | 結果頁 → 產生結果圖卡 → 存圖／分享 | `canvas.toBlob` 是非同步，回呼裡才呼叫 `navigator.share`，Safari 要求在使用者手勢有效期內呼叫，慢一點就被拒絕 | 圖卡畫完就先轉成 blob 存起來，按鈕按下時直接分享；blob 還沒好時提示再按一次 | ✅（⏳ M8 真機確認） |
| B4 | 再測一次後網址參數消失 | `?utm_source=line` 或 `?v=silent` 開頁 → 再測一次 | `start()` 用 `location.pathname` 蓋掉網址，query string 被丟掉，第二次作答的 utm 欄位變空 | 改成 `location.pathname + location.search` | ✅ |
| B5 | 圖卡「限定成就」徽章文字可能超出金色底 | 全對 → 產生結果圖卡 | 徽章寬 340px，字型回退（非 Noto Sans TC）時 12 個字寬過 340px | 徽章加寬到 390px | ✅ |
| B6 | 圖卡預覽背景模糊在舊版 iOS 無效 | iOS 16／17 開圖卡 | 只寫了 `backdrop-filter`，Safari 18 以前要 `-webkit-` 前綴 | 補前綴 | ✅ |
| B7 | 音樂鈕與測試版標籤可能貼到 iPhone 底部手勢條 | 加到主畫面（standalone）開啟 | 沒考慮 `safe-area-inset-bottom` | `bottom: calc(14px + env(safe-area-inset-bottom))` | ✅ |

## v0-beta.2 已修（依 GPT 健檢 v2）

| # | 問題 | 修法 | 狀態 |
|---|---|---|---|
| W08 | 本人重整結果頁變朋友視角 | 結果存 localStorage，重整比對網址 | ✅ 自動化 E3b |
| W09 | 殘留內部驗證區塊 | 移除 | ✅ |
| W04 | 後端公開明細、無輸入驗證 | Code.gs v0-beta.2（需重新部署） | ✅ 程式已改，⏳ 待 Gary 部署 |
| W05 | 同意預設勾選、無政策連結 | 預設不勾＋連結 | ✅ |
| W01 | 假分布百分位無標示 | 加「（推估）」 | ✅ |
| W07 | 「比實際」措辭 | 改「比同年代的人」 | ✅ |
| W06 | GA 缺漏斗事件 | 加 quiz_start／answer／copy_link | ✅ |

## v0.9-y2k 改版備註

| # | 事項 | 狀態 |
|---|---|---|
| Y1 | 音效預設改為關閉（依規格），與先前「預設開」不同 | ⏳ 待 Gary 確認 |
| Y2 | Email 同意預設打勾（依 Gary 指示），與健檢 W05 建議相反 | ⏳ 建議法務確認 |
| Y3 | iOS／Android 實機：證書儲存、分享面板、LINE 跳轉、限動遮擋 | ⏳ 未驗證 |
| Y4 | 舊版 `screenshots/01–14` 為白底版畫面，僅供對照 | 📝 |

## v1.0-preview（v4）備註

| # | 事項 | 狀態 |
|---|---|---|
| V1 | 50 則「威比科技小知識」為 AI 撰寫，含年份與產品事實 | ⏳ 上線前請人工逐則查證 |
| V2 | 名單／結果 POST 改為 CORS 可讀回應，依賴 Apps Script 轉址後帶 CORS 標頭 | ⏳ 需 Gary 在瀏覽器實測（沙箱連不到 Google）；失敗時名單會顯示「送出沒有成功」而非假成功 |
| V3 | Threads intent／FB sharer／IG 指引流程 | ⏳ 未在手機實測 |
| V4 | 預覽 Artifact 環境擋下載，證書儲存在預覽頁無效 | 📝 環境限制 |
| V5 | 計分公式、稱號規則、偏好題、LINE Login、正式後端 | ⏳ 待 Gary 決定（RELEASE 12-3） |

## 驗收腳本本身的誤判（已修，不是程式 bug）

| # | 測項 | 現象 | 原因 | 修法 |
|---|---|---|---|---|
| T1 | C12 版面固定 | 第 1 題量到 176／220／84，其後 175／221／85（差 1px） | 量測時點（選年代後 600 ms）`screenIn` 與 `fade` 進場動畫還在跑，量到 transform 中的位置；用 50 題逐題量測確認所有容器位置完全一致 | 量測前多等 500 ms |
| T2 | F3 名單 payload | console 文字沒有 `1980` | Chromium 的 console 文字預覽只顯示前 5 個欄位，`decade` 被截掉；實際 payload 有 `decade: "1980 年代"` | 改讀 `msg.args` 的完整 JSON |
| T3 | A1／E6／I1 頁面錯誤 | `Failed to load resource: net::ERR_CONNECTION_REFUSED` | 沙箱環境封鎖 fonts.googleapis.com，字型 CSS 載入失敗被算成錯誤 | 新增 `QUIZ_OFFLINE=1`，把 Google Fonts／GTM 請求擋成空回應 |

## 已記錄未修（不影響上線，或需 Gary 決定）

| # | 事項 | 說明 | 建議 |
|---|---|---|---|
| N1 | ~~`og:image`／`og:url` 仍是相對路徑與空值~~ | ✅ 已填正式網址（commit 5a7f58d） | 用 LINE 傳網址給自己確認大圖 |
| N2 | 內網 `http://<IP>:8080` 測試時，M8 分享面板與 M9 複製連結不會出現 | `navigator.share`、`navigator.clipboard` 只在 https 或 localhost 才存在，這是瀏覽器安全限制。程式已有 fallback（下載 PNG／提示手動複製） | M8、M9 請在正式 https 網址測，內網測到「下載」「請手動複製」算正常 |
| N3 | 沒有 favicon | 每次開頁瀏覽器會多一個 404 請求，不影響功能 | 之後可加一個 WEiZ 圖示 |
| N4 | 分享圖卡吉祥物與引號框略有重疊 | 原設計即如此（吉祥物固定畫在右側 y=720 起） | 視覺上可接受，若要調整屬設計決定 |
| N5 | 無聲 `<audio>` 持續循環播放 | 這是 iOS 繞過靜音鍵的標準做法，副作用是 iOS 控制中心可能出現「正在播放」 | 若 Gary 覺得干擾，可改為只在音樂模式下播放 |
| N6 | 50 題事實年份未人工抽查 | 原檔備註即註明 | 上線前請至少抽 10 題 |
| N8 | 折扣碼尚無寄送機制 | v0-beta.1 名單卡文案承諾「折扣碼寄到信箱」，但後端只寫試算表 | 人工寄送，或在 Code.gs 加 MailApp 自動寄信（見 RELEASE 第 9 節） |
| N7 | WebKit 自動化未跑 | 沙箱網路封鎖 Playwright 瀏覽器下載站（cdn.playwright.dev） | 在 Mac 上跑 `BROWSER=webkit python3 acceptance.py`（腳本已支援） |

## 真機測試發現（M1–M13，由 Gary 填）

| 測項 | 裝置／瀏覽器 | 結果 | 截圖 | 備註 |
|---|---|---|---|---|
| | | | | |
