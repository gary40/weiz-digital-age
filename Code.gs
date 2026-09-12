/**
 * WEiZ 數位年齡測驗 — Apps Script 後端 v1.0-preview（名單 + 匿名結果 + 分享歸因）
 * 部署：Google 試算表 → 擴充功能 → Apps Script → 貼上 → 部署 → 管理部署作業 → 鉛筆 → 版本「新版本」→ 部署（網址不變）
 *      執行身分：我；存取權：任何人。
 *
 * v1.0-preview 變更：
 * - 每個 POST 回可讀 JSON { ok, receipt_id }：前端以 CORS 讀取後才顯示成功（不再 no-cors 假成功）
 * - 新增 shares 分頁：share_id → attempt／guest／平台／內容類型／上層 share（推薦鏈）；不含任何個資
 * - results／leads 新增 attempt_id、guest_id、ref_share_id、entry_platform、quiz_version、score_version、test_mode 欄位
 * - attempt_id 去重（同一輪結果重送不重複寫入）；test_mode=1 的列另標，正式報表排除
 * - 沿用：欄位白名單、長度上限、數值範圍、公式前綴消毒、LockService；GET 只回彙總
 */
const SHEET_LEADS = 'leads';
const SHEET_RESULTS = 'results';
const SHEET_SHARES = 'shares';
const MAX_STR = 200, MAX_UA = 300, DEDUPE_SCAN = 500; // 去重時往回看幾列

const RESULT_HEADERS = ['ts','age','centerYear','newRate','persona','decade','rightN','variant','challenger','utm','attempt_id','guest_id','ref_share_id','entry_platform','quiz_version','score_version','test_mode','receipt_id'];
const LEAD_HEADERS   = ['ts','email','age','persona','newRate','centerYear','decade','ref','utm','ua','attempt_id','guest_id','test_mode','receipt_id'];
const SHARE_HEADERS  = ['ts','share_id','attempt_id','guest_id','platform','content_type','parent_share_id','quiz_version','test_mode'];

function doPost(e) {
  let p = {};
  try { p = JSON.parse(e.postData.contents); } catch (err) { return out({ ok: false, error: 'bad json' }); }
  if (!p || typeof p !== 'object') return out({ ok: false, error: 'bad payload' });
  const lock = LockService.getScriptLock();
  try { lock.waitLock(5000); } catch (err) { return out({ ok: false, error: 'busy' }); }
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const receipt = Utilities.getUuid().slice(0, 8);
    const common = { attempt: id(p.attempt_id), guest: id(p.guest_id), test: p.test_mode ? 1 : 0 };

    if (p.type === 'result') {
      const age = num(p.age, 0, 120), centerYear = num(p.centerYear, 1990, 2030), newRate = num(p.newRate, 0, 100), rightN = num(p.rightN, 0, 15);
      if (age === null || centerYear === null) return out({ ok: false, error: 'bad result' });
      const sh = getSheet(ss, SHEET_RESULTS, RESULT_HEADERS);
      const dup = common.attempt && findRecent(sh, RESULT_HEADERS.indexOf('attempt_id'), common.attempt);
      if (dup) return out({ ok: true, receipt_id: dup, duplicate: true });
      sh.appendRow([new Date().toISOString(), age, centerYear, newRate, str(p.persona, 30), str(p.decade, 30), rightN, str(p.variant, 20), num(p.challenger, 0, 120), str(p.utm, MAX_STR),
        common.attempt, common.guest, id(p.ref_share_id), str(p.entry_platform, 20), str(p.quiz_version, 30), str(p.score_version, 10), common.test, receipt]);
      return out({ ok: true, receipt_id: receipt });
    }
    if (p.type === 'share') {
      const sid = id(p.share_id); if (!sid) return out({ ok: false, error: 'bad share' });
      const sh = getSheet(ss, SHEET_SHARES, SHARE_HEADERS);
      if (findRecent(sh, SHARE_HEADERS.indexOf('share_id'), sid)) return out({ ok: true, receipt_id: sid, duplicate: true });
      sh.appendRow([new Date().toISOString(), sid, common.attempt, common.guest, str(p.platform, 20), str(p.content_type, 20), id(p.parent_share_id), str(p.quiz_version, 30), common.test]);
      return out({ ok: true, receipt_id: sid });
    }
    if (p.email) {
      const email = String(p.email).toLowerCase().trim();
      if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return out({ ok: false, error: 'bad email' });
      const sh = getSheet(ss, SHEET_LEADS, LEAD_HEADERS);
      sh.appendRow([new Date().toISOString(), email, num(p.age, 0, 120), str(p.persona, 30), num(p.newRate, 0, 100), num(p.centerYear, 1990, 2030), str(p.decade, 30), str(p.ref, MAX_STR), str(p.utm, MAX_STR), str(p.ua, MAX_UA),
        common.attempt, common.guest, common.test, receipt]);
      return out({ ok: true, receipt_id: receipt });
    }
    return out({ ok: false, error: 'unknown type' });
  } finally { lock.releaseLock(); }
}

// GET：只回彙總（排除 test_mode=1）
function doGet(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(SHEET_RESULTS);
  if (!sh || sh.getLastRow() < 2) return out({ count: 0, mean: 0, sd: 0 });
  const lastCol = Math.max(sh.getLastColumn(), 2);
  const data = sh.getRange(2, 1, sh.getLastRow() - 1, lastCol).getValues();
  const header = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  const ti = header.indexOf('test_mode');
  const ages = data.filter(r => ti < 0 || Number(r[ti]) !== 1).map(r => Number(r[1])).filter(a => a > 0);
  if (!ages.length) return out({ count: 0, mean: 0, sd: 0 });
  const mean = ages.reduce((a, b) => a + b, 0) / ages.length;
  const sd = Math.sqrt(ages.reduce((a, b) => a + (b - mean) ** 2, 0) / ages.length);
  return out({ count: ages.length, mean: round1(mean), sd: round1(sd) });
}

// ---- 工具 ----
function num(v, min, max) { if (v === null || v === undefined || v === '') return null; const n = Number(v); return (isFinite(n) && n >= min && n <= max) ? n : null; }
function str(v, max) { if (v === null || v === undefined) return ''; let t = String(v).slice(0, max); if (/^[=+\-@]/.test(t)) t = "'" + t; return t; }
function id(v) { const t = String(v || '').trim(); return /^[a-z0-9]{6,24}$/i.test(t) ? t : ''; } // 站內隨機 id：只收英數 6–24 碼
// 往回掃最近 N 列找同值（去重）；回傳該列的 receipt／id 或 null
function findRecent(sh, col, value) {
  const last = sh.getLastRow(); if (last < 2 || !value) return null;
  const n = Math.min(DEDUPE_SCAN, last - 1), rows = sh.getRange(last - n + 1, 1, n, sh.getLastColumn()).getValues();
  for (let i = rows.length - 1; i >= 0; i--) if (String(rows[i][col]) === value) return String(rows[i][rows[i].length - 1] || value);
  return null;
}
function getSheet(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.appendRow(headers); sh.setFrozenRows(1); return sh; }
  // 既有分頁缺新欄位時補標題（不動舊資料）
  const cur = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0].filter(String);
  if (cur.length < headers.length) sh.getRange(1, cur.length + 1, 1, headers.length - cur.length).setValues([headers.slice(cur.length)]);
  return sh;
}
function round1(x) { return Math.round(x * 10) / 10; }
function out(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
