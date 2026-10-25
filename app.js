// 宇宙好好聽：萬物旋鈕。資料來自 data/world.json 與 data/catalog.json（由 tools/ 產生）。
import { createExplorer as createExplorer2d, iconFor } from './explorer.js';
import { createGuide } from './guide.js';
import { patchDialogs } from './compat.js';
import { createChannels, esc, fill, pick, stateBadge } from './channel.js';

const PREVIEW = true; // P0：所有格都打開，方便檢查分類。正式版改成 false，只開 world.mvp_levels。
const STORE_KEY = 'kidsci-universe-v1';

const $ = (sel) => document.querySelector(sel);

let world, episodes, byCode, explorer, guide, lines, channels;
const talked = new Set(); // 這次打開網頁已經介紹過的格
let view = { kind: 'level', id: 'l03' };
let listMode = false;

// ---------- 航行日誌（星章與探索紀錄） ----------
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
  if (kind !== 'seen') {
    const e = byCode.get(code);
    toast(`${kind === 'ear' ? '👂 耳朵章' : '✋ 小手章'} +1<br><small>${esc(code)} 台｜${esc(e?.title || '')}</small>`);
    explorer?.celebrate();
    popLogbook();
    guide?.say(lines.stamps[kind]);
    renderStops();
  }
  checkMissions();
  renderHud();
}
function popLogbook() {
  $('#logbook-btn').classList.remove('pop');
  void $('#logbook-btn').offsetWidth;
  $('#logbook-btn').classList.add('pop');
}

// ---------- 任務 ----------
function missionsFor(v) {
  if (v.kind !== 'level') return [];
  const here = episodes.filter((e) => e.home === v.id);
  const n = Math.min(3, here.filter((e) => e.state !== 'unreleased').length);
  const list = [];
  if (n) list.push({ id: `${v.id}:visit`, text: fill(lines.missions.visit, { n }), goal: n, count: () => here.filter((e) => stamps.seen.includes(e.code)).length });
  if (here.some((e) => e.state === 'subscriber')) list.push({ id: `${v.id}:gold`, text: lines.missions.gold, goal: 1, count: () => here.filter((e) => e.state === 'subscriber' && stamps.seen.includes(e.code)).length });
  if (here.some((e) => e.state === 'public' && e.listen?.audio)) list.push({ id: `${v.id}:listen`, text: lines.missions.listen, goal: 1, count: () => here.filter((e) => stamps.ear.includes(e.code)).length });
  return list;
}
function currentMission() {
  return missionsFor(view).find((m) => !stamps.missions.includes(m.id));
}
function checkMissions() {
  missionsFor(view).forEach((m) => {
    if (stamps.missions.includes(m.id) || m.count() < m.goal) return;
    stamps.missions.push(m.id);
    saveStamps();
    toast(`🏅 任務完成<br><small>${esc(m.text)}</small>`);
    explorer?.celebrate();
    popLogbook();
    guide?.say(lines.missions.done.map((l) => ({ ...l, text: fill(l.text, { mission: m.text }) })));
  });
}

// ---------- 大小猜猜看 ----------
function startGuess() {
  const levels = [...world.levels].sort(() => Math.random() - 0.5).slice(0, 2);
  const [a, b] = levels;
  const big = a.n > b.n ? a : b, small = big === a ? b : a;
  const vars = { a: a.name, b: b.name, big: big.name, small: small.name, bigScale: big.scale, smallScale: small.scale };
  const answer = (choice) => () => {
    const right = choice === big;
    if (right) { stamps.guess += 1; saveStamps(); explorer.celebrate(); toast('🧠 答對了！'); }
    guide.say([
      { who: 'captain', text: fill(right ? lines.guess.right : lines.guess.wrong, vars) },
      { who: 'captain', text: '再玩一次？', actions: [{ label: '🎲 再一題', run: startGuess }, { label: '不玩了', run: () => {} }] },
    ]);
  };
  guide.say([{ who: 'captain', text: fill(lines.guess.ask, vars), actions: [{ label: a.name, run: answer(a) }, { label: b.name, run: answer(b) }] }], { urgent: true });
}

// ---------- 主角說話的時機 ----------
function talkAboutView() {
  const key = view.kind === 'level' ? view.id : view.kind;
  if (talked.has(key)) return;
  talked.add(key);
  const said = view.kind === 'level' ? lines.levels[view.id] : lines.views[view.kind];
  const m = currentMission();
  const extra = m ? [{ who: 'captain', text: `新任務：${m.text}！` }] : [];
  guide.say([...(said || []), ...extra], { topic: 'scene' }); // 快速轉旋鈕時只講現在這一格
}
function suggestGo() {
  const e = explorer.suggest();
  if (!e) { guide.say([{ who: 'captain', text: '這一格都探索完了！轉轉旋鈕去下一格吧。' }], { urgent: true }); return; }
  const idle = pick(lines.idle);
  guide.say([{ who: idle.who, text: fill(idle.text, { title: e.title }), actions: [{ label: '🚀 帶我去', run: () => explorer.flyTo(e.code) }, { label: '等一下', run: () => {} }] }], { urgent: true });
}
function openGuideMenu() {
  if (!guide.on) { guide.on = true; }
  guide.say([{ ...lines.menu, actions: [
    { label: '🎲 大小猜猜看', run: startGuess },
    { label: '🎯 現在的任務', run: () => { const m = currentMission(); guide.say([{ who: 'captain', text: m ? `${m.text}（${Math.min(m.count(), m.goal)}／${m.goal}）` : '這一格的任務都完成了，太厲害了！' }]); } },
    { label: '🚀 帶我去一台', run: suggestGo },
    { label: '🤫 先不要說話', run: () => { guide.on = false; } },
  ] }], { urgent: true });
}
let idleTimer = null;
let idleNags = 0; // 推薦過幾次；每推薦一次就等更久，不會一直打擾
function resetIdle() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    const listening = !$('#audio').paused;
    if (listMode || listening || document.querySelector('dialog[open]') || guide.busy()) { resetIdle(); return; }
    idleNags += 1;
    suggestGo();
  }, 25000 * 2 ** Math.min(idleNags, 4));
}
const stampMarks = (code) => channels.stampMarks(code);
let toastTimer = null;
function toast(html) {
  const el = $('#toast');
  el.innerHTML = html;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

// ---------- 位置 ----------
function inView(e) {
  const homes = [e.home, ...(e.also || [])];
  if (view.kind === 'level') return homes.includes(view.id);
  if (view.kind === 'studio') return homes.includes('studio');
  return homes.includes(`${view.kind}:${view.id}`);
}
function levelUnlocked(id) {
  return PREVIEW || world.mvp_levels.includes(id);
}
function sceneView() {
  // 探索畫面把時光機與航道畫成一整張圖；清單模式才分年代、分航道。
  return view.kind === 'level' || view.kind === 'studio' ? view : { kind: view.kind, id: '*' };
}

// ---------- 畫面 ----------
function renderDial() {
  $('#dial-track').innerHTML = world.levels.map((l) => `
    <li><button class="knob${levelUnlocked(l.id) ? '' : ' locked'}" type="button" data-level="${l.id}"
      aria-current="${view.kind === 'level' && view.id === l.id}"${levelUnlocked(l.id) ? '' : ' aria-disabled="true"'}>
      <b>${String(l.n).padStart(2, '0')} ${esc(l.name)}</b><small>${esc(l.scale)}</small>
      ${world.mvp_levels.includes(l.id) ? '<span class="first">第一期開放</span>' : ''}</button></li>`).join('');
  const current = $(`.knob[data-level="${view.id}"]`);
  if (current) current.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  const extras = [['era', '⏳ 時光機'], ['lane', '✨ 法則航道'], ['studio', '🎙️ 錄音室']];
  $('#extras').innerHTML = extras.map(([kind, name]) =>
    `<button class="extra" role="tab" type="button" data-kind="${kind}" aria-selected="${view.kind === kind}">${name}</button>`).join('');
}

function sceneTitle() {
  if (view.kind === 'level') {
    const l = world.levels.find((x) => x.id === view.id);
    return [`${String(l.n).padStart(2, '0')} ${l.name}${l.start ? '・你在這裡' : ''}`, `大約 ${l.scale}`];
  }
  if (view.kind === 'studio') return ['🎙️ 錄音室', '出發點：特別節目、新訊號、VIP 介紹'];
  if (view.kind === 'era') return ['⏳ 時光機', '沿著時間河，從宇宙誕生到現在'];
  return ['✨ 法則航道', '同一個法則，穿過每一格'];
}

function renderHud() {
  const [name, meta] = sceneTitle();
  const p = explorer.progress(sceneView());
  $('#scene-name').textContent = name;
  $('#scene-meta').textContent = `${meta} · 已探索 ${p.seen}／${p.total} 台`;
  $('#explore-bar').style.width = `${p.total ? (p.seen / p.total) * 100 : 0}%`;
  const m = currentMission();
  const all = missionsFor(view);
  $('#mission').textContent = m ? `🎯 ${m.text}（${Math.min(m.count(), m.goal)}／${m.goal}）` : all.length ? '🏅 這一格的任務都完成了！' : '';
  $('#mission').classList.toggle('done', !m && all.length > 0);
}

function renderLevel() {
  let chips = '';
  const [title, meta] = sceneTitle();
  if (view.kind === 'level') {
    const l = world.levels.find((x) => x.id === view.id);
    chips = `<p class="meta">這一格有：${l.zones.map((z) => esc(z.name)).join('、')}</p>`;
  } else if (view.kind === 'era' || view.kind === 'lane') {
    const list = view.kind === 'era' ? world.eras : world.lanes;
    if (!list.some((x) => x.id === view.id)) view.id = list[0].id;
    chips = `<ul class="zones">${list.map((x) =>
      `<li><button type="button" data-sub="${x.id}" aria-pressed="${x.id === view.id}">${esc(x.name)}</button></li>`).join('')}</ul>`;
  }
  $('#level').innerHTML = `<h2>${esc(title)}</h2><p class="meta">${esc(meta)} · ${episodes.filter(inView).length} 集</p>${chips}`;
}


function renderStops() {
  if (!listMode) return;
  const q = $('#search').value.trim();
  const order = { public: 0, subscriber: 1, unreleased: 2 };
  const list = episodes.filter((e) => (q ? (e.title.includes(q) || e.code === q) : inView(e)))
    .sort((a, b) => order[a.state] - order[b.state]);
  $('#stops').innerHTML = list.map((e) => `
    <li><button class="stop ${e.state === 'subscriber' ? 'vip' : ''} ${e.state}" type="button" data-code="${esc(e.code)}">
      <span class="ch">${esc(e.code)}<small>台</small></span>
      <span class="t">${iconFor(e)} ${esc(e.title)}</span>
      <span class="tags">${stateBadge(e)}${e.labs.length ? `<span class="badge lab">實驗 ${e.labs.length}</span>` : ''}<span class="stamps">${stampMarks(e.code)}</span></span>
    </button></li>`).join('') || '<li class="hint">這裡還沒有集數。</li>';
}

function render({ moveScene = true } = {}) {
  renderDial();
  if (moveScene) { explorer.show(sceneView()); setTimeout(talkAboutView, 900); }
  renderHud();
  if (listMode) { renderLevel(); renderStops(); }
  const params = new URLSearchParams(location.search);
  params.set('lv', view.kind === 'level' ? view.id : `${view.kind}:${view.id}`);
  history.replaceState(null, '', `?${params}`);
}

function setListMode(on) {
  listMode = on;
  document.body.classList.toggle('list', on);
  $('#main').hidden = !on;
  $('#list-btn').setAttribute('aria-pressed', String(on));
  if (on) { renderLevel(); renderStops(); }
}

// ---------- 事件 ----------
function step(delta) {
  const ids = world.levels.map((l) => l.id);
  const i = view.kind === 'level' ? ids.indexOf(view.id) : ids.indexOf('l03');
  const next = ids[Math.min(ids.length - 1, Math.max(0, i + delta))];
  if (next !== view.id && levelUnlocked(next)) { view = { kind: 'level', id: next }; render(); }
}

function bind() {
  $('#dial-prev').addEventListener('click', () => step(-1));
  $('#dial-next').addEventListener('click', () => step(1));
  $('#dial-track').addEventListener('keydown', (ev) => {
    if (ev.key === 'ArrowLeft') { ev.preventDefault(); step(-1); $(`.knob[data-level="${view.id}"]`)?.focus(); }
    if (ev.key === 'ArrowRight') { ev.preventDefault(); step(1); $(`.knob[data-level="${view.id}"]`)?.focus(); }
  });
  document.addEventListener('click', (ev) => {
    const t = ev.target;
    const knob = t.closest('.knob');
    if (knob && levelUnlocked(knob.dataset.level)) {
      if (!(view.kind === 'level' && view.id === knob.dataset.level)) { view = { kind: 'level', id: knob.dataset.level }; render(); }
      return;
    }
    const extra = t.closest('.extra');
    if (extra) {
      const kind = extra.dataset.kind;
      if (view.kind !== kind) { view = { kind, id: kind === 'era' ? world.eras[0].id : kind === 'lane' ? world.lanes[0].id : 'studio' }; render(); }
      return;
    }
    const sub = t.closest('[data-sub]');
    if (sub) { view = { ...view, id: sub.dataset.sub }; render({ moveScene: false }); return; }
    const zoom = t.closest('[data-zoom]');
    if (zoom) { const d = Number(zoom.dataset.zoom); if (d) explorer.zoom(d); else explorer.home(); return; }
    const stop = t.closest('.stop');
    if (stop) channels.openChannel(stop.dataset.code);
  });
  document.addEventListener('keydown', (ev) => {
    if (listMode || document.querySelector('dialog[open]') || ev.target.closest('input, .tuner')) return;
    const pan = { ArrowLeft: [-80, 0], ArrowRight: [80, 0], ArrowUp: [0, -80], ArrowDown: [0, 80] }[ev.key];
    if (pan) { ev.preventDefault(); explorer.pan(...pan); }
    if (ev.key === '+' || ev.key === '=') explorer.zoom(1);
    if (ev.key === '-') explorer.zoom(-1);
  });
  $('#logbook-btn').addEventListener('click', () => channels.openJournal());
  $('#guide-btn').addEventListener('click', openGuideMenu);
  ['pointerdown', 'keydown', 'wheel'].forEach((type) => window.addEventListener(type, resetIdle, { passive: true }));
  $('#list-btn').addEventListener('click', () => setListMode(!listMode));
  $('#sound-btn').addEventListener('click', () => {
    explorer.sound.wake();
    explorer.sound.on = !explorer.sound.on;
    $('#sound-btn').textContent = explorer.sound.on ? '🔊' : '🔇';
    $('#sound-btn').setAttribute('aria-pressed', String(explorer.sound.on));
  });
  $('#search').addEventListener('input', renderStops);
}

// 先試 3D（WebGL）；舊裝置、關掉 WebGL 或 ?gl=0 就用 2D 版。
function webglOk() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}
async function makeExplorer(opts, force2d) {
  if (!force2d && webglOk()) {
    try {
      const { createExplorer } = await import('./explorer3d.js');
      const ex = createExplorer(opts);
      document.body.classList.add('gl');
      return ex;
    } catch (err) { console.warn('3D 啟動失敗，改用 2D', err); }
  }
  return createExplorer2d(opts);
}

async function init() {
  [world, { episodes }, lines] = await Promise.all([
    fetch('data/world.json').then((r) => r.json()),
    fetch('data/catalog.json').then((r) => r.json()),
    fetch('data/dialogue.json').then((r) => r.json()),
  ]);
  patchDialogs();
  guide = createGuide({ root: $('#guide'), cast: lines.cast });
  byCode = new Map(episodes.map((e) => [e.code, e]));
  channels = createChannels({
    byCode, lines, getStamps: () => stamps, addStamp,
    onOpen: () => { idleNags = 0; },
    onClear: () => { stamps = { ear: [], hand: [], seen: [], missions: [], guess: 0 }; saveStamps(); renderStops(); renderHud(); },
  });
  if (!PREVIEW) $('#preview-note').hidden = true;
  else setTimeout(() => { $('#preview-note').hidden = true; }, 8000);
  let firstVisit = true;
  try { firstVisit = !localStorage.getItem(`${STORE_KEY}-intro`); localStorage.setItem(`${STORE_KEY}-intro`, '1'); } catch { /* 沒有儲存也沒關係 */ }

  const params = new URLSearchParams(location.search);
  const lv = params.get('lv');
  if (lv) {
    const [kind, id] = lv.includes(':') ? lv.split(':') : ['level', lv];
    if (kind === 'level' ? world.levels.some((l) => l.id === id) && levelUnlocked(id) : ['era', 'lane', 'studio'].includes(kind)) view = { kind, id };
  }
  const ch = params.get('ch');
  if (ch && byCode.has(ch)) {
    const home = byCode.get(ch).home;
    view = home.includes(':') ? { kind: home.split(':')[0], id: home.split(':')[1] } : home === 'studio' ? { kind: 'studio', id: 'studio' } : { kind: 'level', id: home };
  }
  explorer = await makeExplorer({ canvas: $('#world'), world, episodes, getStamps: () => stamps, onPick: (code) => channels.openChannel(code), onReady: () => document.body.classList.add('ready') }, params.get('gl') === '0');
  // 隊長或博士說話時，耳機號上的那一位會跟著跳
  const guideRoot = $('#guide');
  new MutationObserver(() => explorer.talk?.(guideRoot.hidden ? null : guideRoot.dataset.who)).observe(guideRoot, { attributes: true, attributeFilter: ['hidden', 'data-who'] });
  bind();
  saveStamps();
  if (params.get('mode') === 'list') setListMode(true);
  if (firstVisit) {
    talked.add(view.kind === 'level' ? view.id : view.kind);
    guide.say(lines.intro, { then: () => { talked.delete(view.kind === 'level' ? view.id : view.kind); talkAboutView(); } });
  }
  render();
  resetIdle();
  if (ch && byCode.has(ch)) channels.openChannel(ch);
}

init().catch((err) => {
  console.error(err);
  $('#loading-text').innerHTML = '載入失敗了，可能是網路不穩。<br><button class="btn" type="button" onclick="location.reload()">重新整理</button>';
});
