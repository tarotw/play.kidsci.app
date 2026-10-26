// Production UI checks. Serve the site first; requires Playwright. Artifacts: ARTIFACT_DIR or /tmp/kidsci-qa.
const {chromium,devices}=require('playwright');
const fs=require('node:fs');const path=require('node:path');const artifacts=process.env.ARTIFACT_DIR||'/tmp/kidsci-qa';fs.mkdirSync(artifacts,{recursive:true});const assert=require('node:assert/strict');
const base=process.env.BASE_URL||'http://localhost:8000';const tag=base.includes('localhost')?'local':'live';
(async()=>{
const b=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox','--enable-unsafe-swiftshader']});
const ctx=await b.newContext({...devices['Pixel 7'],deviceScaleFactor:1,reducedMotion:'reduce'});
await ctx.addInitScript(()=>{const RealAudio=Audio;window.__audios=[];window.Audio=class extends RealAudio{constructor(...a){super(...a);window.__audios.push(this)}};speechSynthesis.getVoices=()=>[]});
const p=await ctx.newPage();p.setDefaultTimeout(20000);const errors=[];p.on('pageerror',e=>errors.push(String(e)));
await ctx.route('https://is1-ssl.mzstatic.com/**',r=>r.abort());
await p.goto(base+'/?ch=217',{waitUntil:'domcontentloaded'});
await p.waitForSelector('.episode-player .embed iframe');
await p.waitForFunction(()=>document.querySelector('.episode-player .episode-cover')?.naturalWidth>0);
let f=await(await p.locator('.embed iframe').elementHandle()).contentFrame();await f.waitForSelector('button');
await f.waitForFunction(()=>[...document.images].some(i=>i.complete&&i.naturalWidth===0));
await p.screenshot({path:`${artifacts}/player-cover-blocked-${tag}.png`});
await p.locator('[data-talk]').click();await p.waitForFunction(()=>window.__audios.some(a=>!a.paused&&a.currentTime>.1));
assert.equal(await p.locator('.embed iframe').count(),0);
await p.waitForFunction(()=>document.querySelector('.podcast-return-cover')?.naturalWidth>0);
await p.locator('[data-podcast]').click();assert.ok(await p.evaluate(()=>window.__audios.every(a=>a.paused)));await p.waitForSelector('.embed iframe');
// The same production channel renderer and assets, without the unrelated 3D scene.
await ctx.route('**/__player_audit',r=>r.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(__dirname,'fixtures/player-audit.html'),'utf8')}));
await ctx.route('https://embed.podcasts.apple.com/**',r=>r.abort());
await p.goto(base+'/__player_audit');await p.waitForFunction(()=>window.__channels);
const episodes=await p.evaluate(()=>window.__episodes);let checked=0;
for(const e of episodes){
 await p.evaluate(code=>window.__channels.openChannel(code),e.code);
 await p.locator('.episode-cover').evaluate(i=>i.decode());
 assert.equal(await p.locator('.episode-cover').getAttribute('src'),e.artworkLocal,e.code);
 assert.equal(await p.locator('.episode-player .embed iframe').count(),e.state==='public'?1:0,e.code);
 assert.equal(await p.locator('.episode-player').evaluate(el=>el.nextElementSibling.classList.contains('captain-intro')),true);
 checked++;if(checked%40===0)console.log('Cards checked',checked);
}
// A delayed close from the previous card must leave the new player untouched.
await p.evaluate(()=>window.__channels.openChannel('c10'));
const race=await p.evaluate(async()=>{const d=document.querySelector('#channel');const closed=new Promise(r=>d.addEventListener('close',r,{once:true}));d.close();await window.__channels.openChannel('217');await closed;return{open:d.open,iframe:document.querySelectorAll('.embed iframe').length,ch:new URLSearchParams(location.search).get('ch')}});
assert.deepEqual(race,{open:true,iframe:1,ch:'217'});
const e=episodes.find(e=>e.code==='217');const originalArtwork={artwork:e.artwork,artworkLocal:e.artworkLocal};e.artworkLocal='assets/episode-covers/00000000000000000001.jpg';e.artwork+='?cover-failure-test=remote';await p.evaluate(art=>Object.assign(window.__episodes.find(e=>e.code==='217'),art),{artwork:e.artwork,artworkLocal:e.artworkLocal});await ctx.unroute('https://is1-ssl.mzstatic.com/**');
let mode='local';await ctx.route('**/*',r=>{const u=r.request().url();if(u.endsWith('/'+e.artworkLocal)||(mode==='both'&&u===e.artwork))return r.abort();return r.continue()});
await p.evaluate(()=>window.__channels.openChannel('217'));
await p.waitForFunction(url=>{const i=document.querySelector('.episode-cover');return i?.src===url&&i.naturalWidth>0},e.artwork);
await p.locator('[data-talk]').click();await p.waitForFunction(url=>{const i=document.querySelector('.podcast-return-cover');return i?.src===url&&i.naturalWidth>0},e.artwork);
mode='both';e.artwork += '&test-source-failure=1';await p.evaluate(url=>{window.__episodes.find(e=>e.code==='217').artwork=url},e.artwork);await p.evaluate(()=>window.__channels.openChannel('217'));
await p.waitForFunction(()=>{const i=document.querySelector('.episode-cover');return i?.getAttribute('src')==='assets/logo-square.jpg'&&i.naturalWidth>0});
await p.locator('[data-talk]').click();await p.waitForFunction(()=>{const i=document.querySelector('.podcast-return-cover');return i?.getAttribute('src')==='assets/logo-square.jpg'&&i.naturalWidth>0});
await p.locator('[data-podcast]').click();
console.log('Fallback checks passed');const widths=[];for(const width of [320,360,393,768,1280]){await p.setViewportSize({width,height:900});
await p.waitForFunction(()=>document.querySelector('.embed iframe').clientWidth>=290);
const row=await p.evaluate(()=>{const d=document.querySelector('#channel'),i=document.querySelector('.embed iframe');return{width:innerWidth,frameWidth:i.clientWidth,dialogWidth:d.clientWidth,scrollWidth:d.scrollWidth}});assert.ok(row.scrollWidth<=row.dialogWidth+2,JSON.stringify(row));widths.push(row)}
await p.setViewportSize({width:320,height:900});await p.evaluate(code=>window.__channels.openChannel(code),episodes.find(e=>e.state==='subscriber').code);
assert.ok(await p.locator('#channel').evaluate(d=>d.scrollWidth<=d.clientWidth+2));
// Keep a normal screenshot as well as the explicit external-image failure case.
await p.evaluate(art=>Object.assign(window.__episodes.find(e=>e.code==='217'),art),originalArtwork);await ctx.unroute('**/*');await ctx.unroute('https://embed.podcasts.apple.com/**');await p.setViewportSize({width:393,height:851});
await p.evaluate(()=>window.__channels.openChannel('217'));await p.locator('.episode-cover').evaluate(i=>i.decode());
f=await(await p.locator('.embed iframe').elementHandle()).contentFrame();await f.waitForSelector('button');await f.waitForFunction(()=>[...document.images].some(i=>i.naturalWidth>0));
await p.screenshot({path:`${artifacts}/player-cover-normal-${tag}.png`});
// Actual close still removes playback; the guard only ignores stale events.
await p.evaluate(()=>new Promise(resolve=>{const d=document.querySelector('#channel');d.addEventListener('close',resolve,{once:true});d.close()}));assert.equal(await p.locator('.embed iframe').count(),0);
assert.deepEqual(errors,[]);
const report={base,episodes:checked,public:episodes.filter(e=>e.state==='public').length,vip:episodes.filter(e=>e.state==='subscriber').length,realAppleThumbnailBlocked:true,persistentPlayerCover:true,realNarrationPlayback:true,exclusiveAudio:true,fastReopen:race,remoteArtworkFallback:true,showArtworkFallback:true,returnButtonFallback:true,widths,vipNarrowLayout:true,normalClose:true,errors};
fs.writeFileSync(`${artifacts}/player-covers-${tag}.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
