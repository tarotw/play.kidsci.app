// 重做分享縮圖 assets/og-cover.jpg（1200×630，Facebook／LINE／X 分享時顯示）。
// 先在專案根目錄開本機網站：python3 -m http.server 8000
// 再執行：node tools/og/make_og.mjs（要 playwright；3D 要用 SwiftShader，CHROMIUM_PATH 可指定瀏覽器）
// 步驟：1. 拍雨林島近景（右邊）和後面的島；2. 用 card.html 疊上標誌、標題「科學好好聽 宇宙島」和說明；3. 存成 JPEG。
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
const dir = new URL('./', import.meta.url).pathname;
const opts = { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'], ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) };
const b = await chromium.launch(opts);
const p = await b.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 2 });
await p.route(/embed\.podcasts\.apple\.com|googletagmanager|google-analytics/, (r) => r.abort());
await p.goto('http://localhost:8000/?debug=1&isle=rainforest', { waitUntil: 'networkidle' });
await p.waitForFunction(() => document.body.classList.contains('ready') && window.__isles, null, { timeout: 120000 });
await p.addStyleTag({ content: 'body > *:not(#world){display:none!important}' });
await p.waitForTimeout(2500);
// 雨林島放在畫面右邊（左邊留給字）
await p.evaluate(() => {
  const w = window.__isles.world, v = w.debug.view, isle = w.debug.isles.find((q) => q.def.id === 'rainforest');
  const yaw = 3.9, k = -24;
  v.target.set(isle.pos.x + Math.cos(yaw) * k, isle.pos.y - 3, isle.pos.z - Math.sin(yaw) * k);
  v.yaw = yaw; v.pitch = 0.33; v.dist = 74;
});
await p.waitForTimeout(1500);
await p.screenshot({ path: dir + 'shot.png' });
await p.goto('http://localhost:8000/tools/og/card.html', { waitUntil: 'networkidle' });
await p.evaluate(() => document.fonts.ready);
await p.screenshot({ path: dir + 'card@2x.png' });
await b.close();
// 縮成 1200×630 的 JPEG
execFileSync('python3', ['-c', `from PIL import Image
im=Image.open('${dir}card@2x.png').convert('RGB').resize((1200,630),Image.LANCZOS)
im.save('${dir}../../assets/og-cover.jpg',quality=88,optimize=True,progressive=True)`]);
console.log('assets/og-cover.jpg 已更新');
