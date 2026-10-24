// 宇宙好好聽・一路放大縮小（小樣本）：畫面、萬物電梯、東西的集數清單、星章。
// 資料：data/zoom.json（每層有哪些東西、每個東西有哪幾集）、data/catalog.json、data/dialogue.json。
import { patchDialogs } from './compat.js';
import { createGuide } from './guide.js';
import { createChannels, esc, stateBadge } from './channel.js';
import { iconFor } from './explorer.js';

const STORE_KEY = 'kidsci-universe-v1'; // 跟萬物旋鈕版共用同一本航行日誌
const $ = (sel) => document.querySelector(sel);

let layers, byCode, lines, world, guide, channels;
const visited = new Set(); // 這次已經介紹過的層

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
  if (kind === 'seen') return;
  const e = byCode.get(code);
  toast(`${kind === 'ear' ? '👂 耳朵章' : '✋ 小手章'} +1<br><small>${esc(e?.title || '')}</small>`);
  world?.celebrate();
  guide?.say(lines.stamps[kind]);
}
let toastTimer = null;
function toast(html) {
  const el = $('#toast');
  el.innerHTML = html;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
}

// ---------- 萬物電梯與下方按鈕 ----------
function renderHud(def) {
  const i = layers.findIndex((l) => l.id === def.id);
  $('#layer-name').textContent = `${def.emoji} ${def.name}`;
  $('#layer-size').textContent = `大約 ${def.size} · ${def.vsYou}`;
  $('#elevator').innerHTML = `<p class="ev-cap">萬物電梯</p><ol>${layers.map((l, k) => `
    <li><button type="button" class="floor${k === i ? ' here' : ''}" data-floor="${l.id}" aria-current="${k === i}" aria-label="${esc(l.name)}">
      <span class="em">${l.emoji}</span><span class="nm">${esc(l.name)}</span>${l.id === 'you' ? '<span class="you">你在這裡</span>' : ''}</button></li>`).join('')}</ol>`;
  const outer = layers[i - 1], inner = layers[i + 1];
  $('#btn-out').disabled = !outer;
  $('#btn-in').disabled = !inner;
  $('#out-to').textContent = outer ? `${outer.emoji} ${outer.name}` : '最大了';
  $('#in-to').textContent = inner ? `${inner.emoji} ${inner.name}` : '最小了';
  const p = new URLSearchParams(location.search);
  p.set('layer', def.id);
  history.replaceState(null, '', `?${p}`);
}

// ---------- 東西的集數清單 ----------
function openThing(t, { door, childName }) {
  const eps = t.codes.map((c) => byCode.get(c)).filter(Boolean);
  if (!door && eps.length === 1) { channels.openChannel(eps[0].code); return; }
  const rows = eps.map((e) => `
    <li><button type="button" class="ep ${e.state}" data-ep="${esc(e.code)}">
      <span class="ic">${iconFor(e)}</span><span class="tt">${esc(e.title)}</span>
      <span class="tg">${stateBadge(e)}${e.labs.length ? '<span class="badge lab">實驗</span>' : ''}${stamps.seen.includes(e.code) ? '<span class="badge seen">✓ 聽過</span>' : ''}</span></button></li>`).join('');
  $('#thing').innerHTML = `<div class="inner">
    <button class="close" type="button" data-close aria-label="關閉">✕</button>
    <p class="hero" aria-hidden="true">${t.emoji}</p>
    <h2 id="thing-title">${esc(t.name)}</h2>
    ${eps.length ? `<p class="hint">這裡有 ${eps.length} 個故事，點一個來聽</p><ul class="eps">${rows}</ul>` : ''}
    ${door ? `<button class="btn dive" type="button" data-dive>🔍 鑽進去・${esc(childName)}</button>` : ''}</div>`;
  $('#thing').showModal();
}

// ---------- 隊長選單 ----------
function openGuideMenu() {
  if (!guide.on) guide.on = true;
  const def = world.current();
  const unseen = def.things.filter((t) => t.codes.length && !t.codes.every((c) => stamps.seen.includes(c)));
  guide.say([{ who: 'captain', text: '需要幫忙嗎？想去哪裡？', actions: [
    ...(unseen.length ? [{ label: `👀 帶我看${unseen[0].name}`, run: () => openThing(unseen[0], { door: !!unseen[0].door, childName: '' }) }] : []),
    { label: '🔍 鑽進去', run: () => world.dive() },
    { label: '🔭 退出來', run: () => world.surface() },
    { label: '🤫 先不要說話', run: () => { guide.on = false; } },
  ] }], { urgent: true });
}

function bind() {
  $('#btn-in').addEventListener('click', () => world.dive());
  $('#btn-out').addEventListener('click', () => world.surface());
  $('#elevator').addEventListener('click', (ev) => { const f = ev.target.closest('[data-floor]'); if (f) world.goTo(f.dataset.floor); });
  $('#thing').addEventListener('click', (ev) => {
    const ep = ev.target.closest('[data-ep]');
    if (ep) channels.openChannel(ep.dataset.ep); // 頻道卡疊在清單上面，關掉就回到清單
    if (ev.target.closest('[data-dive]')) { $('#thing').close(); world.dive(); }
  });
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
    if (ev.key === '+' || ev.key === '=' || ev.key === 'PageDown') world.dive();
    if (ev.key === '-' || ev.key === 'PageUp') world.surface();
  });
}

function webglOk() {
  try { const c = document.createElement('canvas'); return !!c.getContext('webgl2'); } catch { return false; }
}

async function init() {
  const [catalog, dialogue, zoom] = await Promise.all([
    fetch('data/catalog.json').then((r) => r.json()),
    fetch('data/dialogue.json').then((r) => r.json()),
    fetch('data/zoom.json').then((r) => r.json()),
  ]);
  patchDialogs();
  lines = dialogue;
  layers = zoom.layers;
  byCode = new Map(catalog.episodes.map((e) => [e.code, e]));
  guide = createGuide({ root: $('#guide'), cast: lines.cast });
  channels = createChannels({
    byCode, lines, getStamps: () => stamps, addStamp,
    onClear: () => { stamps = { ear: [], hand: [], seen: [], missions: [], guess: 0 }; saveStamps(); world.refreshMarks(); },
  });
  if (!webglOk()) {
    $('#loading-text').innerHTML = '這台裝置沒辦法顯示 3D 宇宙。<br><a class="btn" href="knob.html?gl=0">改用平面的萬物地圖</a>';
    return;
  }
  const { createZoomWorld } = await import('./zoom3d.js');
  world = createZoomWorld({
    canvas: $('#world'), layers, byCode, getStamps: () => stamps,
    onReady: () => document.body.classList.add('ready'),
    onThing: openThing,
    onLayer: (def) => {
      renderHud(def);
      if (!visited.has(def.id)) { visited.add(def.id); setTimeout(() => guide.say(def.lines, { topic: 'layer' }), 700); }
    },
    onEdge: (dir) => toast(dir === 'outer' ? '🌌 更大的銀河和宇宙<br><small>下一版開放</small>' : '🔬 更小的夸克世界<br><small>下一版開放</small>'),
  });
  bind();
  saveStamps();
  const want = new URLSearchParams(location.search).get('layer');
  world.start(layers.some((l) => l.id === want) ? want : zoom.start);
}

init().catch((err) => {
  console.error(err);
  $('#loading-text').innerHTML = '載入失敗了，可能是網路不穩。<br><button class="btn" type="button" onclick="location.reload()">重新整理</button>';
});
