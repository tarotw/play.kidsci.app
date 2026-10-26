// Serve the repository on port 8000, then run with Playwright available in NODE_PATH.
// BASE_URL can point to the deployed site; CHROMIUM_PATH selects a system browser.
const { chromium, devices } = require('playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
    args: ['--no-sandbox', '--enable-unsafe-swiftshader'],
  });
  try {
    const page = await browser.newPage({ ...devices['Pixel 7'], deviceScaleFactor: 1, reducedMotion: 'reduce' });
    page.setDefaultTimeout(60000);
    const errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    await page.goto((process.env.BASE_URL || 'http://localhost:8000') + '/?isle=rainforest');
    await page.waitForFunction(() => window.__isles && document.body.classList.contains('ready'));
    await page.locator('.guide-close').tap();
    // Activate both controls in one turn, before the overview camera can finish moving.
    const immediate = await page.evaluate(() => {
      const { world } = window.__isles;
      document.querySelector('#map-btn').click();
      document.querySelector('.isle-label[data-go="ocean"] .em').click();
      return { mode: world.mode(), destination: world.debug.flight?.to.def.id };
    });
    assert.deepEqual(immediate, { mode: 'flight', destination: 'ocean' });
    const origin = await page.evaluate(() => window.__isles.world.debug.ship.position.toArray());
    await page.waitForFunction(origin => {
      const { world } = window.__isles;
      return world.debug.ship.position.distanceTo({ x: origin[0], y: origin[1], z: origin[2] }) > 3;
    }, origin);
    // A second destination during flight must not interrupt the current journey.
    const inFlight = await page.evaluate(() => {
      document.querySelector('.isle-label[data-go="desert"]').click();
      return window.__isles.world.debug.flight.to.def.id;
    });
    assert.equal(inFlight, 'ocean');
    await page.waitForFunction(() => window.__isles.world.mode() === 'island' && window.__isles.world.current().id === 'ocean');
    assert.match(await page.locator('#isle-name').innerText(), /深海/);
    assert.equal(new URL(page.url()).searchParams.get('isle'), 'ocean');
    console.log('PASS: immediate overview selection launches, moves and arrives; flight cannot be interrupted.');

    // Use an actual touch hit on a visible map label, including its child icon/text.
    await page.locator('#map-btn').tap();
    await page.waitForFunction(() => [...document.querySelectorAll('.isle-label')].some(button => {
      const r = button.getBoundingClientRect();
      return button.dataset.go !== 'ocean' && getComputedStyle(button).visibility !== 'hidden' &&
        document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest('.isle-label') === button;
    }));
    await page.waitForFunction(() => {
      const distance = window.__isles.world.debug.view.dist;
      window.__stableMapFrames = Math.abs(distance - (window.__lastMapDistance || 0)) < 0.001 ? (window.__stableMapFrames || 0) + 1 : 0;
      window.__lastMapDistance = distance;
      return window.__stableMapFrames >= 4;
    });
    const touch = await page.evaluate(() => {
      const button = [...document.querySelectorAll('.isle-label')].find(button => {
        const r = button.getBoundingClientRect();
        return button.dataset.go !== 'ocean' && getComputedStyle(button).visibility !== 'hidden' &&
          document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest('.isle-label') === button;
      });
      const r = button.getBoundingClientRect();
      return { id: button.dataset.go, x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    await page.touchscreen.tap(touch.x, touch.y);
    await page.waitForFunction(id => window.__isles.world.debug.flight?.to.def.id === id, touch.id);
    await page.waitForFunction(id => window.__isles.world.mode() === 'island' && window.__isles.world.current().id === id, touch.id);
    console.log('PASS: a touch on the overview map flies to ' + touch.id + '.');

    // The station shares the same launch path and closes before departure.
    const stationTarget = touch.id === 'studio' ? 'rainforest' : 'studio';
    await page.locator('#station-btn').tap();
    await page.locator(`#station [data-go="${stationTarget}"] .nm`).tap();
    await page.waitForFunction(id => window.__isles.world.debug.flight?.to.def.id === id, stationTarget);
    assert.equal(await page.locator('#station').evaluate(dialog => dialog.open), false);
    await page.waitForFunction(id => window.__isles.world.mode() === 'island' && window.__isles.world.current().id === id, stationTarget);
    assert.equal(new URL(page.url()).searchParams.get('isle'), stationTarget);
    assert.deepEqual(errors, []);
    console.log('PASS: station selection closes the list and flies to the selected island; no JavaScript errors.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
