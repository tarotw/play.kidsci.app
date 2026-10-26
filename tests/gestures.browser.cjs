// Actual scene hit testing and multi-touch, including a normal-motion rocket flight.
const {chromium,devices}=require('playwright'),assert=require('node:assert/strict');
const base=process.env.BASE_URL||'http://localhost:8000';
(async()=>{const b=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox','--enable-unsafe-swiftshader']});try{
 const context=await b.newContext({...devices['Pixel 7'],deviceScaleFactor:1,reducedMotion:'reduce'});const p=await context.newPage();p.setDefaultTimeout(60000);await p.goto(base+'/?isle=rainforest');await p.waitForFunction(()=>window.__isles&&document.body.classList.contains('ready'));await p.locator('.guide-close').click();
 const pick=()=>p.evaluate(()=>{
  const w=window.__isles.world;
  return w.debug.people.filter(person=>person.isle.def.id===w.current().id).map(person=>({code:person.e.code,...w.residentScreen(person.e.code)})).find(point=>point.y>170&&point.y<innerHeight-140&&document.elementFromPoint(point.x,point.y)?.id==='world');
 });
 let target=await pick();assert.ok(target);await p.touchscreen.tap(target.x,target.y);await p.waitForSelector('#channel[open]');assert.equal(new URL(p.url()).searchParams.get('ch'),target.code);await p.locator('#channel .close').click();
 console.log('PASS: an actual 3D resident touch opens its own story.');
 target=await pick();assert.ok(target);
 await p.mouse.move(target.x,target.y);await p.mouse.down();await p.mouse.move(target.x+65,target.y+10,{steps:4});await p.mouse.up();await p.waitForTimeout(600);assert.equal(await p.locator('#channel').evaluate(d=>d.open),false);
 console.log('PASS: dragging the scene from a resident does not accidentally open a story.');
 const before=await p.evaluate(()=>window.__isles.world.debug.view.dist);const cdp=await context.newCDPSession(p);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:145,y:450,id:1},{x:245,y:450,id:2}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:110,y:450,id:1},{x:280,y:450,id:2}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await p.waitForFunction(distance=>window.__isles.world.debug.view.dist<distance,before);assert.equal(await p.locator('#channel').evaluate(d=>d.open),false);
 console.log('PASS: a real two-finger pinch zooms without selecting a resident.');
 await context.close();
 const desktop=await b.newContext({viewport:{width:1280,height:800},deviceScaleFactor:1,reducedMotion:'no-preference'});const d=await desktop.newPage();d.setDefaultTimeout(60000);await d.goto(base+'/?isle=rainforest');await d.waitForFunction(()=>window.__isles&&document.body.classList.contains('ready'));await d.locator('.guide-close').click();await d.locator('#map-btn').click();await d.evaluate(()=>document.querySelector('.isle-label[data-go="moon"]').click());await d.waitForFunction(()=>window.__isles.world.mode()==='flight');
 assert.ok(await d.evaluate(()=>window.__isles.world.debug.flight.pre>.1&&window.__isles.world.debug.flight.dur>3));await d.waitForFunction(()=>window.__isles.world.mode()==='island'&&window.__isles.world.current().id==='moon');assert.match(await d.locator('#isle-name').innerText(),/月亮/);
 console.log('PASS: desktop normal-motion launch, flight and arrival work alongside reduced-motion tests.');
 }finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
