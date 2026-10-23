// 宇宙好好聽：萬物旋鈕 P0 預覽。資料來自 data/world.json 與 data/catalog.json（由 tools/ 產生）。
const PREVIEW = true; // P0：所有格都打開，方便檢查分類。正式版改成 false，只開 world.mvp_levels。
const LAB_ORIGIN = 'https://lab.kidsci.app';
const STORE_KEY = 'kidsci-universe-v1';
const LAB_STAMP_SECONDS = 60;

const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let world, episodes, byCode;
let view = { kind: 'level', id: 'l03' };
let labTimer = null;

// ---------- 航行日誌（星章） ----------
function loadStamps() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || { ear: [], hand: [] }; }
  catch { return { ear: [], hand: [] }; }
}
let stamps = loadStamps();
function saveStamps() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(stamps)); } catch { /* 停用儲存時仍可玩 */ }
  $('#stamp-count').textContent = stamps.ear.length + stamps.hand.length;
}
function addStamp(kind, code) {
  if (!stamps[kind].includes(code)) { stamps[kind].push(code); saveStamps(); renderStops(); }
}
function stampMarks(code) {
  return (stamps.ear.includes(code) ? '👂' : '') + (stamps.hand.includes(code) ? '✋' : '');
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

// ---------- 畫面 ----------
function renderDial() {
  $('#dial-track').innerHTML = world.levels.map((l) => `
    <li><button class="knob${levelUnlocked(l.id) ? '' : ' locked'}" type="button" data-level="${l.id}"
      aria-current="${view.kind === 'level' && view.id === l.id}"${levelUnlocked(l.id) ? '' : ' aria-disabled="true"'}>
      <b>${String(l.n).padStart(2, '0')} ${esc(l.name)}</b><small>${esc(l.scale)}</small>
      ${world.mvp_levels.includes(l.id) ? '<span class="first">第一期開放</span>' : ''}</button></li>`).join('');
  const current = $(`.knob[data-level="${view.id}"]`);
  if (current) current.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });

  const extras = [['era', '時光機'], ['lane', '法則航道'], ['studio', '錄音室']];
  $('#extras').innerHTML = extras.map(([kind, name]) =>
    `<button class="extra" role="tab" type="button" data-kind="${kind}" aria-selected="${view.kind === kind}">${name}</button>`).join('');
}

function renderLevel() {
  let title, meta, chips = '';
  if (view.kind === 'level') {
    const l = world.levels.find((x) => x.id === view.id);
    title = `${String(l.n).padStart(2, '0')} ${l.name}${l.start ? '・你在這裡' : ''}`;
    meta = `大約 ${l.scale}`;
    chips = `<p class="meta">這一格會有：${l.zones.map(esc).join('、')}</p>`;
  } else if (view.kind === 'studio') {
    title = '錄音室';
    meta = '出發點：特別節目、還沒歸位的新訊號、VIP 介紹';
  } else {
    const list = view.kind === 'era' ? world.eras : world.lanes;
    const cur = list.find((x) => x.id === view.id) || list[0];
    view.id = cur.id;
    title = view.kind === 'era' ? `時光機：${cur.name}` : `法則航道：${cur.name}`;
    meta = view.kind === 'era' ? '沿著時間軸，回到那個年代' : '同一個法則，在每一格的樣子';
    chips = `<ul class="zones">${list.map((x) =>
      `<li><button type="button" data-sub="${x.id}" aria-pressed="${x.id === cur.id}">${esc(x.name)}</button></li>`).join('')}</ul>`;
  }
  const count = episodes.filter(inView).length;
  $('#level').innerHTML = `<h2>${esc(title)}</h2><p class="meta">${esc(meta)} · ${count} 集</p>${chips}`;
}

function stateBadge(e) {
  if (e.state === 'subscriber') return '<span class="badge vip">VIP</span>';
  if (e.state === 'unreleased') return '<span class="badge soon">即將登場</span>';
  return '<span class="badge">公開</span>';
}

function renderStops() {
  const q = $('#search').value.trim();
  const order = { public: 0, subscriber: 1, unreleased: 2 };
  const list = episodes.filter((e) => (q ? (e.title.includes(q) || e.code === q) : inView(e)))
    .sort((a, b) => order[a.state] - order[b.state]);
  $('#stops').innerHTML = list.map((e) => `
    <li><button class="stop ${e.state === 'subscriber' ? 'vip' : ''} ${e.state}" type="button" data-code="${esc(e.code)}">
      <span class="ch">${esc(e.code)}<small>台</small></span>
      <span class="t">${esc(e.title)}</span>
      <span class="tags">${stateBadge(e)}${e.labs.length ? `<span class="badge lab">實驗 ${e.labs.length}</span>` : ''}<span class="stamps">${stampMarks(e.code)}</span></span>
    </button></li>`).join('') || '<li class="hint">這裡還沒有集數。</li>';
}

function render() {
  renderDial();
  renderLevel();
  renderStops();
  const params = new URLSearchParams(location.search);
  params.set('lv', view.kind === 'level' ? view.id : `${view.kind}:${view.id}`);
  history.replaceState(null, '', `?${params}`);
}

// ---------- 頻道卡 ----------
async function openChannel(code) {
  const e = byCode.get(code);
  if (!e) return;
  let content = null;
  if (e.content) {
    try { content = await (await fetch(e.content)).json(); } catch { content = null; }
  }
  const listen = e.listen || {};
  let actions = '';
  if (e.state === 'public' && listen.audio) {
    actions += `<button class="btn" type="button" data-play="${esc(code)}">▶ 在這裡聽</button>`;
  } else if (e.state === 'subscriber') {
    if (listen.firstory) actions += holdLink(listen.firstory, '到 Firstory 收聽', 'gold');
    actions += holdLink(listen.join, '加入 VIP', 'alt');
  }
  if (listen.apple && e.state === 'public') actions += holdLink(listen.apple, '在 Apple Podcasts 開啟', 'alt');
  actions += e.labs.map((lab) => `<button class="btn alt" type="button" data-lab="${esc(lab.url)}" data-lab-title="${esc(lab.title)}" data-code="${esc(code)}">🧪 ${esc(lab.title)}</button>`).join('');

  const takeaways = content?.takeaways?.length
    ? `<h3>重點句</h3><ol class="takeaways" id="takeaways">${content.takeaways.map((t) =>
      `<li data-t="${t.t ?? ''}">${esc(t.emoji)} ${esc(t.text)}</li>`).join('')}</ol>` : '';
  const card = content?.card
    ? `<div class="card"><h3>${esc(content.card.name)}</h3><p>${esc(content.card.description)}</p><ul>${content.card.knowledge.map((k) => `<li>${esc(k)}</li>`).join('')}</ul></div>` : '';
  const question = content?.question
    ? `<div class="question"><strong>好奇博士問你：</strong>${esc(content.question.text)}</div>` : '';
  const note = e.state === 'subscriber'
    ? '<p class="hint">訂閱者限定集數。按住按鈕 2 秒（請大人幫忙）才會打開 Firstory。實驗一樣可以玩。</p>'
    : e.state === 'unreleased' ? `<p class="hint">即將登場。${esc(content?.caption || '')}</p>` : '';

  $('#channel').innerHTML = `<div class="inner">
    <button class="close" type="button" data-close aria-label="關閉">✕</button>
    <h2 id="ch-title">${esc(e.title)}</h2>
    <p class="hint">${esc(code)} 台 ${stateBadge(e)} ${stampMarks(code)}</p>
    ${note}<div class="actions">${actions}</div>${takeaways}${card}${question}</div>`;
  $('#channel').showModal();
  const params = new URLSearchParams(location.search);
  params.set('ch', code);
  history.replaceState(null, '', `?${params}`);
}

function holdLink(url, label, style) {
  return `<button class="btn ${style} hold" type="button" data-hold="${esc(url)}"><span class="fill"></span><span>${esc(label)}（按住）</span></button>`;
}

// 「請大人幫忙」：按住 2 秒才開外部連結。
function bindHold(root) {
  let timer = null;
  const start = (btn) => {
    btn.classList.add('holding');
    timer = setTimeout(() => { btn.classList.remove('holding'); window.open(btn.dataset.hold, '_blank', 'noopener'); }, 2000);
  };
  const stop = (btn) => { btn?.classList.remove('holding'); clearTimeout(timer); };
  root.addEventListener('pointerdown', (ev) => { const b = ev.target.closest('[data-hold]'); if (b) start(b); });
  root.addEventListener('pointerup', (ev) => stop(ev.target.closest('[data-hold]')));
  root.addEventListener('pointerleave', (ev) => stop(ev.target.closest?.('[data-hold]')), true);
  root.addEventListener('keydown', (ev) => { const b = ev.target.closest('[data-hold]'); if (b && (ev.key === 'Enter' || ev.key === ' ') && !ev.repeat) { ev.preventDefault(); start(b); } });
  root.addEventListener('keyup', (ev) => { const b = ev.target.closest('[data-hold]'); if (b) stop(b); });
}

// ---------- 播放器 ----------
let playing = null;
async function play(code) {
  const e = byCode.get(code);
  const audio = $('#audio');
  playing = { code, takeaways: [] };
  if (e.content) {
    try { playing.takeaways = (await (await fetch(e.content)).json()).takeaways || []; } catch { /* 沒有重點句也能聽 */ }
  }
  audio.src = e.listen.audio;
  $('#now-title').textContent = `${code} 台｜${e.title}`;
  $('#now-takeaway').textContent = '';
  $('#player').hidden = false;
  audio.play().catch(() => {});
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({ title: e.title, artist: '科學好好聽', album: '宇宙好好聽' });
  }
}
function onTime() {
  const audio = $('#audio');
  if (!playing) return;
  const now = audio.currentTime;
  const current = [...playing.takeaways].reverse().find((t) => t.t != null && now >= t.t);
  $('#now-takeaway').textContent = current ? `${current.emoji} ${current.text}` : '';
  document.querySelectorAll('#takeaways li').forEach((li) => li.classList.toggle('on', current && Number(li.dataset.t) === current.t));
  if (audio.duration && now / audio.duration >= 0.8) addStamp('ear', playing.code);
}

// ---------- 實驗 ----------
function openLab(url, title, code) {
  $('#lab-title').textContent = title;
  $('#lab-frame').src = url;
  $('#lab').dataset.code = code;
  $('#lab').showModal();
  clearTimeout(labTimer);
  labTimer = setTimeout(() => addStamp('hand', code), LAB_STAMP_SECONDS * 1000);
}
function closeLab() {
  clearTimeout(labTimer);
  $('#lab-frame').src = 'about:blank';
  $('#lab').close();
}
window.addEventListener('message', (ev) => {
  // lab 頁面加上 kidsci-bridge.js 後，第一次有意義的操作會送 {type: 'kidsci-lab-done'}。
  if (ev.origin === LAB_ORIGIN && ev.data?.type === 'kidsci-lab-done' && $('#lab').open) addStamp('hand', $('#lab').dataset.code);
});

// ---------- 航行日誌 ----------
function openJournal() {
  const line = (code) => { const e = byCode.get(code); return e ? `<li>${esc(code)} 台｜${esc(e.title)}</li>` : ''; };
  $('#journal').innerHTML = `<div class="inner">
    <button class="close" type="button" data-close aria-label="關閉">✕</button>
    <h2 id="journal-title">航行日誌</h2>
    <p>👂 耳朵章 ${stamps.ear.length} 枚 · ✋ 小手章 ${stamps.hand.length} 枚</p>
    <h3>聽過的頻道</h3><ul>${stamps.ear.map(line).join('') || '<li class="hint">還沒有</li>'}</ul>
    <h3>做過的實驗</h3><ul>${stamps.hand.map(line).join('') || '<li class="hint">還沒有</li>'}</ul>
    <button class="btn alt" type="button" id="clear-stamps">清除航行日誌</button></div>`;
  $('#journal').showModal();
}

// ---------- 事件 ----------
function step(delta) {
  const ids = world.levels.map((l) => l.id);
  const i = view.kind === 'level' ? ids.indexOf(view.id) : ids.indexOf('l03');
  const next = ids[Math.min(ids.length - 1, Math.max(0, i + delta))];
  if (levelUnlocked(next)) { view = { kind: 'level', id: next }; render(); }
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
    if (knob && levelUnlocked(knob.dataset.level)) { view = { kind: 'level', id: knob.dataset.level }; render(); return; }
    const extra = t.closest('.extra');
    if (extra) { view = { kind: extra.dataset.kind, id: extra.dataset.kind === 'era' ? world.eras[0].id : extra.dataset.kind === 'lane' ? world.lanes[0].id : 'studio' }; render(); return; }
    const sub = t.closest('[data-sub]');
    if (sub) { view = { ...view, id: sub.dataset.sub }; render(); return; }
    const stop = t.closest('.stop');
    if (stop) { openChannel(stop.dataset.code); return; }
    const playBtn = t.closest('[data-play]');
    if (playBtn) { play(playBtn.dataset.play); return; }
    const lab = t.closest('[data-lab]');
    if (lab) { openLab(lab.dataset.lab, lab.dataset.labTitle, lab.dataset.code); return; }
    if (t.closest('[data-close]')) { t.closest('dialog').close(); return; }
    if (t.id === 'clear-stamps') { stamps = { ear: [], hand: [] }; saveStamps(); renderStops(); $('#journal').close(); }
  });
  $('#channel').addEventListener('close', () => {
    const params = new URLSearchParams(location.search);
    params.delete('ch');
    history.replaceState(null, '', `?${params}`);
  });
  $('#lab-close').addEventListener('click', closeLab);
  $('#lab').addEventListener('cancel', closeLab);
  $('#logbook-btn').addEventListener('click', openJournal);
  $('#search').addEventListener('input', renderStops);
  $('#audio').addEventListener('timeupdate', onTime);
  bindHold(document);
}

async function init() {
  [world, { episodes }] = await Promise.all([
    fetch('data/world.json').then((r) => r.json()),
    fetch('data/catalog.json').then((r) => r.json()),
  ]);
  byCode = new Map(episodes.map((e) => [e.code, e]));
  if (!PREVIEW) $('#preview-note').hidden = true;

  const params = new URLSearchParams(location.search);
  const lv = params.get('lv');
  if (lv) {
    const [kind, id] = lv.includes(':') ? lv.split(':') : ['level', lv];
    if (kind === 'level' ? world.levels.some((l) => l.id === id) && levelUnlocked(id) : ['era', 'lane', 'studio'].includes(kind)) view = { kind, id };
  }
  bind();
  saveStamps();
  render();
  const ch = params.get('ch');
  if (ch && byCode.has(ch)) {
    const e = byCode.get(ch);
    view = { kind: e.home.includes(':') ? e.home.split(':')[0] : (e.home === 'studio' ? 'studio' : 'level'), id: e.home.includes(':') ? e.home.split(':')[1] : e.home };
    render();
    openChannel(ch);
  }
}

init();
