/**
 * WEiZ 數位年齡測驗 — Apps Script 後端 v1.2（名單 + 結果 + 答題明細 + 事件 + 題目清單／統計 + 分享歸因）
 * 部署：Google 試算表 → 擴充功能 → Apps Script → 全部取代成這份 → 部署 → 管理部署作業 → 鉛筆 → 版本「新版本」→ 部署（網址不變）
 *      執行身分：我；存取權：任何人。
 * 第一次部署後，可在編輯器手動執行一次 setupSheets()（會建立 questions／question_stats／answers／events 分頁）；
 * 不執行也沒關係，第一筆資料進來時會自動建立。
 *
 * v1.2 變更：
 * - results 新增：duration_ms、streak_max、timeout_n、avg_ms、device、os、browser、screen_h、referrer_host、lang、tz、visit_n、retake_n、decade_skipped、sound_mode、tags
 * - leads 新增：tags、device（寄信分眾用）
 * - 新增 answers 分頁：每題一列（題號、順序、選的選項、對錯、超時、反應毫秒）
 * - 新增 events 分頁：分享、證書、優惠面板、LINE、Logo、小知識、結果頁停留等行為事件
 * - 新增 questions 分頁（50 題清單，依題庫版本自動寫入）與 question_stats 分頁（公式：作答數、答對率、超時率、平均秒數、選項分布）
 * - GET 回 version，方便 verify-backend.sh 判別版本
 * - 沿用：欄位白名單、長度上限、數值範圍、公式前綴消毒、LockService、attempt 去重、test_mode 排除
 */
const GS_VERSION = 'v1.2';
const QUIZ_VERSION_SEED = '2026-09-12.v1';
const SHEET_LEADS = 'leads', SHEET_RESULTS = 'results', SHEET_SHARES = 'shares', SHEET_ANSWERS = 'answers', SHEET_EVENTS = 'events', SHEET_QUESTIONS = 'questions', SHEET_QSTATS = 'question_stats';
const MAX_STR = 200, MAX_UA = 300, DEDUPE_SCAN = 500;

// 既有分頁的舊欄位順序不能動，新欄位一律接在最後（getSheet 會自動補標題）
const RESULT_HEADERS = ['ts','age','centerYear','newRate','persona','decade','rightN','variant','challenger','utm','attempt_id','guest_id','ref_share_id','entry_platform','quiz_version','score_version','test_mode','receipt_id',
  'duration_ms','streak_max','timeout_n','avg_ms','device','os','browser','screen_h','referrer_host','lang','tz','visit_n','retake_n','decade_skipped','sound_mode','tags'];
const LEAD_HEADERS   = ['ts','email','age','persona','newRate','centerYear','decade','ref','utm','ua','attempt_id','guest_id','test_mode','receipt_id','tags','device'];
const SHARE_HEADERS  = ['ts','share_id','attempt_id','guest_id','platform','content_type','parent_share_id','quiz_version','test_mode'];
const ANSWER_HEADERS = ['ts','attempt_id','guest_id','q_id','era','year','difficulty','pos','chosen','correct','timed_out','ms','quiz_version','test_mode'];
const EVENT_HEADERS  = ['ts','attempt_id','guest_id','event','detail','quiz_version','test_mode','client_ts'];
const QUESTION_HEADERS = ['q_id','era','era_label','year','category','difficulty','question','A','B','C','D','answer','answer_text','keyword','quiz_version'];
const ERA_LABEL = {"1995-2004": "撥接時代", "2005-2010": "MSN 時代", "2011-2016": "LINE 時代", "2017-2021": "5G 前夕", "2022-2026": "AI 時代"};
// 題目清單（與前端題庫同版；[id, era, year, category, difficulty, 題目, [A,B,C,D], 正解索引, 關鍵字]）
const QUESTIONS = [[1,"1995-2004",2000,"平台",1,"「小蕃薯」是給誰用的網站？",["看股票","菜市場叫貨","計程車叫車","小朋友的入口網站，玩遊戲交筆友"],3,"小蕃薯"],[2,"1995-2004",2004,"平台",1,"無名小站當年最紅的功能是？",["線上叫車","美食外送","網路相簿＋部落格","短影音"],2,"無名小站"],[3,"1995-2004",1996,"通訊",1,"B.B. Call 能傳照片嗎？",["可以，黑白照","可以，彩色照","不能，只能顯示數字或短文字","可以，還能傳影片"],2,"B.B. Call"],[4,"1995-2004",1996,"通訊",2,"B.B. Call 數字暗語「7456」是什麼意思？",["生日快樂","我愛你","去洗澡吧","氣死我了"],3,"B.B. Call 暗語"],[5,"1995-2004",1997,"通訊",1,"家裡在撥接上網時，電話會怎樣？",["完全沒影響","鈴聲變大","費率變便宜","占線，別人打不進來"],3,"撥接上網"],[6,"1995-2004",1998,"硬體",2,"一片 3.5 吋磁碟片存得下一首 MP3 嗎？",["存不下，只有 1.44MB","剛好一首","能存一部電影","能存一張專輯"],0,"3.5 吋磁碟片"],[7,"1995-2004",1999,"網路文化",2,"當年光華商場說的「大補帖」是指？",["補習班講義","遊戲攻略本","中藥補品","盜版軟體合輯光碟"],3,"大補帖"],[8,"1995-2004",1998,"軟體",1,"ICQ 的「Uh-oh!」什麼時候會響？",["斷線時","收到訊息時","開機時","對方下線時"],1,"ICQ"],[9,"1995-2004",2000,"網路文化",1,"當年網咖裡最常聽到的遊戲是？",["王者榮耀","傳說對決","世紀帝國、CS","原神"],2,"網咖"],[10,"1995-2004",2001,"硬體",1,"燒壞的光碟片大家都拿來當什麼？",["鏡子","菜刀","滑鼠墊","飛盤、杯墊"],3,"光碟片"],[11,"2005-2010",2006,"軟體",1,"MSN 按「震動」會發生什麼？",["自動播歌","對方手機震動","對方的視窗整個晃動","對方螢幕變黑"],2,"MSN"],[12,"2005-2010",2006,"網路文化",1,"MSN 暱稱大家都拿來寫什麼？",["什麼都不寫","電話號碼","心情文字、歌詞和符號","本名"],2,"MSN 暱稱"],[13,"2005-2010",2009,"網路文化",1,"「開心農場」讓大家半夜爬起來做什麼？",["偷朋友的菜","寫作業","買股票","看新聞"],0,"開心農場"],[14,"2005-2010",2005,"平台",1,"Yahoo!奇摩「知識+」是做什麼的？",["看影片","線上聊天","買東西","發問和回答問題賺點數"],3,"知識+"],[15,"2005-2010",2005,"通訊",2,"用 PHS 手機最常發生什麼？",["收不到簡訊","電池爆炸","太重拿不動","進電梯就斷訊"],3,"PHS"],[16,"2005-2010",2007,"硬體",1,"Eee PC 小筆電為什麼會紅？",["便宜又輕巧","打遊戲最強","相機最好","螢幕最大"],0,"Eee PC"],[17,"2005-2010",2007,"通訊",2,"第一代 iPhone 沒有什麼？",["觸控螢幕","相機","瀏覽器","App Store"],3,"第一代 iPhone"],[18,"2005-2010",2008,"通訊",1,"黑莓機（BlackBerry）最有名的特色是？",["無線充電","實體全鍵盤","三鏡頭","摺疊螢幕"],1,"BlackBerry"],[19,"2005-2010",2006,"軟體",1,"當年下載電影音樂大家都開什麼軟體？",["Foxy、BT、eMule","YouTube Music","Netflix","Spotify"],0,"Foxy"],[20,"2005-2010",2007,"硬體",1,"Wii 最經典的玩法是？",["觸控螢幕","戴 VR 頭盔","揮手把打網球、打保齡球","踩方向盤"],2,"Wii"],[21,"2011-2016",2012,"軟體",1,"LINE 剛紅時大家搶著買什麼？",["LINE 主題曲","LINE 點數卡","熊大兔兔貼圖","LINE 手機殼"],2,"LINE 貼圖"],[22,"2011-2016",2013,"網路文化",1,"神魔之塔紅的時候，大家在捷運上都在？",["拍限動","開直播","轉珠","抓寶"],2,"神魔之塔"],[23,"2011-2016",2016,"網路文化",1,"Pokémon GO 剛上市時，北投公園發生什麼事？",["演唱會","上千人半夜衝去抓寶","跨年晚會","花季"],1,"Pokémon GO"],[24,"2011-2016",2015,"網路文化",2,"自拍棒流行時常被禁止帶進哪裡？",["便利商店","捷運","學校","演唱會和博物館"],3,"自拍棒"],[25,"2011-2016",2012,"平台",1,"早期 Instagram 的照片有什麼特色？",["短影音","長文","正方形＋復古濾鏡","語音留言"],2,"Instagram"],[26,"2011-2016",2013,"網路文化",1,"玩 Candy Crush 沒命了怎麼辦？",["等一天","拜託 Facebook 朋友送愛心","打客服","重灌"],1,"Candy Crush"],[27,"2011-2016",2014,"網路文化",1,"「冰桶挑戰」是為了什麼？",["賣冰塊","為漸凍人症募款","洗腦挑戰","減肥"],1,"冰桶挑戰"],[28,"2011-2016",2016,"硬體",1,"Galaxy Note 7 為什麼被禁止帶上飛機？",["干擾訊號","太大放不下","電池會起火","太貴怕被偷"],2,"Galaxy Note 7"],[29,"2011-2016",2013,"通訊",1,"iPhone 5s 讓大家第一次用什麼解鎖？",["指紋","臉","聲音","畫圖形"],0,"Touch ID"],[30,"2011-2016",2014,"通訊",1,"4G 開台後大家最有感的是？",["手機變小","看影片不卡了","電池變大","通話免費"],1,"4G"],[31,"2017-2021",2018,"通訊",1,"eSIM 是什麼？",["加大版 SIM 卡","電子發票","不用實體卡的 SIM","電子錢包"],2,"eSIM"],[32,"2017-2021",2017,"硬體",1,"AirPods 剛出時被笑成什麼？",["耳朵插電動牙刷頭","耳環","鉛筆","棉花棒"],0,"AirPods"],[33,"2017-2021",2021,"軟體",1,"疫情期間的「實聯制」怎麼做？",["寫紙本","打電話登記","刷健保卡","掃 QR Code 傳簡訊到 1922"],3,"實聯制"],[34,"2017-2021",2018,"平台",1,"抖音／TikTok 讓什麼變流行？",["長文章","15 秒短影音跳舞","語音聊天室","電子書"],1,"TikTok"],[35,"2017-2021",2021,"平台",2,"Clubhouse 當年為什麼一碼難求？",["要有邀請碼才能進","要抽籤","太貴","只有 Android"],0,"Clubhouse"],[36,"2017-2021",2020,"硬體",1,"MagSafe 是什麼？",["保險方案","保護貼","iPhone 的磁吸充電","耳機"],2,"MagSafe"],[37,"2017-2021",2021,"網路文化",2,"NFT 熱潮時最有名的頭像是？",["米老鼠","無聊猿","熊大","皮卡丘"],1,"NFT"],[38,"2017-2021",2020,"網路文化",1,"《動物森友會》為什麼在疫情期間爆紅？",["只出手機版","是 VR 遊戲","大家在遊戲裡串門子聚會","完全免費"],2,"動物森友會"],[39,"2017-2021",2018,"硬體",2,"手機盒上寫的「PD 快充」，PD 是指？",["Portable Device","Pixel Density","Personal Data","Power Delivery"],3,"PD 快充"],[40,"2017-2021",2019,"通訊",2,"Wi-Fi 6 最有感的差別是？",["訊號穿三層牆","不用密碼","能無線充電","很多裝置同時連也不卡"],3,"Wi-Fi 6"],[41,"2022-2026",2022,"軟體",1,"ChatGPT 剛紅時大家最愛拿它做什麼？",["寫作業、寫文案","聽音樂","買菜","叫車"],0,"ChatGPT"],[42,"2022-2026",2023,"硬體",1,"iPhone 15 換成了什麼接頭？",["Lightning","USB-C","3.5mm 耳機孔","Micro-USB"],1,"USB-C"],[43,"2022-2026",2023,"硬體",2,"Qi2 磁吸無線充電是跟誰學的？",["Apple MagSafe","Nintendo","Sony","Nokia"],0,"Qi2"],[44,"2022-2026",2023,"平台",1,"Threads 是哪家公司出的？",["X","ByteDance","Google","Meta"],3,"Threads"],[45,"2022-2026",2024,"硬體",2,"「AI PC」強調內建什麼處理器？",["CRT","NPU","HDD","光碟機"],1,"AI PC"],[46,"2022-2026",2024,"硬體",1,"戴上 Apple Vision Pro 之後怎麼操作？",["用鍵盤","用眼睛看＋手指捏","用聲音吼","用遙控器"],1,"Vision Pro"],[47,"2022-2026",2024,"通訊",1,"iPhone 16 側邊多了什麼鍵？",["相機控制鍵","Home 鍵","返回鍵","靜音鍵"],0,"iPhone 16"],[48,"2022-2026",2025,"硬體",2,"Switch 2 的 Joy-Con 怎麼裝上主機？",["磁吸","螺絲鎖","黏的","滑軌卡入"],0,"Switch 2"],[49,"2022-2026",2023,"網路文化",1,"AI 生圖普及後大家開始擔心什麼？",["假圖假影片分不出來","螢幕太亮","網速太慢","電腦太熱"],0,"AI 生圖"],[50,"2022-2026",2025,"軟體",2,"「Vibe coding」是什麼？",["用講話叫 AI 寫程式","一種直播","一種音樂類型","一種舞蹈"],0,"Vibe coding"]];

function doPost(e) {
  let p = {};
  try { p = JSON.parse(e.postData.contents); } catch (err) { return out({ ok: false, error: 'bad json' }); }
  if (!p || typeof p !== 'object') return out({ ok: false, error: 'bad payload' });
  const lock = LockService.getScriptLock();
  try { lock.waitLock(5000); } catch (err) { return out({ ok: false, error: 'busy' }); }
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    ensureSetup(ss);
    const receipt = Utilities.getUuid().slice(0, 8);
    const common = { attempt: id(p.attempt_id), guest: id(p.guest_id), test: p.test_mode ? 1 : 0, qv: str(p.quiz_version, 30) };

    if (p.type === 'result') {
      const age = num(p.age, 0, 120), centerYear = num(p.centerYear, 1990, 2030), newRate = num(p.newRate, 0, 100), rightN = num(p.rightN, 0, 15);
      if (age === null || centerYear === null) return out({ ok: false, error: 'bad result' });
      const sh = getSheet(ss, SHEET_RESULTS, RESULT_HEADERS);
      const dup = common.attempt && findRecent(sh, RESULT_HEADERS.indexOf('attempt_id'), common.attempt, RESULT_HEADERS.indexOf('receipt_id'));
      if (dup) return out({ ok: true, receipt_id: dup, duplicate: true });
      sh.appendRow([new Date().toISOString(), age, centerYear, newRate, str(p.persona, 30), str(p.decade, 30), rightN, str(p.variant, 20), num(p.challenger, 0, 120), str(p.utm, MAX_STR),
        common.attempt, common.guest, id(p.ref_share_id), str(p.entry_platform, 20), common.qv, str(p.score_version, 10), common.test, receipt,
        num(p.duration_ms, 0, 3600000), num(p.streak_max, 0, 15), num(p.timeout_n, 0, 15), num(p.avg_ms, 0, 60000), str(p.device, 10), str(p.os, 10), str(p.browser, 12), num(p.screen_h, 0, 10000),
        str(p.referrer_host, 80), str(p.lang, 12), str(p.tz, 40), num(p.visit_n, 0, 100000), num(p.retake_n, 0, 100000), num(p.decade_skipped, 0, 1), num(p.sound_mode, 0, 2), tags(p.tags)]);
      return out({ ok: true, receipt_id: receipt });
    }
    if (p.type === 'answers') {
      if (!common.attempt || !Array.isArray(p.rows) || !p.rows.length) return out({ ok: false, error: 'bad answers' });
      const sh = getSheet(ss, SHEET_ANSWERS, ANSWER_HEADERS);
      if (findRecent(sh, ANSWER_HEADERS.indexOf('attempt_id'), common.attempt, ANSWER_HEADERS.indexOf('attempt_id'))) return out({ ok: true, receipt_id: common.attempt, duplicate: true });
      const ts = new Date().toISOString();
      const rows = p.rows.slice(0, 20).map(r => [ts, common.attempt, common.guest, num(r.q_id, 1, 9999), str(r.era, 12), num(r.year, 1990, 2030), num(r.difficulty, 1, 5), num(r.pos, 1, 50),
        num(r.chosen, -1, 3), r.correct ? 1 : 0, r.timed_out ? 1 : 0, num(r.ms, 0, 60000), common.qv, common.test]).filter(r => r[3] !== null);
      if (!rows.length) return out({ ok: false, error: 'bad answers' });
      sh.getRange(sh.getLastRow() + 1, 1, rows.length, ANSWER_HEADERS.length).setValues(rows);
      return out({ ok: true, receipt_id: common.attempt, n: rows.length });
    }
    if (p.type === 'event') {
      const list = Array.isArray(p.events) ? p.events.slice(0, 30) : [{ event: p.event, detail: p.detail, ts: p.ts }];
      const sh = getSheet(ss, SHEET_EVENTS, EVENT_HEADERS);
      const ts = new Date().toISOString();
      const rows = list.map(ev => { const name = String(ev && ev.event || '').trim(); if (!/^[a-z_]{2,40}$/.test(name)) return null;
        return [ts, common.attempt, common.guest, name, str(typeof ev.detail === 'string' ? ev.detail : JSON.stringify(ev.detail || {}), MAX_STR), common.qv, common.test, str(ev.ts, 30)]; }).filter(Boolean);
      if (!rows.length) return out({ ok: false, error: 'bad event' });
      sh.getRange(sh.getLastRow() + 1, 1, rows.length, EVENT_HEADERS.length).setValues(rows);
      return out({ ok: true, n: rows.length });
    }
    if (p.type === 'share') {
      const sid = id(p.share_id); if (!sid) return out({ ok: false, error: 'bad share' });
      const sh = getSheet(ss, SHEET_SHARES, SHARE_HEADERS);
      if (findRecent(sh, SHARE_HEADERS.indexOf('share_id'), sid, SHARE_HEADERS.indexOf('share_id'))) return out({ ok: true, receipt_id: sid, duplicate: true });
      sh.appendRow([new Date().toISOString(), sid, common.attempt, common.guest, str(p.platform, 20), str(p.content_type, 20), id(p.parent_share_id), common.qv, common.test]);
      return out({ ok: true, receipt_id: sid });
    }
    if (p.email) {
      const email = String(p.email).toLowerCase().trim();
      if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return out({ ok: false, error: 'bad email' });
      const sh = getSheet(ss, SHEET_LEADS, LEAD_HEADERS);
      sh.appendRow([new Date().toISOString(), email, num(p.age, 0, 120), str(p.persona, 30), num(p.newRate, 0, 100), num(p.centerYear, 1990, 2030), str(p.decade, 30), str(p.ref, MAX_STR), str(p.utm, MAX_STR), str(p.ua, MAX_UA),
        common.attempt, common.guest, common.test, receipt, tags(p.tags), str(p.device, 40)]);
      return out({ ok: true, receipt_id: receipt });
    }
    return out({ ok: false, error: 'unknown type' });
  } finally { lock.releaseLock(); }
}

// GET：只回彙總（排除 test_mode=1）＋版本
function doGet(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(SHEET_RESULTS);
  if (!sh || sh.getLastRow() < 2) return out({ count: 0, mean: 0, sd: 0, version: GS_VERSION });
  const lastCol = Math.max(sh.getLastColumn(), 2);
  const data = sh.getRange(2, 1, sh.getLastRow() - 1, lastCol).getValues();
  const header = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  const ti = header.indexOf('test_mode');
  const ages = data.filter(r => ti < 0 || Number(r[ti]) !== 1).map(r => Number(r[1])).filter(a => a > 0);
  if (!ages.length) return out({ count: 0, mean: 0, sd: 0, version: GS_VERSION });
  const mean = ages.reduce((a, b) => a + b, 0) / ages.length;
  const sd = Math.sqrt(ages.reduce((a, b) => a + (b - mean) ** 2, 0) / ages.length);
  return out({ count: ages.length, mean: round1(mean), sd: round1(sd), version: GS_VERSION });
}

// ---- 分頁初始化：題目清單與統計公式（依題庫版本只做一次；也可在編輯器手動執行 setupSheets）----
function setupSheets() { const ss = SpreadsheetApp.getActiveSpreadsheet(); PropertiesService.getScriptProperties().deleteProperty('setup_version'); ensureSetup(ss); return 'ok'; }
function ensureSetup(ss) {
  const props = PropertiesService.getScriptProperties();
  const key = GS_VERSION + '/' + QUIZ_VERSION_SEED;
  if (props.getProperty('setup_version') === key) return;
  getSheet(ss, SHEET_RESULTS, RESULT_HEADERS); getSheet(ss, SHEET_LEADS, LEAD_HEADERS); getSheet(ss, SHEET_SHARES, SHARE_HEADERS);
  getSheet(ss, SHEET_ANSWERS, ANSWER_HEADERS); getSheet(ss, SHEET_EVENTS, EVENT_HEADERS);
  seedQuestions(ss); ensureStats(ss);
  props.setProperty('setup_version', key);
}
function seedQuestions(ss) {
  const sh = getSheet(ss, SHEET_QUESTIONS, QUESTION_HEADERS);
  // 同版本已寫過就不重複；不同版本追加（保留舊版供對照）
  const last = sh.getLastRow();
  if (last >= 2) { const vs = sh.getRange(2, QUESTION_HEADERS.length, last - 1, 1).getValues().map(r => String(r[0])); if (vs.indexOf(QUIZ_VERSION_SEED) >= 0) return; }
  const rows = QUESTIONS.map(q => [q[0], q[1], ERA_LABEL[q[1]] || '', q[2], q[3], q[4], q[5], q[6][0], q[6][1], q[6][2], q[6][3], 'ABCD'[q[7]], q[6][q[7]], q[8], QUIZ_VERSION_SEED]);
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, QUESTION_HEADERS.length).setValues(rows);
}
function ensureStats(ss) {
  if (ss.getSheetByName(SHEET_QSTATS)) return;
  const sh = ss.insertSheet(SHEET_QSTATS);
  const headers = ['q_id','era','question','answer','answered','correct_rate','timeout_rate','avg_sec','pick_A','pick_B','pick_C','pick_D'];
  sh.appendRow(headers); sh.setFrozenRows(1);
  // answers 分頁欄位：D=q_id I=chosen J=correct K=timed_out L=ms N=test_mode（正式報表排除 test_mode=1）
  const rows = QUESTIONS.map((q, i) => { const r = i + 2; const base = `answers!$D:$D,$A${r},answers!$N:$N,0`;
    return [q[0], ERA_LABEL[q[1]] || q[1], q[5], 'ABCD'[q[7]],
      `=COUNTIFS(${base})`,
      `=IF(E${r}=0,"",COUNTIFS(${base},answers!$J:$J,1)/E${r})`,
      `=IF(E${r}=0,"",COUNTIFS(${base},answers!$K:$K,1)/E${r})`,
      `=IFERROR(ROUND(AVERAGEIFS(answers!$L:$L,answers!$D:$D,$A${r},answers!$N:$N,0,answers!$K:$K,0)/1000,1),"")`,
      `=IF(E${r}=0,"",COUNTIFS(${base},answers!$I:$I,0)/E${r})`,
      `=IF(E${r}=0,"",COUNTIFS(${base},answers!$I:$I,1)/E${r})`,
      `=IF(E${r}=0,"",COUNTIFS(${base},answers!$I:$I,2)/E${r})`,
      `=IF(E${r}=0,"",COUNTIFS(${base},answers!$I:$I,3)/E${r})`]; });
  sh.getRange(2, 1, rows.length, headers.length).setValues(rows);
  sh.getRange(2, 6, rows.length, 2).setNumberFormat('0.0%'); sh.getRange(2, 9, rows.length, 4).setNumberFormat('0%');
  sh.autoResizeColumns(1, 4);
}

// ---- 工具 ----
function num(v, min, max) { if (v === null || v === undefined || v === '') return null; const n = Number(v); return (isFinite(n) && n >= min && n <= max) ? n : null; }
function str(v, max) { if (v === null || v === undefined) return ''; let t = String(v).slice(0, max); if (/^[=+\-@]/.test(t)) t = "'" + t; return t; }
function id(v) { const t = String(v || '').trim(); return /^[a-z0-9]{6,24}$/i.test(t) ? t : ''; }
function tags(v) { return String(v || '').split(',').map(t => t.trim()).filter(t => /^[a-z0-9_一-鿿]{1,24}$/i.test(t)).slice(0, 20).join(','); } // 只收英數／中文標籤
// 往回掃最近 N 列找同值（去重）；回傳 retCol 欄的值（收件編號）或 null
function findRecent(sh, col, value, retCol) {
  const last = sh.getLastRow(); if (last < 2 || !value) return null;
  const n = Math.min(DEDUPE_SCAN, last - 1), rows = sh.getRange(last - n + 1, 1, n, sh.getLastColumn()).getValues();
  for (let i = rows.length - 1; i >= 0; i--) if (String(rows[i][col]) === value) return String(rows[i][retCol] || value);
  return null;
}
function getSheet(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.appendRow(headers); sh.setFrozenRows(1); return sh; }
  const cur = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0].filter(String);
  if (cur.length < headers.length) sh.getRange(1, cur.length + 1, 1, headers.length - cur.length).setValues([headers.slice(cur.length)]);
  return sh;
}
function round1(x) { return Math.round(x * 10) / 10; }
function out(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
