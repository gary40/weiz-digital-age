/**
 * WEiZ 數位年齡測驗 — Apps Script 後端（名單 + 匿名統計）
 * 部署：Google 試算表 → 擴充功能 → Apps Script → 貼上 → 部署 → 新增部署作業 → 網頁應用程式
 *      執行身分：我；存取權：任何人。取得網址後填進 index.html 的 LEAD_ENDPOINT 與 STATS_ENDPOINT（兩者同一網址）。
 */
const SHEET_LEADS = 'leads';     // Email 名單
const SHEET_RESULTS = 'results'; // 匿名作答結果

function doPost(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let p = {};
  try { p = JSON.parse(e.postData.contents); } catch (err) { return out({ ok: false, error: 'bad json' }); }
  if (p.type === 'result') {
    const sh = getSheet(ss, SHEET_RESULTS, ['ts','age','centerYear','newRate','persona','decade','rightN','variant','challenger','utm']);
    sh.appendRow([p.ts || new Date().toISOString(), p.age, p.centerYear, p.newRate, p.persona, p.decade, p.rightN, p.variant, p.challenger, p.utm]);
  } else if (p.email) {
    const sh = getSheet(ss, SHEET_LEADS, ['ts','email','age','persona','newRate','centerYear','decade','ref','utm','ua']);
    sh.appendRow([p.ts || new Date().toISOString(), String(p.email).toLowerCase().trim(), p.age, p.persona, p.newRate, p.centerYear, p.decade, p.ref, p.utm, p.ua]);
  }
  return out({ ok: true });
}

// GET：回傳統計給前端（count / mean / sd），另附 ?rows=1 給後台抓明細
function doGet(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(SHEET_RESULTS);
  if (!sh || sh.getLastRow() < 2) return out({ count: 0, mean: 0, sd: 0 });
  const data = sh.getRange(2, 1, sh.getLastRow() - 1, 10).getValues();
  const ages = data.map(r => Number(r[1])).filter(a => a > 0);
  const mean = ages.reduce((a, b) => a + b, 0) / ages.length;
  const sd = Math.sqrt(ages.reduce((a, b) => a + (b - mean) ** 2, 0) / ages.length);
  const res = { count: ages.length, mean: round1(mean), sd: round1(sd) };
  if (e && e.parameter && e.parameter.rows === '1') {
    res.rows = data.map(r => ({ ts: r[0], age: r[1], centerYear: r[2], newRate: r[3], persona: r[4], decade: r[5], rightN: r[6], variant: r[7], challenger: r[8], utm: r[9] }));
  }
  return out(res);
}

function getSheet(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.appendRow(headers); sh.setFrozenRows(1); }
  return sh;
}
function round1(x) { return Math.round(x * 10) / 10; }
function out(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
