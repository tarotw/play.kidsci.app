// Functional coverage of the production island UI; serve the repository first.
// Requires Playwright. BASE_URL, CHROMIUM_PATH and QA_REPORT are optional.
const { chromium, devices } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.BASE_URL || 'http://localhost:8000';
const report = { base, completed: false, islands: [], checks: [], errors: [] };
(async () => {
 let page;
 const browser = await chromium.launch({ ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}), args:['--no-sandbox','--enable-unsafe-swiftshader'] });
 try {
  const context = await browser.newContext({...devices['Pixel 7'],deviceScaleFactor:1,reducedMotion:'reduce'});
  await context.addInitScript(() => {
   const NativeAudio=Audio;window.__qaAudio=[];
   window.Audio=class extends NativeAudio { constructor(...args){super(...args);window.__qaAudio.push(this)} };
   speechSynthesis.getVoices=()=>[]; // Prove the bundled Taiwan Mandarin recording actually plays.
  });
  page = await context.newPage();page.setDefaultTimeout(60000);
  page.on('pageerror',error=>report.errors.push(String(error)));
  const ready=()=>page.waitForFunction(()=>window.__isles&&document.body.classList.contains('ready'));
  const silent=()=>page.evaluate(()=>window.__qaAudio.every(a=>a.paused));
  const close=async id=>page.evaluate(id=>new Promise(resolve=>{const d=document.getElementById(id);if(!d.open)return resolve();d.addEventListener('close',resolve,{once:true});d.close()}),id);
  const check=(name)=>{report.checks.push(name);console.log('PASS:',name)};
  await page.goto(base);await ready();
  assert.equal(await page.locator('#guide').getAttribute('data-page'),'1');assert.ok(await silent());
  const definitions=await page.evaluate(()=>window.__isles.isles.map(x=>({def:x.def,eps:x.eps.map(e=>({code:e.code,title:e.title,icon:e.icon,state:e.state}))})));
  assert.equal(definitions.length,20);check('cold entry starts the silent mother-island tutorial');
  // Every destination uses real station clicks and the real flight; do not teleport.
  const destinations=[...definitions.filter(x=>x.def.id!=='studio'),definitions.find(x=>x.def.id==='studio')];
  for(const {def,eps} of destinations){
   const from=await page.evaluate(()=>window.__isles.world.current().id);
   await page.locator('#station-btn').tap();
   assert.equal(await page.locator('#station [data-go]').count(),definitions.length);
   await page.locator(`#station [data-go="${def.id}"] .nm`).tap();
   await page.waitForFunction(id=>window.__isles.world.mode()==='flight'&&window.__isles.world.debug.flight.to.def.id===id,def.id);
   assert.equal(await page.locator('#station').evaluate(d=>d.open),false);
   assert.equal(await page.locator('#residents-btn').isVisible(),false);
   assert.equal(await page.locator('#guide').isVisible(),false);
   await page.waitForFunction(id=>window.__isles.world.mode()==='island'&&window.__isles.world.current().id===id,def.id);
   assert.equal(new URL(page.url()).searchParams.get('isle'),def.id);
   assert.ok((await page.locator('#isle-name').innerText()).includes(def.name));
   await page.waitForFunction(text=>document.querySelector('.guide-text').textContent===text,def.intro);
   assert.ok(await silent());
   await page.locator('.guide-avatar-play').tap();
   await page.waitForFunction(()=>window.__qaAudio.some(a=>!a.paused&&a.currentTime>.05),null,{polling:100});
   await page.locator('.guide-close').tap();assert.ok(await silent());
   assert.equal(await page.locator('#residents-btn').isVisible(),eps.length>0);
   if(eps.length){
    await page.locator('#residents-btn').tap();
    const rows=await page.locator('#people [data-ep]').evaluateAll(bs=>bs.map(b=>({code:b.dataset.ep,icon:b.querySelector('[data-icon]').dataset.icon})));
    assert.deepEqual(rows,eps.map(e=>({code:e.code,icon:e.icon})));
    await page.locator(`#people [data-ep="${eps[0].code}"] .tt`).tap();
    await page.waitForSelector('#channel[open]');
    assert.equal(await page.locator('#ch-title').innerText(),eps[0].title);
    assert.equal(await page.locator('.embed iframe').count(),eps[0].state==='public'?1:0);
    await page.locator('.episode-cover').evaluate(i=>i.decode());
    await close('channel');
    assert.equal(new URL(page.url()).searchParams.has('ch'),false);
    // The upper resident entry must open the same list.
    await page.locator('#people-btn').tap();assert.equal(await page.locator('#people [data-ep]').count(),eps.length);await close('people');
   }
   report.islands.push({id:def.id,from,flight:true,introAudio:true,residents:eps.length,story:eps[0]?.code||null});
   console.log('Island:',def.id,'flight, narration, entrances, resident story passed');
  }
  assert.equal(report.islands.reduce((n,x)=>n+x.residents,0),191);check('all 20 destinations flown; all 191 resident rows and 19 island stories checked');
  // A choice of the current island returns its introduction without launching again.
  await page.locator('#station-btn').tap();await page.locator('#station [data-go="studio"]').tap();
  assert.equal(await page.evaluate(()=>window.__isles.world.mode()),'island');
  assert.equal(await page.locator('#guide').getAttribute('data-page'),'1');check('current-island selection, revisit and tutorial reset');
  // Rapid actions must not resurrect an earlier greeting as an unrelated dialog.
  await page.locator('#station-btn').tap();await page.locator('#station [data-go="rainforest"]').tap();
  await page.waitForFunction(()=>window.__isles.world.mode()==='island'&&window.__isles.world.current().id==='rainforest');
  for(const control of ['station-btn','logbook-btn','map-btn']){
   if(await page.evaluate(()=>window.__isles.world.mode()==='overview')){await page.locator('#map-btn').tap();await page.waitForFunction(()=>window.__isles.world.mode()==='island')}
   await page.locator('#residents-btn').tap();
   await page.evaluate(control=>{document.querySelector('#people [data-ep]').click();document.getElementById(control).click()},control);
   await page.waitForTimeout(650);
   assert.equal(await page.locator('#channel').evaluate(d=>d.open),false,control);
   for(const id of ['station','journal'])await close(id);
  }
  check('a pending resident greeting cannot cover navigation or the journal');
  if(await page.evaluate(()=>window.__isles.world.mode()==='overview'))await page.locator('#map-btn').tap();
  await page.locator('#guide-btn').tap();await page.locator('.guide-close').tap();
  // Dragging and wheel/pinch zoom stay within a usable island view.
  const before=await page.evaluate(()=>({...window.__isles.world.debug.view,target:null}));
  await page.mouse.move(200,440);await page.mouse.down();await page.mouse.move(270,470,{steps:5});await page.mouse.up();
  const after=await page.evaluate(()=>({...window.__isles.world.debug.view,target:null}));assert.notEqual(after.yaw,before.yaw);
  await page.mouse.wheel(0,-150);await page.waitForFunction(dist=>window.__isles.world.debug.view.dist!==dist,after.dist);
  check('dragging and wheel zoom change the 3D camera');
  await page.locator('#residents-btn').tap();await page.keyboard.press('Escape');assert.equal(await page.locator('#people').evaluate(d=>d.open),false);
  await page.keyboard.press('r');await page.waitForSelector('#station[open]');await page.keyboard.press('Escape');
  await page.keyboard.press('m');assert.equal(await page.evaluate(()=>window.__isles.world.mode()),'overview');await page.keyboard.press('m');
  check('keyboard station/map shortcuts and Escape close');
  for(const viewport of [{width:320,height:568},{width:393,height:851},{width:844,height:390},{width:1280,height:800}]){
   await page.setViewportSize(viewport);
   const layout=await page.evaluate(()=>({width:innerWidth,body:document.documentElement.scrollWidth,buttons:[...document.querySelectorAll('.isle-bar button')].filter(b=>!b.hidden).map(b=>{const r=b.getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}})}));
   assert.ok(layout.body<=layout.width+1,JSON.stringify(layout));
   for(const r of layout.buttons){assert.ok(r.left>=0&&r.right<=layout.width+1&&r.top>=0&&r.bottom<=viewport.height+1,JSON.stringify(r));assert.ok(r.width>=44&&r.height>=44)}
  }
  check('320px portrait, Android portrait, landscape and desktop controls fit and remain tappable');
  assert.deepEqual(report.errors,[]);
  report.completed = true;
 } catch (error) {
  report.failure = String(error);
  if (process.env.QA_REPORT && page) await page.screenshot({path:process.env.QA_REPORT+'.png'}).catch(()=>{});
  throw error;
 } finally {
  if(process.env.QA_REPORT)fs.writeFileSync(process.env.QA_REPORT,JSON.stringify(report,null,2));
  await browser.close();
 }
})().catch(error=>{console.error(error);process.exitCode=1});
