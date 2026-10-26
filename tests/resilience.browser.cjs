// Failed loads, old saved data, missing WebGL and failed audio; use a local static server.
const {chromium,devices}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const base=process.env.BASE_URL||'http://localhost:8000';
(async()=>{const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox','--enable-unsafe-swiftshader']});try{
 const context=await browser.newContext({...devices['Pixel 7'],deviceScaleFactor:1,reducedMotion:'reduce'});
 await context.addInitScript(()=>{window.__qaAudio=[];const NativeAudio=Audio;window.Audio=class extends NativeAudio{constructor(...args){super(...args);window.__qaAudio.push(this)}};speechSynthesis.getVoices=()=>[]});
 const page=await context.newPage();page.setDefaultTimeout(45000);
 const ready=()=>page.waitForFunction(()=>document.body.classList.contains('ready'));
 // A failed required JSON fetch must show recovery, then the retry must work.
 await page.route('**/data/catalog.json',r=>r.abort());await page.goto(base);
 await page.waitForFunction(()=>document.querySelector('#loading-text').textContent.includes('載入失敗'));
 await page.unroute('**/data/catalog.json');await page.locator('#loading-text button').click();await ready();
 console.log('PASS: required-data failure displays a working retry.');
 // Keep valid progress even when one field is broken, across all public map versions.
 for(const path of ['/?isle=rainforest','/knob.html?gl=0','/zoom.html','/mindmap.html']){
  await page.evaluate(()=>localStorage.setItem('kidsci-universe-v1',JSON.stringify({ear:['217','217'],hand:null,seen:42,missions:'bad',guess:'bad'})));
  await page.goto(base+path);await ready();await page.locator('#logbook-btn').click();await page.waitForSelector('#journal[open]');
  assert.match(await page.locator('#journal').innerText(),/耳朵章 1 枚/);
 }
 console.log('PASS: partial old progress is recovered across all four map versions.');
 const blocked=await browser.newContext({viewport:{width:393,height:851},deviceScaleFactor:1,reducedMotion:'reduce'});
 await blocked.addInitScript(()=>{Storage.prototype.getItem=function(){throw new DOMException('Blocked','SecurityError')};Storage.prototype.setItem=function(){throw new DOMException('Blocked','SecurityError')}});
 const blockedPage=await blocked.newPage();
 for(const path of ['/','/knob.html?gl=0','/zoom.html','/mindmap.html']){await blockedPage.goto(base+path);await blockedPage.waitForFunction(()=>document.body.classList.contains('ready'));}
 await blocked.close();console.log('PASS: blocked browser storage still allows all four maps to load.');
 const fallback=await browser.newContext({viewport:{width:393,height:851},deviceScaleFactor:1});
 await fallback.addInitScript(()=>{const getContext=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type.startsWith('webgl')?null:getContext.call(this,type,...args)}});
 const fallbackPage=await fallback.newPage();await fallbackPage.goto(base);await fallbackPage.locator('#loading-text a').click();await fallbackPage.waitForFunction(()=>document.body.classList.contains('ready'));
 assert.ok(fallbackPage.url().includes('gl=0'));await fallback.close();console.log('PASS: a device without WebGL reaches the usable 2D map.');
 await page.goto(base+'/?isle=rainforest');await ready();
 await page.route('**/assets/speech/*.mp3',r=>r.abort());await page.locator('.guide-avatar-play').click();
 await page.waitForFunction(()=>!document.querySelector('.guide-voice-status').hidden);
 assert.match(await page.locator('.guide-voice-status').innerText(),/再點/);
 assert.equal(await page.locator('.guide-avatar-play').isDisabled(),false);
 await page.unroute('**/assets/speech/*.mp3');await page.locator('.guide-avatar-play').click();
 await page.waitForFunction(()=>window.__qaAudio.some(a=>!a.paused&&a.currentTime>.1));assert.equal(await page.locator('.guide-voice-status').isVisible(),false);
 await page.locator('.guide-close').click();assert.ok(await page.evaluate(()=>window.__qaAudio.every(a=>a.paused)));
 console.log('PASS: failed guide audio offers retry, recovery plays real audio, and close stops playback.');
 await page.locator('#residents-btn').click();await page.locator('#people [data-ep="206"]').click();await page.waitForSelector('#channel[open]');
 await page.route('**/assets/speech/*.mp3',r=>r.abort());await page.locator('[data-talk]').click();
 await page.waitForFunction(()=>document.querySelector('[data-intro-status]').textContent.includes('再點'));
 assert.equal(await page.locator('[data-talk]').isDisabled(),false);
 await page.unroute('**/assets/speech/*.mp3');await page.locator('[data-talk]').click();await page.waitForFunction(()=>window.__qaAudio.some(a=>!a.paused&&a.currentTime>.1));
 await page.evaluate(()=>window.__qaAudio.forEach(a=>a.playbackRate=16));
 await page.waitForFunction(()=>document.querySelector('[data-intro-status]').textContent.includes('介紹完了'));
 assert.equal(await page.locator('[data-talk]').getAttribute('aria-pressed'),'false');
 console.log('PASS: story narration recovers from a failed load and returns to replay after the real ended event.');
 }finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
