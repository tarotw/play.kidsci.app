// Native media playback, podcast exclusivity, laboratory lifecycle and progress.
const {chromium,devices}=require('playwright'),assert=require('node:assert/strict');
const base=process.env.BASE_URL||'http://localhost:8000';
(async()=>{const b=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox','--enable-unsafe-swiftshader']});try{
 const ctx=await b.newContext({...devices['Pixel 7'],deviceScaleFactor:1,reducedMotion:'reduce'});await ctx.addInitScript(()=>{window.__qaAudio=[];const NativeAudio=Audio;window.Audio=class extends NativeAudio{constructor(...a){super(...a);window.__qaAudio.push(this)}};speechSynthesis.getVoices=()=>[]});
 const p=await ctx.newPage();p.setDefaultTimeout(60000);const errors=[];p.on('pageerror',e=>errors.push(String(e)));
 await p.goto(base+'/?ch=217');await p.waitForSelector('#channel[open]');
 const f=await(await p.locator('.embed iframe').elementHandle()).contentFrame();await f.waitForSelector('.content-play-button');
 await f.locator('.content-play-button').click();
 // Verify real provider media advances, not just that a play button changed appearance.
 await f.waitForFunction(()=>[...document.querySelectorAll('audio,video')].some(a=>!a.paused&&a.currentTime>.1),null,{timeout:45000});
 assert.ok(await p.evaluate(()=>window.__qaAudio.every(a=>a.paused)));
 await p.locator('[data-talk]').click();assert.equal(await p.locator('.embed iframe').count(),0);
 await p.waitForFunction(()=>window.__qaAudio.some(a=>!a.paused&&a.currentTime>.1));
 await p.locator('[data-talk]').click();const paused=await p.evaluate(()=>window.__qaAudio[0].currentTime);assert.ok(await p.evaluate(()=>window.__qaAudio.every(a=>a.paused)));
 await p.locator('[data-talk]').click();await p.waitForFunction(t=>window.__qaAudio.some(a=>!a.paused&&a.currentTime>t+.1),paused);
 await p.locator('[data-podcast]').click();await p.waitForSelector('.embed iframe');assert.ok(await p.evaluate(()=>window.__qaAudio.every(a=>a.paused)));
 console.log('PASS: actual Apple media advances; captain playback removes it; pause/resume and returning to podcast are exclusive.');
 const popup=p.waitForEvent('popup');await p.locator('.pf.apple').click();const app=await popup;assert.ok(app.url().includes('podcasts.apple.com')||app.url()==='about:blank');await app.close();
 await p.locator('#channel .close').click();await p.waitForFunction(()=>!document.querySelector('#channel').open);assert.equal(await p.locator('.embed iframe').count(),0);
 await p.locator('#logbook-btn').click();await p.waitForSelector('#journal[open]');assert.match(await p.locator('#journal').innerText(),/耳朵章 1 枚/);
 await p.locator('#journal [data-open-ch="217"]').click();await p.waitForSelector('#channel[open]');await p.locator('#channel .close').click();
 await p.reload();await p.waitForFunction(()=>window.__isles&&document.body.classList.contains('ready'));assert.equal(await p.locator('#stamp-count').innerText(),'1');
 await p.locator('#logbook-btn').click();p.once('dialog',d=>d.dismiss());await p.locator('#clear-stamps').click();assert.ok(await p.locator('#journal').evaluate(d=>d.open));
 p.once('dialog',d=>d.accept());await p.locator('#clear-stamps').click();await p.waitForFunction(()=>document.querySelector('#stamp-count').textContent==='0');
 console.log('PASS: external listening adds one stamp; journal reopening, reload persistence and clear cancel/confirm work.');
 // Real laboratory iframe, close and cancellation of the 60-second fallback timer.
 await p.goto(base+'/?ch=c18');await p.waitForSelector('#channel[open]');await p.locator('[data-lab]').click();await p.waitForSelector('#lab[open]');
 const lab=await(await p.locator('#lab-frame').elementHandle()).contentFrame();await lab.waitForFunction(()=>document.body.innerText.length>30);
 assert.equal(await p.locator('.embed iframe').count(),0);await p.keyboard.press('Escape');await p.waitForFunction(()=>!document.querySelector('#lab').open);
 assert.equal(await p.locator('#lab-frame').getAttribute('src'),'about:blank');
 await p.clock.install();await p.clock.fastForward(61000);assert.equal(await p.evaluate(()=>window.__isles.stamps().hand.length),0);
 await p.locator('[data-lab]').click();await p.waitForSelector('#lab[open]');await p.clock.fastForward(61000);
 assert.deepEqual(await p.evaluate(()=>window.__isles.stamps().hand),['c18']);
 await p.locator('#lab-close').click();assert.equal(await p.locator('#lab-frame').getAttribute('src'),'about:blank');assert.deepEqual(errors,[]);
 console.log('PASS: real lab loads; Escape/button close blank the iframe; closed labs cannot get timer stamps; open labs stamp once.');
 }finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
