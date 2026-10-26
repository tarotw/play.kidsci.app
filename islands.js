// 宇宙好好聽・宇宙群島：每一集故事都是一個小居民，住在浮在天上的島。坐火箭在島和島之間飛。
// 資料：data/islands.json（有哪些島、每座島住哪些集）、data/catalog.json、data/dialogue.json。
import { patchDialogs } from './compat.js';
import { createGuide } from './guide.js';
import { createChannels, esc, stateBadge } from './channel.js';
import { iconFor } from './explorer.js';

const STORE_KEY = 'kidsci-universe-v1'; // 航行日誌（跟其他版本共用）
const VISIT_KEY = 'kidsci-universe-isles-v1'; // 去過哪些島
const $ = (sel) => document.querySelector(sel);

let world, guide, channels, lines, byCode, isles, isleById, startId, groupDefs = [];

// ---------- 航行日誌 ----------
function loadStamps() {
  const empty = { ear: [], hand: [], seen: [], missions: [], guess: 0 };
  try { return { ...empty, ...(JSON.parse(localStorage.getItem(STORE_KEY)) || {}) }; } catch { return empty; }
}
let stamps = loadStamps();
function saveStamps() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(stamps)); } catch { /* 停用儲存時仍可玩 */ }
  $('#stamp-count').textContent = stamps.ear.length + stamps.hand.length;
}
function addStamp(kind, code) {
  if (stamps[kind].includes(code)) return;
  stamps[kind].push(code);
  saveStamps();
  world?.refreshMarks();
  renderHud();
  if (kind === 'seen') return;
  toast(`${kind === 'ear' ? '👂 耳朵章' : '✋ 小手章'} +1<br><small>${esc(byCode.get(code)?.title || '')}</small>`);
  world?.sound.chime();
  guide?.say(lines.stamps[kind]);
}
let visited = new Set();
try { visited = new Set(JSON.parse(localStorage.getItem(VISIT_KEY)) || []); } catch { /* 沒有也沒關係 */ }
function markVisit(id) { visited.add(id); try { localStorage.setItem(VISIT_KEY, JSON.stringify([...visited])); } catch { /* 沒關係 */ } }
let toastTimer = null;
function toast(html) {
  const el = $('#toast');
  el.innerHTML = html;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
}

// ---------- 每一集住哪一座島 ----------
function assign(defs, episodes) {
  // "l03:雨林" 是 l03 的雨林區；"l01"、"era:life"、"lane:force"、"studio" 是整個 home
  const match = (src, e) => {
    if (src.startsWith('era:') || src.startsWith('lane:') || !src.includes(':')) return e.home === src;
    const i = src.indexOf(':');
    return e.home === src.slice(0, i) && e.zone === src.slice(i + 1);
  };
  const out = defs.map((def) => ({ def, eps: [] }));
  episodes.forEach((e) => {
    const isle = out.find(({ def }) => def.sources.some((src) => match(src, e))) || out.find(({ def }) => def.id === startId);
    isle.eps.push({ ...e, icon: iconFor(e) });
  });
  // 一般可以聽的先、再來是 VIP（清單裡的順序）
  const order = { public: 0, subscriber: 1 };
  out.forEach((x) => x.eps.sort((a, b) => order[a.state] - order[b.state] || a.code.localeCompare(b.code, 'en', { numeric: true })));
  // 還沒有任何一集上架的島先不出現（有集數上架就會自動出現）
  return out.filter((x) => x.eps.length || x.def.id === startId);
}

// ---------- 上面的島名、下面的按鈕 ----------
function renderHud() {
  const def = world?.current();
  if (!def) {
    $('#isle-name').textContent = '🗺️ 宇宙群島';
    const heard = stamps.seen.filter((c) => byCode.has(c)).length;
    $('#isle-meta').textContent = `${isles.length} 座島 · 去過 ${visited.size} 座 · 拜訪過 ${heard} 個居民`;
    $('#isle-meta').hidden = false;
    $('#people-btn').hidden = true;
    $('#map-ico').textContent = '🏝️'; $('#map-txt').textContent = '回到島上';
    $('#map-btn').setAttribute('aria-label', '回到剛才的島');
    return;
  }
  const x = isleById.get(def.id);
  const seen = x.eps.filter((e) => stamps.seen.includes(e.code)).length;
  $('#isle-name').textContent = `${def.emoji} ${def.name}`;
  // 島名下面：這座島的居民（按了打開名單），一眼看出幾個免費、幾個 VIP
  const ct = (st) => x.eps.filter((e) => e.state === st).length;
  $('#people-count').textContent = `${x.eps.length} 位居民`;
  $('#people-legend').innerHTML = [[ct('public'), 'can', '▶ 可以聽'], [ct('subscriber'), 'vip', '👑 VIP']]
    .filter(([n]) => n).map(([n, cls, txt]) => `<span class="lg ${cls}">${txt} ${n}</span>`).join('') + (seen ? `<span class="lg-seen">✓ 拜訪過 ${seen}</span>` : '');
  $('#people-btn').setAttribute('aria-label', `看${def.name}的 ${x.eps.length} 位居民`);
  $('#people-btn').hidden = !x.eps.length;
  $('#isle-meta').hidden = !!x.eps.length;
  if (!x.eps.length) $('#isle-meta').textContent = '宇宙群島的母島 · 點科學隊長圖像聽玩法說明';
  $('#map-ico').textContent = '🗺️'; $('#map-txt').textContent = '全部的島';
  $('#map-btn').setAttribute('aria-label', '看全部的島');
  const p = new URLSearchParams(location.search);
  if (p.get('isle') !== def.id) { p.set('isle', def.id); history.replaceState(null, '', `?${p}`); }
}

// ---------- 火箭站：選一座島 ----------
function openStation() {
  const here = world.current()?.id;
  $('#station').innerHTML = `<div class="inner">
    <button class="close" type="button" data-close aria-label="關閉">✕</button>
    <h2 id="station-title">🚀 火箭站</h2>
    <p class="hint">想去哪一座島？點一下，火箭就出發！</p>
    ${[{ id: '', name: '母島', emoji: '🏝️' }, ...groupDefs].map((g) => {
      const list = isles.filter(({ def }) => (def.group || '') === g.id);
      if (!list.length) return '';
      return `<h3 class="isle-group">${g.emoji} ${esc(g.name)}</h3><ul class="isle-grid">${list.map(({ def, eps }) => {
        const seen = eps.filter((e) => stamps.seen.includes(e.code)).length;
        return `<li><button type="button" class="isle-pick${def.id === here ? ' here' : ''}" data-go="${def.id}" ${def.id === here ? 'aria-current="true"' : ''}>
          <span class="em">${def.emoji}</span><span class="nm">${esc(def.name)}</span>
          <span class="ct">${eps.length ? `${eps.length} 位居民${seen ? ` · 👋 ${seen}` : ''}` : '母島・玩法說明'}</span>${def.id === here ? '<span class="you">你在這裡</span>' : visited.has(def.id) ? '<span class="been">✓</span>' : ''}</button></li>`;
      }).join('')}</ul>`;
    }).join('')}</div>`;
  $('#station').showModal();
}

// ---------- 居民名單 ----------
function openPeople() {
  const def = world.current();
  if (!def) return;
  const x = isleById.get(def.id);
  const rows = x.eps.map((e) => `
    <li><button type="button" class="ep ${e.state}" data-ep="${esc(e.code)}">
      <span class="ic">${e.icon}</span><span class="tt">${esc(e.title)}</span>
      <span class="tg">${stateBadge(e)}${e.labs.length ? '<span class="badge lab">實驗</span>' : ''}${stamps.seen.includes(e.code) ? '<span class="badge seen">✓ 拜訪過</span>' : ''}</span></button></li>`).join('');
  $('#people').innerHTML = `<div class="inner">
    <button class="close" type="button" data-close aria-label="關閉">✕</button>
    <p class="hero" aria-hidden="true">${def.emoji}</p>
    <h2 id="people-title">${esc(def.name)}的居民</h2>
    <p class="hint">${x.eps.length} 個故事住在這裡。</p>
    <p class="legend"><span class="lg can">▶ 綠色：可以聽</span><span class="lg vip">👑 金色：VIP 訂閱集數</span></p>
    <ul class="eps">${rows}</ul></div>`;
  $('#people').showModal();
}

// ---------- 島名標籤（全景的時候每座島上面有名字；在島上時，遠方的島也看得到名字） ----------
const labels = new Map();
const groupLabels = new Map();
function makeLabels() {
  const box = $('#isle-labels');
  isles.forEach(({ def, eps }) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'isle-label';
    b.dataset.go = def.id;
    b.innerHTML = `<span class="em">${def.emoji}</span><span class="nm">${esc(def.name)}</span>${eps.length ? `<span class="ct">${eps.length}</span>` : ''}`;
    b.tabIndex = -1;
    box.appendChild(b);
    labels.set(def.id, b);
  });
  // 群島的名字（全景才出現，不能按）
  groupDefs.forEach((g) => {
    const el = document.createElement('div');
    el.className = 'group-label';
    el.innerHTML = `<span class="em">${g.emoji}</span>${esc(g.name)}`;
    el.style.visibility = 'hidden';
    box.appendChild(el);
    groupLabels.set(g.id, el);
  });
  box.addEventListener('click', (ev) => { const b = ev.target.closest('[data-go]'); if (b) go(b.dataset.go); });
}
function placeLabels() {
  requestAnimationFrame(placeLabels);
  if (!world || document.hidden) return;
  const mode = world.mode(), W = innerWidth, H = innerHeight;
  // 近的島先排；會疊到別人的標籤就只留圖示（手機上全景很擠），還是疊到就往上或往下挪一點
  // 上面的標題、按鈕、下面的大按鈕、隊長泡泡、播放器也算「佔住了」：標籤不躲在它們底下
  const hud = HUD_PARTS.map((sel) => document.querySelector(sel)).filter((el) => el && !el.hidden && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden').map((el) => {
    // 標題、說明只算字真正佔的地方（區塊本身可能拉得很寬）
    let r = el.getBoundingClientRect();
    if (el.matches('h1, p')) { labelRange.selectNodeContents(el); r = labelRange.getBoundingClientRect(); }
    return { l: r.left - 4, r: r.right + 4, t: r.top - 4, b: r.bottom + 4 };
  });
  const placed = [];
  // 全景：每個群島的名字（動物群島、科學群島…），先排，島名標籤會讓開
  groupLabels.forEach((el) => { el.style.visibility = 'hidden'; });
  if (mode === 'overview') world.groupScreens().forEach((g) => {
    const el = groupLabels.get(g.id); if (!el || g.behind) return;
    const w = el.offsetWidth || 120, h = el.offsetHeight || 30, r = { l: g.x - w / 2, r: g.x + w / 2, t: g.y - h / 2, b: g.y + h / 2 };
    // 跑出畫面就推回來；被按鈕、標題蓋住或跟別的群島名疊在一起就先不顯示
    const dx = Math.max(0, 6 - r.l) - Math.max(0, r.r - (W - 6)); r.l += dx; r.r += dx;
    if (r.t < 4 || r.b > H - 4 || hud.some((q) => r.l < q.r && q.l < r.r && r.t < q.b && q.t < r.b) || placed.some((q) => r.l < q.r && q.l < r.r && r.t < q.b && q.t < r.b)) return;
    el.style.visibility = ''; el.style.transform = `translate3d(${r.l.toFixed(1)}px, ${r.t.toFixed(1)}px, 0)`;
    placed.push(r);
  });
  const over = (r, list) => list.some((q) => r.l < q.r && q.l < r.r && r.t < q.b && q.t < r.b);
  world.islandScreens().sort((a, b) => a.dist - b.dist).forEach((s) => {
    const b = labels.get(s.id);
    let show = mode !== 'flight' && !s.behind && !(mode === 'island' && s.here) && s.x > -60 && s.x < W + 60 && s.y > 40 && s.y < H - 40;
    if (show) {
      const far = mode === 'island';
      if (!b.dataset.w) { b.classList.remove('mini', 'far'); b.dataset.w = b.offsetWidth; b.classList.add('far'); b.dataset.wf = b.offsetWidth; }
      const w = Number(far ? b.dataset.wf : b.dataset.w), h = far ? 26 : 32;
      const box = (half, dy) => ({ l: s.x - half, r: s.x + half, t: s.y + dy - h, b: s.y + dy });
      // 試試看：完整標籤 → 只留圖示 → 圖示往上挪 → 圖示往下挪
      const tries = [[w / 2, 0, false], [18, 0, true], [18, -h - 2, true], [18, h + 2, true]];
      const ok = tries.find(([half, dy]) => { const r = box(half, dy); return !over(r, hud) && !over(r, placed) && r.l > 2 && r.r < W - 2; });
      if (ok) {
        const [half, dy, mini] = ok;
        placed.push(box(half, dy));
        b.classList.toggle('far', far);
        b.classList.toggle('mini', mini);
        b.style.transform = `translate3d(${s.x.toFixed(1)}px, ${(s.y + dy).toFixed(1)}px, 0)`;
      } else show = false; // 擠不下（或被按鈕蓋住）：這一格先不顯示，島本身還是點得到
    }
    b.style.visibility = show ? '' : 'hidden';
  });
}
// 量下面大按鈕、播放器、上方標題的高度，給 CSS 排隊長泡泡和按鈕的位置用（才不會互相蓋住）
function measureHud() {
  const st = document.body.style, bar = document.querySelector('.isle-bar');
  const top = Math.max(...['.hud-top .brand', '#isle-meta', '#people-btn', '.hud-buttons'].map((sel) => document.querySelector(sel)?.getBoundingClientRect().bottom || 0));
  st.setProperty('--bar-h', `${bar.offsetHeight}px`);
  st.setProperty('--top-h', `${Math.round(top)}px`);
}
if ('ResizeObserver' in window) { const ro = new ResizeObserver(measureHud); ['.isle-bar', '.hud-top'].forEach((sel) => ro.observe(document.querySelector(sel))); }
addEventListener('resize', measureHud);
measureHud();
const HUD_PARTS = ['.hud-top .brand', '#isle-name', '#isle-meta', '#people-btn', '.hud-buttons', '.isle-bar', '#guide'];
const labelRange = document.createRange();

function go(id) {
  if (world.busy()) return;
  if (!world.travel(id)) return;
}

// 每次進島都顯示該島介紹；到訪紀錄只用來標記地圖，不限制介紹次數。
function introduceIsland(def) {
  guide.on = true;
  if (def.tour?.length) { guide.showPages(def.tour, { onDone: openStation }); return; }
  guide.say([{ who: 'captain', text: def.intro }], { urgent: true, topic: 'isle' });
}

// ---------- 隊長選單 ----------
function openGuideMenu() {
  if (!guide.on) guide.on = true;
  const def = world.current();
  if (def?.id === startId) { introduceIsland(def); return; }
  const x = def && isleById.get(def.id);
  const fresh = x?.eps.find((e) => !stamps.seen.includes(e.code));
  const next = isles.find(({ def: d }) => !visited.has(d.id));
  guide.say([{ who: 'captain', text: '需要幫忙嗎？', actions: [
    ...(fresh ? [{ label: `👋 介紹一個居民給我`, run: () => meet(fresh.code) }] : []),
    { label: '🚀 去別的島', run: openStation },
    { label: '🏝️ 回好好聽島', run: () => go(startId) },
    ...(next ? [{ label: `🏝️ 帶我去${next.def.name}`, run: () => go(next.def.id) }] : []),
    { label: '🤫 先不要說話', run: () => { guide.on = false; } },
  ] }], { urgent: true });
}
/** 跟一個居民打招呼：讓他跳一跳，再打開他的故事卡。 */
function meet(code) {
  world.greet(code);
  openSoon(code);
}
// 先讓居民跳一下再打開卡片；連點好幾次只開最後一次
let openTimer = 0;
function openSoon(code) { clearTimeout(openTimer); openTimer = setTimeout(() => channels.openChannel(code), 450); }

function bind() {
  $('#station-btn').addEventListener('click', openStation);
  $('#people-btn').addEventListener('click', openPeople);
  $('#map-btn').addEventListener('click', () => { if (world.busy()) return; if (world.mode() === 'overview') { const id = world.lastIsland(); world.travel(id); } else world.overview(); });
  $('#station').addEventListener('click', (ev) => { const b = ev.target.closest('[data-go]'); if (b) { $('#station').close(); go(b.dataset.go); } });
  $('#people').addEventListener('click', (ev) => { const b = ev.target.closest('[data-ep]'); if (b) { $('#people').close(); meet(b.dataset.ep); } });
  $('#guide-btn').addEventListener('click', openGuideMenu);
  $('#logbook-btn').addEventListener('click', () => channels.openJournal());
  $('#sound-btn').addEventListener('click', () => {
    world.sound.wake();
    world.sound.on = !world.sound.on;
    $('#sound-btn').textContent = world.sound.on ? '🔊' : '🔇';
    $('#sound-btn').setAttribute('aria-pressed', String(world.sound.on));
  });
  document.addEventListener('keydown', (ev) => {
    if (document.querySelector('dialog[open]') || ev.target.closest('input')) return;
    if (ev.key === 'r' || ev.key === 'R') openStation();
    if (ev.key === 'm' || ev.key === 'M') $('#map-btn').click();
  });
  ['pointerdown', 'keydown', 'wheel'].forEach((t) => window.addEventListener(t, resetIdle, { passive: true }));
}
const LISTEN = { public: '▶ 免費收聽（Apple Podcasts、Spotify）', subscriber: '👑 VIP 訂閱集數' };
function showTip(code, x, y) {
  const tip = $('#isle-tip');
  if (!code || document.querySelector('dialog[open]')) { tip.hidden = true; return; }
  const e = byCode.get(code);
  tip.innerHTML = `${esc(e.title)}<small class="st ${e.state}">${LISTEN[e.state] || ''}</small>`;
  tip.hidden = false;
  tip.style.transform = `translate(${Math.round(x + 14)}px, ${Math.round(y - 40)}px)`;
}

// 閒置太久：提醒可以點居民或坐火箭
let idleTimer = null, idleNags = 0;
function resetIdle() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (document.querySelector('dialog[open]') || guide.busy() || world.busy()) { resetIdle(); return; }
    idleNags += 1;
    const def = world.current();
    guide.say([def && isleById.get(def.id)?.eps.length
      ? { who: 'captain', text: '島上的小居民都是一集故事喔！點一個跟他打招呼？', actions: [{ label: '👥 看居民名單', run: openPeople }, { label: '🚀 去別的島', run: openStation }] }
      : { who: 'captain', text: '要去哪一座島？點一座島，火箭就會飛過去！', actions: [{ label: '🚀 去別的島', run: openStation }] }], { urgent: true });
    resetIdle();
  }, 35000 * 2 ** Math.min(idleNags, 3));
}

function webglOk() {
  try { const c = document.createElement('canvas'); return !!c.getContext('webgl2'); } catch { return false; }
}

async function init() {
  const [catalog, dialogue, data] = await Promise.all([
    fetch('data/catalog.json').then((r) => r.json()),
    fetch('data/dialogue.json').then((r) => r.json()),
    fetch('data/islands.json').then((r) => r.json()),
  ]);
  patchDialogs();
  lines = dialogue;
  startId = data.start;
  byCode = new Map(catalog.episodes.map((e) => [e.code, e]));
  isles = assign(data.islands, catalog.episodes);
  groupDefs = (data.groups || []).filter((g) => isles.some((x) => x.def.group === g.id));
  isleById = new Map(isles.map((x) => [x.def.id, x]));
  guide = createGuide({ root: $('#guide'), cast: lines.cast });
  channels = createChannels({
    byCode, lines, getStamps: () => stamps, addStamp,
    onOpen: () => { idleNags = 0; $('#isle-tip').hidden = true; },
    onClear: () => { stamps = { ear: [], hand: [], seen: [], missions: [], guess: 0 }; saveStamps(); world.refreshMarks(); renderHud(); },
  });
  if (!webglOk()) {
    $('#loading-text').innerHTML = '這台裝置沒辦法顯示 3D 的宇宙群島。<br><a class="btn" href="knob.html?gl=0">改用平面的萬物地圖</a>';
    return;
  }
  // 分享連結：?ch=代碼 從那一集住的島出發；?isle=島 從那座島出發
  const params = new URLSearchParams(location.search);
  const ch = params.get('ch');
  const chIsle = ch && isles.find((x) => x.eps.some((e) => e.code === ch));
  // 舊版的 ?lv=大主題（例如 l07 太陽系）：去住最多那個主題的島
  const lv = params.get('lv');
  const lvIsle = lv && isles.map((x) => ({ x, n: x.eps.filter((e) => e.home === lv || e.home.startsWith(`${lv}:`)).length })).sort((a, b) => b.n - a.n).find((y) => y.n)?.x;
  const want = chIsle?.def.id || (isleById.has(params.get('isle')) ? params.get('isle') : lvIsle?.def.id || startId);
  const { createIsles } = await import('./isles3d.js');
  let lastIsland = want;
  world = createIsles({
    canvas: $('#world'), islands: isles, startId: want, getStamps: () => stamps,
    onReady: () => document.body.classList.add('ready'),
    onResident: openSoon,
    onHover: showTip,
    onLaunch: (def) => { guide.dismiss(); toast(`🚀 出發！<br><small>飛往${esc(def.name)}</small>`); },
    onArrive: (def) => {
      renderHud();
      if (!def) { guide.dismiss(); return; }
      lastIsland = def.id;
      markVisit(def.id);
      introduceIsland(def);
    },
  });
  world.lastIsland = () => lastIsland;
  makeLabels();
  placeLabels();
  bind();
  saveStamps();
  renderHud();
  markVisit(want);
  if (ch && byCode.has(ch)) setTimeout(() => meet(ch), 800);
  else introduceIsland(isleById.get(want).def);
  resetIdle();
  if (/[?&]debug\b/.test(location.search) || navigator.webdriver) window.__isles = { world, isles, stamps: () => stamps };
}

init().catch((err) => {
  console.error(err);
  $('#loading-text').innerHTML = '載入失敗了，可能是網路不穩。<br><button class="btn" type="button" onclick="location.reload()">重新整理</button>';
});
