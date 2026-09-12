/**
 * WEiZ 數位年齡測驗 — Apps Script 後端（名單 + 匿名統計）v0-beta.2
 * 部署：Google 試算表 → 擴充功能 → Apps Script → 貼上 → 部署 → 新增部署作業 → 網頁應用程式
 *      執行身分：我；存取權：任何人。取得網址後填進 index.html 的 LEAD_ENDPOINT 與 STATS_ENDPOINT（兩者同一網址）。
 * 更新程式後：部署 → 管理部署作業 → 鉛筆 → 版本選「新版本」→ 部署（網址不變）。
 *
 * v0-beta.2 安全調整：
 * - 移除公開 ?rows=1 明細輸出（管理者直接看試算表）
 * - POST 只收白名單欄位、字串長度上限、數值範圍檢查、去除公式前綴，避免試算表公式注入
 * - 加 LockService 避免同時寫入互相覆蓋
 */
const SHEET_LEADS = 'leads';     // Email 名單
const SHEET_RESULTS = 'results'; // 匿名作答結果
const MAX_STR = 200;             // 一般字串欄位長度上限
const MAX_UA = 300;              // User-Agent 長度上限

function doPost(e) {
  let p = {};
  try { p = JSON.parse(e.postData.contents); } catch (err) { return out({ ok: false, error: 'bad json' }); }
  if (!p || typeof p !== 'object') return out({ ok: false, error: 'bad payload' });

  const lock = LockService.getScriptLock();
  try { lock.waitLock(5000); } catch (err) { return out({ ok: false, error: 'busy' }); }
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (p.type === 'result') {
      const age = num(p.age, 0, 120), centerYear = num(p.centerYear, 1990, 2030), newRate = num(p.newRate, 0, 100), rightN = num(p.rightN, 0, 15);
      if (age === null || centerYear === null) return out({ ok: false, error: 'bad result' });
      const sh = getSheet(ss, SHEET_RESULTS, ['ts','age','centerYear','newRate','persona','decade','rightN','variant','challenger','utm']);
      sh.appendRow([new Date().toISOString(), age, centerYear, newRate, str(p.persona, 30), str(p.decade, 30), rightN, str(p.variant, 20), num(p.challenger, 0, 120), str(p.utm, MAX_STR)]);
      return out({ ok: true });
    }
    if (p.email) {
      const email = String(p.email).toLowerCase().trim();
      if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return out({ ok: false, error: 'bad email' });
      const sh = getSheet(ss, SHEET_LEADS, ['ts','email','age','persona','newRate','centerYear','decade','ref','utm','ua']);
      sh.appendRow([new Date().toISOString(), email, num(p.age, 0, 120), str(p.persona, 30), num(p.newRate, 0, 100), num(p.centerYear, 1990, 2030), str(p.decade, 30), str(p.ref, MAX_STR), str(p.utm, MAX_STR), str(p.ua, MAX_UA)]);
      return out({ ok: true });
    }
    return out({ ok: false, error: 'unknown type' });
  } finally { lock.releaseLock(); }
}

// GET：只回彙總統計給前端（count / mean / sd），不再提供明細
function doGet(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(SHEET_RESULTS);
  if (!sh || sh.getLastRow() < 2) return out({ count: 0, mean: 0, sd: 0 });
  const data = sh.getRange(2, 2, sh.getLastRow() - 1, 1).getValues(); // 只讀 age 欄
  const ages = data.map(r => Number(r[0])).filter(a => a > 0);
  if (!ages.length) return out({ count: 0, mean: 0, sd: 0 });
  const mean = ages.reduce((a, b) => a + b, 0) / ages.length;
  const sd = Math.sqrt(ages.reduce((a, b) => a + (b - mean) ** 2, 0) / ages.length);
  return out({ count: ages.length, mean: round1(mean), sd: round1(sd) });
}

// ---- 工具 ----
// 數值：非數字或超出範圍回 null（不寫入奇怪的值）
function num(v, min, max) { if (v === null || v === undefined || v === '') return null; const n = Number(v); return (isFinite(n) && n >= min && n <= max) ? n : null; }
// 字串：轉字串、截長、去掉會被試算表當公式的開頭字元（= + - @），避免公式注入
function str(v, max) { if (v === null || v === undefined) return ''; let t = String(v).slice(0, max); if (/^[=+\-@]/.test(t)) t = "'" + t; return t; }
function getSheet(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.appendRow(headers); sh.setFrozenRows(1); }
  return sh;
}
function round1(x) { return Math.round(x * 10) / 10; }
function out(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
