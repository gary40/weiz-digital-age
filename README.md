# WEiZ 數位年齡測驗 v0-beta 部署包

## 檔案
- index.html — 測驗本體（單檔，素材與題庫已內嵌）
- og.png — 社群分享預覽圖 1200×630
- Code.gs — Apps Script 後端（名單＋匿名統計）

## 上線前要填的 4 個值（index.html 頂端「部署設定」區）
| 常數 | 填什麼 | 沒填會怎樣 |
|---|---|---|
| LEAD_ENDPOINT | Apps Script 網頁應用程式網址 | 名單只印在瀏覽器 console，不會存 |
| STATS_ENDPOINT | 同上 | 不回傳結果、首頁不顯示人數、百分位一直用假分布 |
| FEEDBACK_URL | Google 表單網址 | 左下角只顯示版本，沒有回饋按鈕 |
| GA_ID | G-XXXXXXX | 不追蹤事件 |

另外把 `<meta property="og:image">` 與 `og:url` 改成正式網址。

## 部署選項（任選一）
A. GitHub Pages：新 repo → 上傳三個檔 → Settings → Pages → main / root → 網址 https://<帳號>.github.io/<repo>/
B. NAS Web Station：上傳到站台根目錄，Cloudflare 綁子網域（例 age.weiz.com.tw）
C. Cloudflare Pages：拖曳資料夾即上線

## 建議測試版 Google 表單題目
1. 你的裝置與瀏覽器　2. 音樂有沒有聽到　3. 解答每題都有顯示嗎　4. 結果準不準（1–5）　5. 最想分享的一句評語　6. 遇到的問題（截圖）
