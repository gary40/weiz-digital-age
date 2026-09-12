#!/bin/bash
# 用法：bash verify-backend.sh "<Apps Script /exec 網址>"
# 依序做：GET 統計 → POST 一筆測試結果 → 再 GET 應 count+1。跑完請到試算表 results 分頁刪掉那列測試資料（persona=測試資料）。
URL="$1"
if [ -z "$URL" ]; then echo "請把 /exec 網址放在引號裡當參數"; exit 1; fi
echo "1) GET 統計（v1.2 會多回 \"version\":\"v1.2\"；沒有 version 欄位＝還是舊版）："; curl -sL -m 30 "$URL"; echo; echo
echo "2) POST 一筆測試結果（帶 test_mode=1；跟隨轉址讀回應：新版 Code.gs 會回 {\"ok\":true,\"receipt_id\":...}，舊版回 HTML 錯誤頁或 {\"ok\":true} 沒有 receipt_id）："
curl -sL -m 30 --post302 --post303 -X POST -H "Content-Type: text/plain" \
  -d '{"type":"result","age":33,"centerYear":2013,"newRate":50,"persona":"測試資料","decade":"1980 年代","rightN":9,"variant":"instant","challenger":null,"utm":"?test=1","attempt_id":"verifytest01","guest_id":"verifytest01","quiz_version":"verify","score_version":"v1","test_mode":1}' "$URL" | head -c 300; echo; echo
sleep 2
echo "3) 再 GET 一次：新版 Code.gs 會排除 test_mode=1 → count 與第 1 步相同；舊版 → count +1"; curl -sL -m 30 "$URL"; echo; echo
echo "4) 確認明細已關閉（v0-beta.2 起不應出現 rows 欄位）："; curl -sL -m 30 "${URL}?rows=1"; echo; echo
echo "5) POST 一筆測試答題明細（v1.2 才有 answers 分頁；舊版回 unknown type）："
curl -sL -m 30 --post302 --post303 -X POST -H "Content-Type: text/plain" \
  -d '{"type":"answers","attempt_id":"verifytest01","guest_id":"verifytest01","quiz_version":"verify","test_mode":1,"rows":[{"q_id":1,"era":"1995-2004","year":2000,"difficulty":1,"pos":1,"chosen":3,"correct":1,"timed_out":0,"ms":3200}]}' "$URL" | head -c 300; echo; echo
echo "判讀：第 1 步有 version v1.2、第 5 步回 {\"ok\":true,...} → v1.2 已生效，試算表會多出 answers／events／questions／question_stats 分頁。"
echo "      第 2 步有 receipt_id 且第 3 步 count 沒變 → 至少是 v1.0 以上（測試列已標 test_mode，統計自動排除，可留可刪）。"
echo "      第 2 步沒有 receipt_id 或 count +1 → 還是舊版，請到 Apps Script 部署新版本。"
echo "      試算表 results 分頁 persona 為「測試資料」且 test_mode 空白的舊測試列，請刪掉。"
