import asyncio, json, time, base64
from playwright.async_api import async_playwright

import os, sys, re
# BROWSER=webkit 可切 WebKit；QUIZ_OFFLINE=1 在無法連 Google Fonts／GTM 的環境把這些請求擋成空回應，避免誤判成頁面錯誤
BROWSER = os.environ.get('BROWSER', 'chromium')
if os.environ.get('QUIZ_OFFLINE'):
    from playwright.async_api import Browser as _B
    _orig_nc = _B.new_context
    async def _nc(self, **kw):
        ctx = await _orig_nc(self, **kw)
        async def _stub(route):
            if 'script.google.com' in route.request.url: await route.fulfill(status=200, body=('{"ok":true,"receipt_id":"stub1234"}' if route.request.method=='POST' else '{"count":0,"mean":0,"sd":0}'), content_type='application/json', headers={'Access-Control-Allow-Origin':'*'})
            else: await route.fulfill(status=200, body='', content_type='text/css')
        await ctx.route(re.compile(r'https://(fonts\.googleapis\.com|fonts\.gstatic\.com|www\.googletagmanager\.com|script\.google\.com)/.*'), _stub)
        return ctx
    _B.new_context = _nc
P = sys.argv[1] if len(sys.argv)>1 else os.environ.get('QUIZ_URL','http://localhost:8080/index.html')
R = []  # (區塊, 測項, 結果, 備註)
def rec(area, name, ok, note=''): R.append((area, name, 'PASS' if ok else 'FAIL', note)); print(('✅' if ok else '❌'), area, '|', name, '|', note)

async def fresh(b, url=P, mobile=True, args=None):
    ctx = await b.new_context(viewport={'width':390,'height':844} if mobile else {'width':1200,'height':900}, device_scale_factor=2, permissions=['clipboard-read','clipboard-write'])
    pg = await ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append('pageerror: '+str(e)))
    pg.on('console', lambda m: errs.append('console: '+m.text) if m.type=='error' and 'googleapis' not in m.text and '403' not in m.text else None)
    await pg.goto(url); await pg.wait_for_timeout(700)
    return ctx, pg, errs

async def to_quiz(pg, decade=2):
    await pg.click('#startBtn'); await pg.wait_for_timeout(350)
    await pg.locator('.decade').nth(decade).click(); await pg.wait_for_timeout(150)
    await pg.click('#enterBtn'); await pg.wait_for_timeout(600)

async def advance(pg, wait=250):  # v0.9：作答後由玩家按「下一題」
    await pg.evaluate("next()"); await pg.wait_for_timeout(wait)

async def answer_all(pg, rule='right', per_step=1300):
    for _ in range(15):
        await pg.evaluate(f"(()=>{{const q=quiz[idx]; const r='{rule}'; const ok = r==='right' ? true : r==='wrong' ? false : r==='new' ? q.year>=2011 : r==='old' ? q.year<=2010 : Math.random()<.5; pick(ok? q.answer : (q.answer+1)%4)}})()")
        await pg.wait_for_timeout(120); await advance(pg, min(per_step, 250))

async def main():
    async with async_playwright() as p:
        b = await (p.chromium.launch(args=['--autoplay-policy=user-gesture-required']) if BROWSER=='chromium' else getattr(p, BROWSER).launch())

        # ---------- A. 載入與首頁 ----------
        ctx, pg, errs = await fresh(b)
        rec('A 載入', 'A1 頁面載入無 JS 錯誤', not errs, '; '.join(errs)[:120])
        rec('A 載入', 'A2 首頁為預設畫面', await pg.evaluate("document.querySelector('.screen.active').id")=='home')
        rec('A 載入', 'A3 素材注入（Logo／吉祥物 src 非空）', await pg.evaluate("[...document.querySelectorAll('[data-asset]')].every(i=>i.src.startsWith('data:image'))"))
        rec('A 載入', 'A4 題庫載入 50 題、5 年代各 10', await pg.evaluate("BANK.length===50 && ERAS.every(e=>BANK.filter(q=>q.era===e).length===10)"))
        rec('A 載入', 'A5 每題 4 選項且 answer 在 0–3', await pg.evaluate("BANK.every(q=>q.options.length===4 && q.answer>=0 && q.answer<=3)"))
        rec('A 載入', 'A6 預設反饋模式 = instant（A/B 關閉）', await pg.evaluate("FEEDBACK_MODE")=='instant')
        st = await pg.evaluate("[soundMode, musicOn, document.querySelector('#musicLbl').textContent, document.querySelector('#home [data-sound]').getAttribute('aria-label')]")
        rec('A 載入', 'A7 音效預設關閉、無障礙名稱一致', st[0]==0 and not st[1] and st[2]=='音效關閉' and '音效關閉' in st[3], str(st))
        await pg.mouse.click(200, 300); await pg.wait_for_timeout(400)
        st2 = await pg.evaluate("[soundMode, musicOn]")
        rec('A 載入', 'A8 點畫面不會自動出聲', st2==[0,False], str(st2))
        await pg.click('#home [data-sound]'); await pg.wait_for_timeout(150); m1 = await pg.evaluate("[soundMode,musicOn]")
        await pg.click('#home [data-sound]'); await pg.wait_for_timeout(400); m2 = await pg.evaluate("[soundMode,musicOn,AC&&AC.state]")
        await pg.click('#home [data-sound]'); await pg.wait_for_timeout(150); m3 = await pg.evaluate("[soundMode,musicOn]")
        saved = await pg.evaluate("JSON.parse(localStorage.getItem('weiz_age_sound'))")
        rec('A 載入', 'A9 音效鈕三態循環 關閉→音效→音效＋音樂→關閉，並記住選擇', m1==[1,False] and m2[:2]==[2,True] and m2[2]=='running' and m3==[0,False] and saved==0, f'{m1} {m2} {m3} saved={saved}')
        await pg.click('#home [data-sound]'); await pg.click('#home [data-sound]'); await pg.wait_for_timeout(300); await pg.reload(); await pg.wait_for_timeout(600)
        rec('A 載入', 'A10 重新整理後保留音效設定', await pg.evaluate("soundMode")==2)
        await ctx.close()

        # ---------- B. 出生年代與抽題 ----------
        for dec in range(5):
            ctx, pg, errs = await fresh(b); await to_quiz(pg, dec)
            got = await pg.evaluate("ERAS.map(e=>quiz.filter(q=>q.era===e).length)")
            plan = await pg.evaluate(f"DRAW_PLAN[{dec}]")
            ids = await pg.evaluate("quiz.map(q=>q.id)")
            rec('B 抽題', f'B{dec+1} 年代 {dec}：抽題數符合計畫 {plan}', got==plan and len(ids)==15 and len(set(ids))==15, f'got={got} 不重複={len(set(ids))}')
            await ctx.close()
        ctx, pg, errs = await fresh(b); await pg.click('#startBtn'); await pg.wait_for_timeout(300)
        await pg.locator('.decade').nth(1).click(); await pg.locator('.decade').nth(3).click(); await pg.wait_for_timeout(600)
        rec('B 抽題', 'B6 年代為單選：改點另一個會換過去，且只有一個被勾選', await pg.evaluate("decade")==3 and await pg.evaluate("[...document.querySelectorAll('.decade[aria-checked=\"true\"]')].length")==1)
        await ctx.close()

        # ---------- C. 作答與解答顯示（核心） ----------
        ctx, pg, errs = await fresh(b); await to_quiz(pg, 2)
        rec('C 作答', 'C1 每題 15 秒', await pg.evaluate("secs")==15)
        rec('C 作答', 'C2 進度條／題號初始', await pg.evaluate("document.querySelector('#qNum').textContent")=='1')
        # 連續 15 題：每題檢查解答標示
        fails = []
        for k in range(15):
            q = await pg.evaluate("quiz[idx]")
            wrong = (k % 3 == 0)
            choice = (q['answer']+1) % 4 if wrong else q['answer']
            await pg.locator('.opt').nth(choice).click()
            await pg.wait_for_timeout(60)
            s = await pg.evaluate("(()=>{const o=[...document.querySelectorAll('.opt')]; return {right:o.findIndex(x=>x.classList.contains('right')), wrong:o.findIndex(x=>x.classList.contains('wrong')), bubble:document.querySelector('#footMsg').className, txt:document.querySelector('#footMsg').textContent, locked, disabled:o.every(x=>x.disabled)}})()")
            ok = s['right']==q['answer'] and (s['wrong']==choice if wrong else s['wrong']==-1) and ('bad' in s['bubble'] if wrong else 'good' in s['bubble']) and s['locked'] and s['disabled'] and len(s['txt'])>3
            if not ok: fails.append((k+1, s))
            # 重複點擊不應改變
            await pg.locator('.opt').nth((choice+2)%4).click(force=True, timeout=2000); await pg.wait_for_timeout(30)
            s2 = await pg.evaluate("answers.length")
            if s2 != k+1: fails.append((k+1, 'double-pick recorded'))
            nb = await pg.evaluate("(()=>{const n=document.querySelector('#nextBtn'); return {shown:!n.hidden, label:n.textContent.trim()}})()")
            if not nb['shown'] or (k==14 and '看結果' not in nb['label']): fails.append((k+1, f'next button {nb}'))
            await pg.click('#nextBtn'); await pg.wait_for_timeout(300)
            nq = await pg.evaluate("idx")
            if k < 14 and nq != k+1: fails.append((k+1, f'did not advance idx={nq}'))
        rec('C 作答', 'C3 15 題逐題：正解亮綠／錯選亮紅／文字回饋／鎖定／下一題鈕', not fails, str(fails)[:200])
        rec('C 作答', 'C4 重複點擊不重複計分', all('double' not in str(f) for f in fails))
        await pg.wait_for_timeout(4800)
        rec('C 作答', 'C5 15 題後進入結果頁', await pg.evaluate("document.querySelector('.screen.active').id")=='result')
        await ctx.close()

        # 超時路徑
        ctx, pg, errs = await fresh(b); await to_quiz(pg, 2)
        await pg.evaluate("deadline = performance.now()+400"); await pg.wait_for_timeout(700)
        s = await pg.evaluate("(()=>{const o=[...document.querySelectorAll('.opt')]; return {right:o.findIndex(x=>x.classList.contains('right')), ans:quiz[idx].answer, to:answers[0]&&answers[0].timedOut, msg:document.querySelector('#footMsg').textContent, mascot:document.querySelector('#qMascot').src===ASSETS.m_sleep}})()")
        rec('C 作答', 'C6 超時：顯示正解、記錄 timedOut、太空人睡著、文案', s['right']==s['ans'] and s['to'] and s['mascot'] and '時間到' in s['msg'], str({k:v for k,v in s.items() if k!='msg'}))
        shown = await pg.evaluate("!document.querySelector('#nextBtn').hidden"); await pg.click('#nextBtn'); await pg.wait_for_timeout(300)
        rec('C 作答', 'C7 超時後出現下一題鈕，按下進入第 2 題', shown and await pg.evaluate("idx")==1)
        # 倒數最後 3 秒轉紅
        await pg.evaluate("deadline = performance.now()+2500"); await pg.wait_for_timeout(200)
        rec('C 作答', 'C8 最後 3 秒倒數環 hot 狀態', await pg.evaluate("document.querySelector('#timer').classList.contains('hot')"))
        # 鍵盤作答
        await pg.evaluate("clearInterval(timerId); deadline=performance.now()+15000; startTimer()"); await pg.keyboard.press('B'); await pg.wait_for_timeout(80)
        rec('C 作答', 'C9 鍵盤 A–D 可作答', await pg.evaluate("answers.length")==2 and await pg.evaluate("answers[1].chosen")==1)
        # 連對 streak
        await advance(pg)
        for _ in range(3):
            await pg.evaluate("pick(quiz[idx].answer)"); await pg.wait_for_timeout(100); await advance(pg)
        await pg.evaluate("pick(quiz[idx].answer)"); await pg.wait_for_timeout(80)
        rec('C 作答', 'C10 連對 ≥3 顯示🔥', await pg.evaluate("document.querySelector('#streak').classList.contains('show')"))
        await ctx.close()

        # 快速重測不殘留計時器
        ctx, pg, errs = await fresh(b); await to_quiz(pg, 2)
        await pg.evaluate("pick(quiz[idx].answer)"); await pg.wait_for_timeout(200)
        await pg.evaluate("start()"); await pg.wait_for_timeout(200); await pg.locator('.decade').nth(0).click(); await pg.click('#enterBtn'); await pg.wait_for_timeout(700)
        await pg.wait_for_timeout(1300)
        rec('C 作答', 'C11 反饋中按再測，舊計時器不會把新第 1 題跳掉', await pg.evaluate("idx")==0 and await pg.evaluate("document.querySelector('#qNum').textContent")=='1', f"idx={await pg.evaluate('idx')}")
        # 離開確認
        await pg.click('#quiz [data-back]'); await pg.wait_for_timeout(200)
        m_open = await pg.evaluate("document.querySelector('#leaveModal').classList.contains('show')")
        await pg.click('#stayBtn'); await pg.wait_for_timeout(200)
        stayed = await pg.evaluate("document.querySelector('.screen.active').id")=='quiz' and await pg.evaluate("idx")==0
        await pg.click('#quiz [data-back]'); await pg.wait_for_timeout(200); await pg.click('#leaveBtn'); await pg.wait_for_timeout(300)
        rec('C 作答', 'C11b 作答中按返回先確認：繼續作答不丟進度、離開回首頁', m_open and stayed and await pg.evaluate("document.querySelector('.screen.active').id")=='home')
        await ctx.close()
        # 略過出生年代
        ctx, pg, errs = await fresh(b); await pg.click('#startBtn'); await pg.wait_for_timeout(300); await pg.click('#skipBtn'); await pg.wait_for_timeout(700)
        ok_skip = await pg.evaluate("decade")==-1 and await pg.evaluate("document.querySelector('.screen.active').id")=='quiz'
        await answer_all(pg, 'rand'); await pg.wait_for_timeout(4800)
        r = await pg.evaluate("({screen:document.querySelector('.screen.active').id, gap:document.querySelector('#rGap').textContent, hash:location.hash, age:+document.querySelector('#rAge').textContent})")
        rec('C 作答', 'C11c 略過出生年代可完整完成，結果不宣稱年齡差、hash 帶 d=-1', ok_skip and r['screen']=='result' and r['gap']=='' and 'd=-1' in r['hash'] and r['age']>0 and not errs, str(r)[:100])
        await ctx.close()

        # 版面穩定：10 題量測關鍵元素位置
        ctx, pg, errs = await fresh(b); await to_quiz(pg, 2)
        await pg.wait_for_timeout(500)  # 等進場動畫（screenIn／fade 約 .4s）結束再量，避免量到 transform 中的位置
        boxes = []
        for _ in range(10):
            bb = await pg.evaluate("['#eraTag','#qText','#options','.quiz-foot'].map(s=>{const r=document.querySelector(s).getBoundingClientRect(); return [Math.round(r.top),Math.round(r.height)]})")
            boxes.append(bb); await pg.evaluate("clearInterval(timerId); idx++; render()"); await pg.wait_for_timeout(450)
        stable = all(b_==boxes[0] for b_ in boxes)
        rec('C 作答', 'C12 版面固定：10 題視覺區／題目／選項／頁尾位置完全一致', stable, str(boxes[0]) if stable else str(boxes[:3]))
        clip = await pg.evaluate("[...document.querySelectorAll('.opt>span:nth-child(2)')].some(s=>s.scrollHeight>s.clientHeight+2)")
        rec('C 作答', 'C13 選項文字無溢出裁切（抽樣 10 題）', not clip)
        await ctx.close()

        # ---------- D. 計分與結果 ----------
        cases = [(1,'new','younger'),(4,'old','older'),(3,'right','match'),(2,'wrong','none-or-match')]
        for dec, rule, expect in cases:
            ctx, pg, errs = await fresh(b); await to_quiz(pg, dec)
            await answer_all(pg, rule); await pg.wait_for_timeout(4800)
            r = await pg.evaluate("({screen:document.querySelector('.screen.active').id, age:+document.querySelector('#rAge').textContent, title:document.querySelector('#rTitle').textContent, gap:document.querySelector('#rGap').textContent, quip:document.querySelector('#rQuip').textContent, rank:'n/a', kw:document.querySelector('#rKeywords').textContent, tip:document.querySelector('#tipBody').textContent, hash:location.hash, pin:document.querySelector('#rPin').style.left, right:lastResult.s.rightN})")
            g = 'younger' if '年輕' in r['gap'] else 'older' if '老了' in r['gap'] else 'match'
            ok = r['screen']=='result' and r['age']>0 and r['title'] and r['quip'] and '%' not in r['kw'] and '本輪科技關鍵字' in r['kw'] and len(r['tip'])>10 and r['hash'].startswith('#a=') and (g==expect or expect.startswith('none'))
            rec('D 結果', f'D 年代{dec}／{rule}：結果頁完整、落差方向={g}', ok, f"age={r['age']} {r['title']} 「{r['gap']}」 right={r['right']}")
            if rule=='right': rec('D 結果', 'D 全對觸發限定成就（金色 Hero＋徽章）', r['title']=='全時代通才' and await pg.evaluate("document.querySelector('.result-hero').classList.contains('legend') && document.querySelector('#legendBadge').style.display!=='none'"))
            if rule=='wrong': rec('D 結果', 'D 全錯→數位隱士、不除以零', r['title']=='數位隱士' and r['age']==36, f"age={r['age']}")
            await ctx.close()
        # 計分公式數學驗證
        ctx, pg, errs = await fresh(b)
        chk = await pg.evaluate("""(()=>{ decade=2; quiz=BANK.filter(q=>[1,2,11,21,31,41].includes(q.id)); answers=quiz.map(q=>({q,chosen:q.answer,correct:true,timedOut:false})); const s=score(); let w=0,ws=0; quiz.forEach(q=>{w+=q.difficulty;ws+=q.year*q.difficulty}); const exp=Math.round(20+(2026-ws/w)); return {age:s.age, exp, center:s.centerYear, expCenter:Math.round(ws/w)}; })()""")
        rec('D 結果', 'D 計分公式：年齡＝20＋(2026−難度加權平均年)', chk['age']==chk['exp'] and chk['center']==chk['expCenter'], str(chk))
        rec('D 結果', 'D 結果頁不再顯示假設分布百分位', await pg.evaluate("!document.querySelector('#rRank') && !document.body.textContent.includes('的人年輕（推估）')"))
        await ctx.close()

        # ---------- E. 分享、朋友視角、對戰 ----------
        ctx, pg, errs = await fresh(b); await to_quiz(pg, 1); await answer_all(pg, 'new'); await pg.wait_for_timeout(4800)
        h = await pg.evaluate("location.hash"); my_age = await pg.evaluate("lastResult.age")
        await pg.click('#shareBtn'); await pg.wait_for_timeout(400)
        sheet = await pg.evaluate("({shown:document.querySelector('#shareSheet').classList.contains('show'), pfs:[...document.querySelectorAll('#shareSheet .pf')].map(b=>b.lastChild.textContent.trim()), th:document.querySelector('[data-pf=threads]').href, fb:document.querySelector('[data-pf=facebook]').href, label:document.querySelector('#shareBtn').textContent.trim()})")
        rec('E 分享', 'E1 「分享到 Threads／IG／FB」開平台面板：三平台＋系統分享，Threads／FB 連結帶 share_id', sheet['shown'] and sheet['label']=='分享到 Threads／IG／FB' and sheet['pfs']==['Threads','Instagram','Facebook','系統分享'] and sheet['th'].startswith('https://www.threads.net/intent/post?text=') and '%26s%3D' in sheet['th'] and sheet['fb'].startswith('https://www.facebook.com/sharer/sharer.php?u=') and '%26p%3Dfacebook' in sheet['fb'], str(sheet['pfs']))
        await pg.click('#shareSheet [data-pf=copy_link]'); await pg.wait_for_timeout(300)
        clip = await pg.evaluate("navigator.clipboard.readText().catch(()=>'')")
        rec('E 分享', 'E1c 面板「複製連結」：挑戰連結含 #a= 與 s=／p= 歸因參數', ('#a=' in clip) and ('&s=' in clip) and ('&p=copy' in clip), clip[-60:])
        await pg.click('#sheetClose'); await pg.wait_for_timeout(200)
        line = await pg.evaluate("document.querySelector('#lineBtn').href")
        rec('E 分享', 'E1b LINE 挑戰鈕：line.me/R/share 帶結果文字與 #a= 連結', line.startswith('https://line.me/R/share?text=') and '%23a%3D' in line, line[:60])
        await pg.click('#cardBtn'); await pg.wait_for_timeout(1500)
        cv = await pg.evaluate("(()=>{const c=document.getElementById('shareCanvas'); const d=c.getContext('2d').getImageData(540,600,1,1).data; return {w:c.width,h:c.height,shown:document.getElementById('cardprev').classList.contains('show'), px:[...d]}})()")
        rec('E 分享', 'E2 直式證書 1080×1920 產生並預覽、檔名帶年齡', cv['w']==1080 and cv['h']==1920 and cv['shown'] and sum(cv['px'][:3])>0 and await pg.evaluate("cardBlob && cardBlob.size>10000 && certFileName(lastResult)===`WEiZ_數位年齡證書_${lastResult.age}歲.png`"), str(cv))
        btns = await pg.evaluate("[...document.querySelectorAll('#cardprev .row .btn')].map(b=>b.textContent.trim())")
        rec('E 分享', 'E2b 證書預覽按鈕：儲存證書／曬證書到 Threads／IG／FB／複製分享文案／關閉', btns==['儲存證書','曬證書到 Threads／IG／FB','複製分享文案','關閉'], str(btns))
        await pg.click('#copyCaptionBtn'); await pg.wait_for_timeout(300)
        cap = await pg.evaluate("navigator.clipboard.readText().catch(()=>'')")
        rec('E 分享', 'E2c 曬證書文案：年齡、稱號、關鍵字、邀請 CTA、連結、#WEiZ數位年齡挑戰', all(k in cap for k in ['我的數位年齡是','稱號是','本輪科技關鍵字','換你來測','#a=','#WEiZ數位年齡挑戰']), cap[:60])
        await pg.click('#closeCardBtn'); await pg.wait_for_timeout(200)
        rec('E 分享', 'E3 圖卡可關閉', not await pg.evaluate("document.getElementById('cardprev').classList.contains('show')"))
        await pg.reload(); await pg.wait_for_timeout(800)
        own = await pg.evaluate("({whose:document.querySelector('#rWhose').textContent, owner:document.querySelector('#ownerActions').style.display!=='none', lead:document.querySelector('#leadCard').style.display!=='none', review:document.querySelectorAll('#rReview .rv').length, age:+document.querySelector('#rAge').textContent})")
        own['tip'] = await pg.evaluate("document.querySelector('#tipCard').style.display!=='none'")
        rec('E 分享', 'E3b 本人在結果頁重新整理仍是本人視角（分享／證書／小知識／回顧都在）', own['whose']=='你的數位年齡' and own['owner'] and own['tip'] and own['review']==15 and own['age']==my_age, str(own))
        await ctx.close()
        # 朋友視角
        ctx, pg, errs = await fresh(b, P+h)
        g = await pg.evaluate("({screen:document.querySelector('.screen.active').id, whose:document.querySelector('#rWhose').textContent, who2:document.querySelector('#rWho2').textContent, chal:document.querySelector('#challengeBtn').offsetParent!==null, own:document.querySelector('#ownerActions').style.display, lead:document.querySelector('#leadCard').style.display, age:+document.querySelector('#rAge').textContent, challenger})")
        rec('E 分享', 'E4 朋友開連結：結果頁、「朋友的」、只顯示換我測、隱藏名單卡', g['screen']=='result' and g['whose']=='朋友的數位年齡' and g['who2']=='他的' and g['chal'] and g['own']=='none' and g['lead']=='none' and g['age']==my_age and g['challenger']['age']==my_age, str({k:g[k] for k in ['whose','who2','age']}))
        await pg.click('#challengeBtn'); await pg.wait_for_timeout(350); await pg.locator('.decade').nth(4).click(); await pg.click('#enterBtn'); await pg.wait_for_timeout(600)
        await answer_all(pg, 'old'); await pg.wait_for_timeout(4800)
        vs = await pg.evaluate("({show:document.querySelector('#vsCard').style.display!=='none', me:document.querySelector('#vsMe .num').textContent, them:document.querySelector('#vsThem .num').textContent, line:document.querySelector('#vsLine').textContent, note:document.querySelector('#challengeNote').textContent, hash:location.hash})")
        rec('E 分享', 'E5 好友對戰卡：你 vs 朋友、勝負文案、挑戰註記、hash 帶 o=', vs['show'] and str(my_age) in vs['them'] and ('年輕' in vs['line'] or '老' in vs['line'] or '平手' in vs['line']) and str(my_age) in vs['note'] and f"&o={my_age}" in vs['hash'], f"{vs['me']} vs {vs['them']}｜{vs['line']}")
        await ctx.close()
        # 推薦歸因：帶 s／p 的連結
        ctx, pg, errs = await fresh(b, P+h+'&s=abc123defg&p=threads')
        await pg.mouse.click(200, 300); await pg.wait_for_timeout(300)
        await pg.click('#challengeBtn'); await pg.wait_for_timeout(300); await pg.click('#skipBtn'); await pg.wait_for_timeout(600)
        ev = await pg.evaluate("dataLayer.filter(a=>a[0]==='event').map(a=>[a[1], a[2]&&a[2].share_id, a[2]&&a[2].platform_selected])")
        names = [e[0] for e in ev]
        rec('E 分享', 'E7 推薦連結 s／p：互動後 referral_visit、開始後 referral_start（帶 share_id 與平台）', 'referral_visit' in names and 'referral_start' in names and all(e[1]=='abc123defg' and e[2]=='threads' for e in ev if e[0].startswith('referral_')) and 'quiz_start' in names, str([e for e in ev if e[0].startswith('referral')]))
        await ctx.close()
        # 壞 hash 不當機
        ctx, pg, errs = await fresh(b, P+'#a=abc&t=99&y=1')
        rec('E 分享', 'E6 無效 hash 落回首頁、無錯誤', await pg.evaluate("document.querySelector('.screen.active').id")=='home' and not errs)
        await ctx.close()

        # ---------- F. 名單 ----------
        ctx, pg, errs = await fresh(b); await to_quiz(pg, 2); await answer_all(pg, 'rand'); await pg.wait_for_timeout(4800)
        rec('F 名單', 'F0 v4：Email 名單卡預設不在主流程；科技小知識卡有出現', await pg.evaluate("document.querySelector('#leadCard').style.display==='none' && document.querySelector('#tipCard').style.display!=='none' && document.querySelector('#tipBody').textContent.length>10"))
        await ctx.close()
        ctx, pg, errs = await fresh(b, P.replace('.html','.html?email=1')); await to_quiz(pg, 2); await answer_all(pg, 'rand'); await pg.wait_for_timeout(4800)
        await pg.fill('#leadEmail', 'not-an-email'); await pg.click('#leadBtn'); await pg.wait_for_timeout(200)
        t1 = await pg.evaluate("document.querySelector('#toast').textContent")
        rec('F 名單', 'F1 Email 格式錯誤被擋', '格式' in t1 and await pg.evaluate("!!document.querySelector('#leadBtn')"))
        await pg.fill('#leadEmail', 'gary@weiz.com.tw'); await pg.evaluate("document.querySelector('#leadConsent').checked=false"); await pg.click('#leadBtn'); await pg.wait_for_timeout(200)
        rec('F 名單', 'F2 未勾同意被擋', '同意' in await pg.evaluate("document.querySelector('#toast').textContent"))
        await pg.evaluate("document.querySelector('#leadConsent').checked=true")
        logs = []
        async def _grab(m):
            if '[lead]' in m.text: logs.append(json.dumps([await a.json_value() for a in m.args], ensure_ascii=False))  # 未設 LEAD_ENDPOINT：讀 console 完整參數（文字預覽會截斷物件）
        pg.on('console', _grab)
        pg.on('request', lambda r: logs.append(r.post_data) if r.method=='POST' and r.post_data and '"email"' in r.post_data else None)  # 已設 LEAD_ENDPOINT：抓送出的 POST 內容
        await pg.click('#leadBtn'); await pg.wait_for_timeout(400)
        rec('F 名單', 'F3 後端回 ok 才顯示「收到了」（含收件編號）、payload 含 email／年齡／出生年代', '收到了' in await pg.evaluate("document.querySelector('#leadCard').textContent") and '收件編號' in await pg.evaluate("document.querySelector('#leadCard').textContent") and any('gary@weiz.com.tw' in l and '1980' in l for l in logs), (logs[0][:120] if logs else 'no log'))
        await ctx.close()

        # ---------- G. 掃描動畫與結果音效 ----------
        ctx, pg, errs = await fresh(b); await to_quiz(pg, 3); await answer_all(pg, 'rand', 1250)
        await pg.wait_for_timeout(300)
        sc = await pg.evaluate("document.querySelector('.screen.active').id")
        await pg.wait_for_timeout(1800)
        steps = await pg.evaluate("[...document.querySelectorAll('#scan .step')].map(s=>s.className)")
        pct = await pg.evaluate("document.querySelector('#scanPct').textContent")
        await pg.wait_for_timeout(2500)
        rec('G 掃描', 'G1 掃描頁出現、步驟依序亮起、百分比推進、3 秒後進結果', sc=='scan' and any('on' in s for s in steps) and pct!='0%' and await pg.evaluate("document.querySelector('.screen.active').id")=='result', f'steps={steps} pct={pct}')
        await ctx.close()
        # 減少動態：跳過掃描
        ctx = await b.new_context(viewport={'width':390,'height':844}, reduced_motion='reduce'); pg = await ctx.new_page(); await pg.goto(P); await pg.wait_for_timeout(500)
        await to_quiz(pg, 2); await answer_all(pg, 'rand', 1250); await pg.wait_for_timeout(500)
        rec('G 掃描', 'G2 prefers-reduced-motion：跳過掃描直接出結果', await pg.evaluate("document.querySelector('.screen.active').id")=='result')
        await ctx.close()

        # ---------- H. 環境相容 ----------
        ctx, pg, errs = await fresh(b, mobile=False)
        rec('H 相容', 'H1 桌機 1200px 版面：手機容器置中、寬 480', await pg.evaluate("(()=>{const r=document.querySelector('.phone').getBoundingClientRect(); return Math.round(r.width)===480 && Math.abs((r.left+r.right)/2-600)<2})()"))
        await ctx.close()
        html = open(os.environ.get('QUIZ_FILE','index.html'),encoding='utf-8').read()
        ctx = await b.new_context(viewport={'width':390,'height':844}); pg = await ctx.new_page(); serr=[]; pg.on('pageerror', lambda e: serr.append(str(e)))
        await pg.set_content('<iframe id=f sandbox="allow-scripts" style="width:390px;height:844px;border:0"></iframe>'); await pg.evaluate("h=>document.getElementById('f').srcdoc=h", html); await pg.wait_for_timeout(1000)
        f = pg.frame_locator('#f'); await f.locator('#startBtn').click(); await pg.wait_for_timeout(300); await f.locator('.decade').nth(2).click(); await f.locator('#enterBtn').click(); await pg.wait_for_timeout(600)
        for _ in range(15): await f.locator('.opt').first.click(); await pg.wait_for_timeout(150); await f.locator('#nextBtn').click(); await pg.wait_for_timeout(250)
        await pg.wait_for_timeout(4800)
        rec('H 相容', 'H2 沙箱 iframe（Claude 預覽）完整跑完進結果、無錯誤', await f.locator('.screen.active').get_attribute('id')=='result' and not serr, '; '.join(serr)[:100])
        await ctx.close()
        ctx, pg, errs = await fresh(b, P.replace('.html','.html?v=silent'))
        await to_quiz(pg, 2); await pg.locator('.opt').first.click(); await pg.wait_for_timeout(60)
        rec('H 相容', 'H3 ?v=silent 強制不顯示對錯（A/B 用）', await pg.evaluate("FEEDBACK_MODE")=='silent' and await pg.evaluate("document.querySelectorAll('.opt.right').length")==0)
        await ctx.close()

        # ---------- I. 穩定性：5 次完整隨機跑 ----------
        fails = []
        for i in range(5):
            ctx, pg, errs = await fresh(b); await to_quiz(pg, i)
            await answer_all(pg, 'rand', 1250); await pg.wait_for_timeout(4800)
            ok = await pg.evaluate("document.querySelector('.screen.active').id")=='result' and await pg.evaluate("answers.length")==15 and not errs
            if not ok: fails.append((i, errs[:2]))
            await ctx.close()
        rec('I 穩定', 'I1 5 個年代各完整隨機跑一輪：皆進結果、答案 15 筆、無錯誤', not fails, str(fails))

        await b.close()
    json.dump(R, open('acceptance.json','w'), ensure_ascii=False)
    print('\nPASS', sum(1 for r in R if r[2]=='PASS'), '/', len(R))

asyncio.run(main())
