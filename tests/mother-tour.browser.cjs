// Production UI checks. Serve the site first; requires Playwright. Artifacts: ARTIFACT_DIR or /tmp/kidsci-qa.
const {chromium,devices}=require('playwright');
const fs=require('node:fs');const path=require('node:path');const artifacts=process.env.ARTIFACT_DIR||'/tmp/kidsci-qa';fs.mkdirSync(artifacts,{recursive:true});const assert=require('node:assert/strict');
const base=process.env.BASE_URL||'http://localhost:8000';const tag=base.includes('localhost')?'local':'live';
(async()=>{
const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox','--enable-unsafe-swiftshader']});
const ctx=await browser.newContext({...devices['Pixel 7'],deviceScaleFactor:1,reducedMotion:'reduce'});
await ctx.addInitScript(()=>{
 window.__audios=[];const RealAudio=Audio;window.Audio=class extends RealAudio{constructor(...a){super(...a);window.__audios.push(this)}};
 speechSynthesis.getVoices=()=>[];
 const nativeConnect=AudioNode.prototype.connect;
 AudioNode.prototype.connect=function(destination,...args){const result=nativeConnect.call(this,destination,...args);const c=this.context;
 if(destination===c.destination){if(!c.__meter){c.__meter=c.createAnalyser();c.__meter.fftSize=2048;const silence=c.createGain();silence.gain.value=0;nativeConnect.call(c.__meter,silence);nativeConnect.call(silence,c.destination)}nativeConnect.call(this,c.__meter)}return result};
 window.__rms=()=>{const a=window.__isles?.world.sound.ctx?.__meter;if(!a)return 0;const data=new Float32Array(a.fftSize);a.getFloatTimeDomainData(data);return Math.sqrt(data.reduce((s,x)=>s+x*x,0)/data.length)};
});
const p=await ctx.newPage();p.setDefaultTimeout(20000);const errors=[];p.on('pageerror',e=>errors.push(String(e)));
await p.goto(base,{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>window.__isles&&document.body.classList.contains('ready'));
const home=await p.evaluate(()=>window.__isles.isles.find(x=>x.def.id==='studio').def);
assert.equal(home.name,'好好聽島');assert.equal(home.tour.length,4);
assert.ok((await p.locator('#isle-name').innerText()).includes('好好聽島'));
await p.waitForSelector('#guide.paged[data-page="1"]');
assert.ok(await p.evaluate(()=>window.__audios.every(a=>a.paused&&!a.getAttribute('src'))));
assert.equal(await p.evaluate(()=>window.__isles.world.sound.ctx),null);
await p.screenshot({path:`${artifacts}/home-tour-${tag}.png`});
const narration=[];
for(let i=0;i<home.tour.length;i++){
 assert.equal(await p.locator('.guide-text').innerText(),home.tour[i].text);
 assert.equal(await p.locator('.guide-page-title').innerText(),home.tour[i].title);
 await p.locator('.guide-text').click();assert.equal(await p.locator('#guide').getAttribute('data-page'),String(i+1));
 await p.locator('.guide-avatar-play').click();await p.waitForFunction(()=>window.__audios.some(a=>!a.paused&&a.currentTime>.1),null,{polling:100});
 const audio=await p.evaluate(()=>window.__audios.filter(a=>!a.paused).map(a=>({src:a.src,time:a.currentTime,duration:a.duration}))[0]);
 const expected=await p.evaluate(async text=>(await import('./narration-audio.js')).narrationReady.then(m=>m.get(text)),home.tour[i].text);
 assert.equal(audio.src,expected);narration.push({page:i+1,actualAudio:true,duration:audio.duration});
 if(i===0){await p.locator('.guide-avatar-play').click();const paused=await p.evaluate(()=>window.__audios.find(a=>a.src)?.currentTime);assert.ok(await p.evaluate(()=>window.__audios.every(a=>a.paused)));await p.locator('.guide-avatar-play').click();await p.waitForFunction(t=>window.__audios.some(a=>!a.paused&&a.currentTime>t+.1),paused,{polling:100});}
 await p.locator('[data-guide-next]').click();
 if(i<home.tour.length-1){await p.waitForSelector(`#guide[data-page="${i+2}"]`);assert.ok(await p.evaluate(()=>window.__audios.every(a=>a.paused)));}
}
await p.waitForSelector('#station[open]');assert.equal(await p.locator('#guide').isVisible(),false);
assert.ok((await p.locator('#station [data-go="studio"]').innerText()).includes('好好聽島'));
await p.locator('#station [data-go="rainforest"]').click();
await p.waitForFunction(()=>window.__isles.world.sound.ctx?.state==='running'&&window.__rms()>.0001,null,{polling:50});
const launch=await p.evaluate(()=>({rms:window.__rms(),duration:window.__isles.world.sound.launchSound?.noise.buffer.duration,state:window.__isles.world.sound.ctx.state}));
assert.ok(launch.rms>0);assert.ok(launch.duration>=1);
await p.locator('#sound-btn').click();assert.equal(await p.evaluate(()=>window.__isles.world.sound.launchSound),null);
await p.waitForFunction(()=>window.__rms()<.00001,null,{polling:50});
await p.waitForFunction(()=>window.__isles.world.mode()==='island'&&window.__isles.world.current().id==='rainforest',null,{timeout:40000});
assert.equal(await p.locator('#guide').evaluate(e=>e.classList.contains('paged')),false);
assert.ok(await p.locator('.guide-text').innerText());
await p.waitForFunction(()=>!window.__isles.world.busy());
await p.locator('#sound-btn').click();await p.evaluate(()=>window.__isles.world.sound.ctx.suspend());
await p.locator('#station-btn').click();await p.locator('#station [data-go="studio"]').click();
await p.waitForFunction(()=>window.__isles.world.sound.ctx.state==='running'&&window.__rms()>.0001,null,{polling:50});
await p.waitForFunction(()=>window.__isles.world.mode()==='island'&&window.__isles.world.current().id==='studio',null,{timeout:40000});
await p.waitForSelector('#guide.paged[data-page="1"]');assert.equal(await p.evaluate(()=>window.__isles.world.sound.launchSound),null);
await p.locator('[data-guide-next]').click();await p.locator('[data-guide-prev]').click();assert.equal(await p.locator('#guide').getAttribute('data-page'),'1');
await p.locator('.guide-close').click();assert.equal(await p.locator('#guide').isVisible(),false);
await p.locator('#guide-btn').click();await p.waitForSelector('#guide.paged[data-page="1"]');
// Old saved preferences and visited flags cannot suppress the mother-island tutorial.
await p.evaluate(()=>{localStorage.setItem('kidsci-universe-guide',JSON.stringify({on:false,voice:true}));localStorage.setItem('kidsci-universe-isles-v1',JSON.stringify(['studio','rainforest']))});
await p.reload({waitUntil:'domcontentloaded'});await p.waitForFunction(()=>window.__isles&&document.body.classList.contains('ready'));await p.waitForSelector('#guide.paged[data-page="1"]');
assert.ok(await p.evaluate(()=>window.__audios.every(a=>a.paused)));
// Confirm the previous narration is cancelled when a story is opened.
await p.locator('.guide-avatar-play').click();await p.waitForFunction(()=>window.__audios.some(a=>!a.paused&&a.currentTime>.1),null,{polling:100});
await p.evaluate(()=>{const t=document.createElement('button');t.dataset.openCh='217';document.body.append(t);t.click();t.remove()});await p.waitForSelector('#channel[open]');
assert.equal(await p.locator('#guide').isVisible(),false);assert.ok(await p.evaluate(()=>window.__audios.every(a=>a.paused)));
await p.evaluate(()=>new Promise(resolve=>{const d=document.querySelector('#channel');d.addEventListener('close',resolve,{once:true});d.close()}));
await p.evaluate(()=>window.__isles.world.jump('studio'));await p.waitForSelector('#guide.paged[data-page="1"]');
const layouts=[];
for(const viewport of [{width:320,height:568},{width:393,height:851},{width:844,height:390},{width:1280,height:800}]){
 await p.setViewportSize(viewport);await p.locator('[data-guide-next]').scrollIntoViewIfNeeded();
 const layout=await p.evaluate(()=>{const g=document.querySelector('#guide'),r=g.getBoundingClientRect(),bar=document.querySelector('.isle-bar').getBoundingClientRect(),next=document.querySelector('[data-guide-next]').getBoundingClientRect();return{width:innerWidth,height:innerHeight,top:r.top,bottom:r.bottom,barTop:bar.top,scroll:g.scrollWidth,client:g.clientWidth,nextTop:next.top,nextBottom:next.bottom}});
 assert.ok(layout.top>=0,JSON.stringify(layout));assert.ok(layout.bottom<=layout.barTop-4,JSON.stringify(layout));assert.ok(layout.scroll<=layout.client+2,JSON.stringify(layout));assert.ok(layout.nextTop>=layout.top&&layout.nextBottom<=layout.bottom+1,JSON.stringify(layout));layouts.push(layout);
}
// Render the same launch synthesizer to PCM; measure its envelope rather than mocking sound calls.
const rendered=await p.evaluate(async()=>{const {Sound}=await import('./explorer.js');const c=new OfflineAudioContext(1,44100*3,44100);const sound=new Sound();sound.ctx=c;sound.launch(3);const b=await c.startRendering();return Array.from(b.getChannelData(0))});
const rms=a=>Math.sqrt(a.reduce((s,x)=>s+x*x,0)/a.length),peak=rendered.reduce((m,x)=>Math.max(m,Math.abs(x)),0);
const audioMetrics={peak,rms:rms(rendered),tailRms:rms(rendered.slice(-4410))};assert.ok(audioMetrics.rms>.005);assert.ok(audioMetrics.peak<.95);assert.ok(audioMetrics.tailRms<audioMetrics.rms*.1);
const wav=Buffer.alloc(44+rendered.length*2);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(44100,24);wav.writeUInt32LE(88200,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(rendered.length*2,40);rendered.forEach((x,i)=>wav.writeInt16LE(Math.max(-32768,Math.min(32767,Math.round(x*32767))),44+i*2));fs.writeFileSync(`${artifacts}/rocket-launch-${tag}.wav`,wav);
assert.deepEqual(errors,[]);
const report={base,pages:narration,manualVoice:true,returnResetsFirstPage:true,reloadWithOldPrefs:true,previousPage:true,reopenHelp:true,storyExclusivity:true,actualLaunch:launch,muteStopsLaunch:true,suspendedContextResumed:true,launchStopsOnArrival:true,layouts,audioMetrics,errors};fs.writeFileSync(`${artifacts}/home-tour-${tag}.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
