#!/bin/bash
# 用法：bash verify-backend.sh "<Apps Script /exec 網址>"
# 依序做：GET 統計 → POST 一筆測試結果 → 再 GET 應 count+1。跑完請到試算表 results 分頁刪掉那列測試資料（persona=測試資料）。
URL="$1"
if [ -z "$URL" ]; then echo "請把 /exec 網址放在引號裡當參數"; exit 1; fi
echo "1) GET 統計："; curl -sL -m 30 "$URL"; echo; echo
echo "2) POST 一筆測試結果："
curl -sL -m 30 -X POST -H "Content-Type: text/plain" \
  -d '{"type":"result","age":33,"centerYear":2013,"newRate":50,"persona":"測試資料","decade":"1980 年代","rightN":9,"variant":"instant","challenger":null,"ts":"2026-09-12T00:00:00Z","utm":"?test=1"}' "$URL"; echo; echo
sleep 2
echo "3) 再 GET 一次（count 應該比第 1 步多 1）："; curl -sL -m 30 "$URL"; echo; echo
echo "4) 抓明細確認那列存在："; curl -sL -m 30 "${URL}?rows=1"; echo; echo
echo "完成。請到試算表 results 分頁，把 persona 為「測試資料」的那一列刪掉。"
