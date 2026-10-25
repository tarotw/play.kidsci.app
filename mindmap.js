// 宇宙好好聽・宇宙地圖（迷宮開圖）：整張心智圖一開始被星雲蓋住，點發光的「？」把地圖一塊一塊打開。
// 中心 → 大主題（原子、生物、太陽系…）→ 小主題（雨林、行星…）→ 一集一集的故事。
// 地圖直接從 data/catalog.json 長出來：新的集數會自動出現在對應的枝條上。
import * as THREE from 'three';
import { patchDialogs } from './compat.js';
import { createGuide } from './guide.js';
import { createChannels, esc } from './channel.js';
import { iconFor, Sound } from './explorer.js';

const STORE_KEY = 'kidsci-universe-v1'; // 航行日誌（跟其他版本共用）
const MAP_KEY = 'kidsci-universe-map-v1'; // 打開過的地方
const $ = (sel) => document.querySelector(sel);
const TAU = Math.PI * 2;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const BRANCH_EMOJI = { l01: '⚛️', l02: '🦠', l03: '🦒', l04: '🏙️', l05: '🌍', l06: '🌙', l07: '🪐', l08: '⭐', l09: '🌌', l10: '💫', era: '⏳', lane: '✨', studio: '🎙️' };
const ZONE_EMOJI = {
  原子與元素: '⚛️', 物質的樣子: '🧊', 材料與寶石: '💎', 煙火與化學: '🎆', 核能: '☢️',
  骨骼與肌肉: '💪', 皮膚與感官: '🖐️', 細胞工廠: '🏭', 大腦: '🧠', 微小生物: '🔬',
  台灣特有種: '🏝️', 珊瑚礁: '🪸', 海洋與深海: '🐋', 雨林: '🌴', 莽原: '🦁', 沙漠: '🏜️', 極地與高山: '🏔️', 天空: '🕊️', 淡水與濕地: '🐸', 植物園: '🌱', 動物大觀園: '🐾',
  飛行器: '✈️', 交通工具: '🚗', 潛艦與艦艇: '🚢', 摩天大樓: '🏙️', 機器人: '🤖', '電腦與 AI': '💻', 國防科技: '🛡️',
  火山與地震: '🌋', 天氣與颱風: '🌀', 水與冰河: '🧊', 海洋與深海探險: '🤿', 岩石礦物: '🪨', 地心與板塊: '🧩',
  人造衛星: '🛰️', 登月: '🚀', 月球: '🌙', 探測器: '📡', 太陽系邊緣: '☄️', 行星: '🪐', 太陽: '☀️',
  星星的一生: '⭐', 光年: '✨', 看不見的光: '🌈', 望遠鏡: '🔭', 銀河系: '🌌', 黑洞: '🕳️', 重力波: '〰️', 外星人: '👽',
  宇宙有多大: '🔭', 大霹靂: '💥', 暗物質與暗能量: '🌑',
  'era:earth': '🌋', 'era:life': '🦕', 'era:human': '🧒', 'era:scientists': '🔬',
  'lane:force': '🏋️', 'lane:gravity': '🍎', 'lane:energy': '🔥', 'lane:light': '🌈', 'lane:sound': '🎵', 'lane:em': '⚡', 'lane:relativity': '⏱️',
};
const R1 = 250, R2 = 450, R3 = 610, ROW = 56, SP = 54; // 每一圈的半徑、故事排的行距與間距
const MIN_GAP = [0, 125, 86, 52]; // 同一層節點之間至少要隔多遠
const REVEAL_R = [320, 185, 125, 58]; // 打開時清掉多大的雲

let nodes, root, worldR, fx, guide, channels, lines, byCode, sound;
let revealed = new Set(), bornAt = new Map(), links = [], shownLinks = new Set();

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
  const n = nodes.get(`ep:${code}`);
  if (n) updateChip(n);
  renderProgress();
  if (kind === 'seen') return;
  toast(`${kind === 'ear' ? '👂 耳朵章' : '✋ 小手章'} +1<br><small>${esc(byCode.get(code)?.title || '')}</small>`);
  if (n) fx.burst(n.x, n.y, [0xf6dc9c, 0xf6a8b8, 0xa8dcd6]);
  sound.chime();
  guide.say(lines.stamps[kind]);
}
let toastTimer = null;
function toast(html) {
  const el = $('#toast');
  el.innerHTML = html;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
}

// ---------- 地圖的樹 ----------
function buildTree(world, episodes) {
  nodes = new Map();
  const add = (n) => { n.children = []; nodes.set(n.id, n); if (n.parent) nodes.get(n.parent).children.push(n.id); return n; };
  root = add({ id: 'root', depth: 0, kind: 'root', name: '宇宙好好聽', emoji: '🎧', parent: null });
  const order = { public: 0, subscriber: 1, unreleased: 2 };
  const leavesOf = (list) => [...list].sort((a, b) => order[a.state] - order[b.state] || a.code.localeCompare(b.code, 'en', { numeric: true }));
  const branchDefs = [
    ...world.levels.map((l) => ({ id: l.id, name: l.name, zones: l.zones.map((z) => ({ id: `${l.id}:${z.name}`, name: z.name, eps: episodes.filter((e) => e.home === l.id && e.zone === z.name) })) })),
    { id: 'era', name: '時光機', zones: world.eras.map((e) => ({ id: `era:${e.id}`, name: e.name, eps: episodes.filter((x) => x.home === `era:${e.id}`) })) },
    { id: 'lane', name: '看不見的法則', zones: world.lanes.map((l) => ({ id: `lane:${l.id}`, name: l.name, eps: episodes.filter((x) => x.home === `lane:${l.id}`) })) },
    { id: 'studio', name: '錄音室', zones: [{ id: 'studio:all', name: '特別節目', eps: episodes.filter((x) => x.home === 'studio') }] },
  ];
  const live = branchDefs.map((b) => ({ ...b, zones: b.zones.filter((z) => z.eps.length) })).filter((b) => b.zones.length);
  live.forEach((b, i) => {
    const hue = (205 + (i / live.length) * 360) % 360;
    add({ id: b.id, depth: 1, kind: 'branch', name: b.name, emoji: BRANCH_EMOJI[b.id] || '✨', parent: 'root', hue });
    b.zones.forEach((z) => {
      add({ id: z.id, depth: 2, kind: 'zone', name: z.name, emoji: ZONE_EMOJI[z.id] || ZONE_EMOJI[z.name] || iconFor({ title: z.name, home: b.id }), parent: b.id, hue });
      leavesOf(z.eps).forEach((e) => add({ id: `ep:${e.code}`, depth: 3, kind: 'leaf', name: e.title, emoji: iconFor(e), parent: z.id, hue, code: e.code, state: e.state }));
    });
  });
  nodes.forEach((n) => { n.color = new THREE.Color().setHSL(n.hue == null ? 0.12 : n.hue / 360, 0.6, 0.72); });
  // 祕密通道：同一集也屬於別的大主題（episodes.also）→ 兩個大主題之間有一條通道
  const branchOf = (home) => (home.startsWith('era:') ? 'era' : home.startsWith('lane:') ? 'lane' : home);
  const seen = new Map();
  episodes.forEach((e) => (e.also || []).forEach((h) => {
    const a = branchOf(e.home), b = branchOf(h);
    if (a === b || !nodes.has(a) || !nodes.has(b)) return;
    const key = [a, b].sort().join('|');
    seen.set(key, (seen.get(key) || 0) + 1);
  }));
  links = [...seen.keys()].map((k) => k.split('|'));
}

const leafCount = (n) => (n.kind === 'leaf' ? 1 : n.children.reduce((s, c) => s + leafCount(nodes.get(c)), 0));
function layout() {
  root.x = 0; root.y = 0; root.a = 0; root.r = 0;
  const bs = root.children.map((id) => nodes.get(id));
  const w = bs.map((b) => Math.pow(Math.max(6, leafCount(b), b.children.length * 4), 0.78));
  const total = w.reduce((a, b) => a + b, 0);
  let a = Math.PI / 2; // 從正上方開始，順時針排
  bs.forEach((b, i) => {
    const span = (w[i] / total) * TAU;
    b.a = a - span / 2; b.r = R1;
    const zs = b.children.map((id) => nodes.get(id));
    const zw = zs.map((z) => Math.max(3, leafCount(z)));
    const zt = zw.reduce((x, y) => x + y, 0);
    let za = a - span * 0.03;
    const inner = span * 0.94;
    zs.forEach((z, k) => {
      const zspan = (zw[k] / zt) * inner;
      z.a = za - zspan / 2; z.r = R2 + (zs.length > 3 && k % 2 ? 70 : 0); // 小主題多的時候前後錯開
      const leaves = z.children.map((id) => nodes.get(id));
      let idx = 0, row = 0;
      while (idx < leaves.length) {
        const r = R3 + (z.r - R2) + row * ROW;
        const cap = Math.max(1, Math.floor((zspan * r) / SP));
        const m = Math.min(cap, leaves.length - idx);
        for (let j = 0; j < m; j++) { const L = leaves[idx + j]; L.r = r; L.a = z.a - (j - (m - 1) / 2) * (SP / r); }
        idx += m; row += 1;
      }
      za -= zspan;
    });
    a -= span;
  });
  nodes.forEach((n) => { if (n !== root) { n.x = Math.cos(n.a) * n.r; n.y = Math.sin(n.a) * n.r; } });
  // 把擠在一起的節點推開一點（同一層之間）
  const byDepth = [1, 2, 3].map((d) => [...nodes.values()].filter((n) => n.depth === d));
  for (let it = 0; it < 40; it++) {
    byDepth.forEach((list, di) => {
      const gap = MIN_GAP[di + 1];
      for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
        const p = list[i], q = list[j];
        const dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy);
        if (d >= gap || d === 0) continue;
        const push = (gap - d) / 2, ux = dx / d, uy = dy / d;
        p.x -= ux * push; p.y -= uy * push; q.x += ux * push; q.y += uy * push;
      }
      // 推開之後不能往內縮到上一圈（不然會蓋住中心或爸爸）
      const inner = [0, R1, R2, R3][di + 1] - 10;
      list.forEach((n) => { const r = Math.hypot(n.x, n.y); if (r < inner) { n.x *= inner / r; n.y *= inner / r; } });
    });
  }
  worldR = Math.max(...[...nodes.values()].map((n) => Math.hypot(n.x, n.y))) + 220;
}

// ---------- 狀態 ----------
const isOpen = (n) => revealed.has(n.id);
const isFrontier = (n) => !isOpen(n) && n.parent && revealed.has(n.parent);
function loadMap() {
  try { (JSON.parse(localStorage.getItem(MAP_KEY)) || []).forEach((id) => { if (nodes.has(id)) revealed.add(id); }); } catch { /* 沒有也沒關係 */ }
  revealed.add('root');
  // 如果某個節點打開了，它的爸爸也一定要打開（避免資料改過之後出現孤島）
  [...revealed].forEach((id) => { let n = nodes.get(id); while (n?.parent) { revealed.add(n.parent); n = nodes.get(n.parent); } });
}
function saveMap() { try { localStorage.setItem(MAP_KEY, JSON.stringify([...revealed])); } catch { /* 停用儲存時仍可玩 */ } }

function graph() {
  const edges = [], halos = [];
  const width = [[0, 0], [18, 10], [9, 5], [4, 2.2]];
  nodes.forEach((n) => {
    const open = isOpen(n), front = isFrontier(n);
    if (!open && !front) return;
    halos.push({ x: n.x, y: n.y, color: n.color, halo: [380, 230, 150, 80][n.depth] * (open ? 1 : 0.75), lit: open });
    if (!n.parent) return;
    const p = nodes.get(n.parent);
    const midR = (Math.hypot(p.x, p.y) + Math.hypot(n.x, n.y)) / 2, ang = Math.atan2(n.y, n.x);
    const cx = n.depth === 1 ? (p.x + n.x) / 2 : Math.cos(ang) * midR, cy = n.depth === 1 ? (p.y + n.y) / 2 : Math.sin(ang) * midR;
    edges.push({ ax: p.x, ay: p.y, bx: n.x, by: n.y, cx, cy, w0: width[n.depth][0], w1: width[n.depth][1], color: n.color, lit: open, born: bornAt.get(n.id) ?? -99 });
  });
  links.forEach(([a, b]) => {
    const A = nodes.get(a), B = nodes.get(b);
    if (!isOpen(A) || !isOpen(B)) return;
    const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2;
    edges.push({ ax: A.x, ay: A.y, bx: B.x, by: B.y, cx: mx * 1.9, cy: my * 1.9, w0: 3, w1: 3, color: new THREE.Color(0xf6dc9c), lit: true, born: bornAt.get(`${a}|${b}`) ?? -99 });
  });
  fx.setGraph({ nodes: halos, edges });
}

// ---------- 節點（網頁按鈕：字清楚、可以用鍵盤） ----------
const chips = new Map();
function makeChips() {
  const box = $('#nodes');
  nodes.forEach((n) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `mm-node d${n.depth} ${n.kind}`;
    b.dataset.id = n.id;
    b.style.setProperty('--h', n.hue ?? 40);
    b.hidden = true;
    box.appendChild(b);
    chips.set(n.id, b);
    updateChip(n);
  });
}
function updateChip(n) {
  const b = chips.get(n.id);
  if (!b) return;
  const open = isOpen(n), front = isFrontier(n);
  b.hidden = !open && !front;
  b.classList.toggle('fog', front);
  b.classList.toggle('vip', n.state === 'subscriber');
  b.classList.toggle('soon', n.state === 'unreleased');
  const seen = n.code && stamps.seen.includes(n.code);
  const ear = n.code && stamps.ear.includes(n.code);
  b.classList.toggle('seen', !!seen);
  const progress = n.kind === 'branch' || n.kind === 'zone' ? branchProgress(n) : null;
  const orb = n.kind === 'root' ? '<img src="assets/logo-square.jpg" alt="">' : `<span class="em">${n.emoji}</span>`;
  const name = front ? '？' : n.kind === 'leaf' ? n.name.replace(/[（(].*$/, '').slice(0, 14) : n.name;
  b.innerHTML = `<span class="orb"${progress != null ? ` style="--p:${progress}"` : ''}>${orb}${front ? '<span class="q">?</span>' : ''}${ear ? '<span class="mk">👂</span>' : seen ? '<span class="mk ok">✓</span>' : ''}</span><span class="nm">${esc(name)}</span>`;
  b.setAttribute('aria-label', front ? `還沒打開的地方（${n.kind === 'leaf' ? '一個故事' : n.name}）` : n.kind === 'leaf' ? `${n.name}（${n.state === 'subscriber' ? 'VIP' : n.state === 'unreleased' ? '即將登場' : '公開'}）` : n.name);
}
function branchProgress(n) {
  const all = [];
  const walk = (x) => { if (x.kind === 'leaf') { if (x.state !== 'unreleased') all.push(x); } else x.children.forEach((c) => walk(nodes.get(c))); };
  walk(n);
  if (!all.length) return 0;
  return Math.round((all.filter((x) => stamps.seen.includes(x.code)).length / all.length) * 100);
}

// ---------- 鏡頭（拖曳移動、兩指／滾輪縮放、自動飛到要看的地方） ----------
// rot：地圖轉的角度。長長一串的故事在手機直拿時會轉成直的，才不會擠成一小條。
const cam = { x: 0, y: 0, dist: 900, rot: 0 };
let camAnim = null, vel = { x: 0, y: 0 }, dirty = true;
const canvas = () => $('#world');
function limits() {
  const minD = fx.distForHeight(canvas().clientHeight * 0.32); // 最近：一個單位約 3 像素
  const maxD = fx.distForHeight(worldR * 2.4) * Math.max(1, canvas().clientHeight / canvas().clientWidth);
  return { minD, maxD };
}
function clampCam() {
  const { minD, maxD } = limits();
  cam.dist = Math.max(minD, Math.min(maxD, cam.dist));
  const r = Math.hypot(cam.x, cam.y), lim = worldR * 0.9;
  if (r > lim) { cam.x *= lim / r; cam.y *= lim / r; }
}
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
// 畫面上下左右被按鈕和對話框擋住的地方（像素）：量真的標題列、播放器，不同大小的螢幕都對得準
function safeArea() {
  const c = canvas(), W = c.clientWidth, H = c.clientHeight, phone = W < 700;
  const head = document.querySelector('.hud-top .scene')?.getBoundingClientRect().bottom || 100;
  const player = document.body.classList.contains('has-player') ? ($('#player').offsetHeight || 110) : 0;
  const guide = phone ? 130 : H < 560 ? 64 : 130; // 手機的對話框橫跨整個下方；電腦、橫拿只在左下角
  const chip = parseFloat(getComputedStyle(chips.get('root') || document.body).getPropertyValue('--s')) * 0.65 || 66; // 大主題球的大小
  const side = phone ? 6 : $('#minimap').offsetWidth + 28; // 電腦和橫拿：右邊一整條是小地圖和縮放鍵
  return { W, H, phone, chip, left: phone ? 6 : 40, right: side, top: Math.min(H * 0.35, head + 6), bottom: Math.min(H * 0.35, guide + player + 8) };
}
// 要把 list 都放進畫面，地圖轉 rot 的時候需要多少「單位／像素」
function fitScale(list, rot, A = safeArea()) {
  const cs = Math.cos(rot), sn = Math.sin(rot);
  const us = list.map((n) => n.x * cs + n.y * sn), vs = list.map((n) => -n.x * sn + n.y * cs);
  const spanU = Math.max(...us) - Math.min(...us), spanV = Math.max(...vs) - Math.min(...vs);
  const availW = Math.max(120, A.W - A.left - A.right - A.chip * (A.phone ? 1 : 2)), availH = Math.max(100, A.H - A.top - A.bottom - A.chip * 1.2);
  return { upp: Math.max(spanU / availW, spanV / availH), midU: (Math.max(...us) + Math.min(...us)) / 2, midV: (Math.max(...vs) + Math.min(...vs)) / 2 };
}
// 這群節點排成長長一條時，轉一下讓它順著螢幕比較長的那一邊（沒有明顯比較好就不轉，免得頭暈）
function bestRot(list, A = safeArea()) {
  if (list.length < 3) return cam.rot;
  const mx = list.reduce((s, n) => s + n.x, 0) / list.length, my = list.reduce((s, n) => s + n.y, 0) / list.length;
  let sxx = 0, syy = 0, sxy = 0;
  list.forEach((n) => { const dx = n.x - mx, dy = n.y - my; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; });
  const axis = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  const along = (A.W - A.left - A.right) >= (A.H - A.top - A.bottom) ? 0 : Math.PI / 2; // 螢幕比較長的方向
  const out = Math.atan2(my, mx); // 從中心往外的方向：盡量朝前（直拿朝上、橫拿朝右）
  const cands = [wrapAngle(axis - along), wrapAngle(axis - along + Math.PI)];
  const score = (r) => Math.abs(wrapAngle(r - cam.rot)) - 0.6 * Math.cos(out - r - along);
  const pick = score(cands[0]) <= score(cands[1]) ? cands[0] : cands[1];
  return fitScale(list, pick, A).upp < fitScale(list, cam.rot, A).upp * 0.85 ? pick : cam.rot;
}
// 飛到可以看到 list 的地方；rot 不給就維持現在的角度，'auto' 就自動挑
function fitTo(list, { scale = 1, dur = 0.9, rot = cam.rot, minUpp = 0.42 } = {}) {
  const A = safeArea();
  if (rot === 'auto') rot = bestRot(list, A);
  const f = fitScale(list, rot, A);
  const upp = Math.max(f.upp * scale, minUpp);
  // 可以看到的區域不在正中間（上面有標題、下面有對話框），所以鏡頭要偏一點
  const du = ((A.right - A.left) / 2) * upp, dv = ((A.top - A.bottom) / 2) * upp;
  const u = f.midU + du, v = f.midV + dv, cs = Math.cos(rot), sn = Math.sin(rot);
  const to = { x: u * cs - v * sn, y: u * sn + v * cs, dist: fx.distForHeight(upp * A.H), rot };
  if (reduceMotion || dur <= 0) { Object.assign(cam, to); clampCam(); dirty = true; return; }
  camAnim = { from: { ...cam }, to, t: 0, dur };
  vel = { x: 0, y: 0 };
}
function flyTo(to, dur) { camAnim = { from: { ...cam }, to: { ...cam, ...to }, t: 0, dur }; }
const overview = () => [root, ...root.children.map((id) => nodes.get(id))];
function focus(n) {
  const kids = n.children.map((id) => nodes.get(id)).filter((k) => isOpen(k) || isFrontier(k));
  if (kids.length) fitTo([n, ...kids], { rot: 'auto' });
  else fitTo([n, nodes.get(n.parent)], { scale: 1.4 });
}

// ---------- 打開地圖 ----------
const tintOf = (n) => (n.kind === 'root' ? 'rgb(120,104,70)' : `hsl(${n.hue}, 55%, ${n.depth === 1 ? 30 : 24}%)`);
function reveal(n, { silent = false } = {}) {
  if (isOpen(n)) return;
  revealed.add(n.id);
  bornAt.set(n.id, fx.time);
  saveMap();
  fx.reveal(n.x, n.y, REVEAL_R[n.depth], silent ? 0 : 1.0, tintOf(n));
  if (!silent) {
    fx.burst(n.x, n.y, [n.color.getHex(), 0xfff4e2, 0xf6dc9c]);
    sound.pick();
  }
  updateChip(n);
  n.children.forEach((id) => { const k = nodes.get(id); updateChip(k); chips.get(id).classList.add('appear'); });
  // 兩邊都打開了：祕密通道亮起來
  if (n.kind === 'branch') links.forEach(([a, b]) => {
    const key = `${a}|${b}`;
    if ((a === n.id || b === n.id) && isOpen(nodes.get(a)) && isOpen(nodes.get(b)) && !shownLinks.has(key)) {
      shownLinks.add(key); bornAt.set(key, fx.time);
      if (!silent) setTimeout(() => toast(`🔑 發現祕密通道！<br><small>${esc(nodes.get(a).name)} ↔ ${esc(nodes.get(b).name)}</small>`), 900);
    }
  });
  graph();
  renderProgress();
  drawMinimap();
  if (silent) return;
  if (n.kind === 'leaf') setTimeout(() => channels.openChannel(n.code), 450);
  else setTimeout(() => focus(n), 250);
  // 發現新的大主題：說一下裡面有多少東西（同一個 topic，會換掉還沒看完的開場白）
  if (n.kind === 'branch') setTimeout(() => guide.say([{ who: 'captain', text: `${n.emoji} 發現新大陸「${n.name}」！這裡藏了 ${n.children.length} 個小地方、${leafCount(n)} 個故事。` }], { topic: 'map' }), 900);
}
// 從別的地方（航行日誌、分享連結）打開的故事：把通往它的路打開，鏡頭移過去
function openPathTo(code, { dur = 0.9 } = {}) {
  const leaf = nodes?.get(`ep:${code}`);
  if (!leaf || !fx) return null;
  if (!isOpen(leaf)) {
    const path = []; let n = leaf; while (n) { path.unshift(n); n = n.parent ? nodes.get(n.parent) : null; }
    path.forEach((x) => reveal(x, { silent: true }));
    const zone = nodes.get(leaf.parent);
    fitTo([zone, ...zone.children.map((id) => nodes.get(id))], { rot: 'auto', dur });
  }
  return leaf;
}
function activate(n) {
  if (isFrontier(n)) { reveal(n); return; }
  if (!isOpen(n)) return;
  sound.blip();
  if (n.kind === 'leaf') channels.openChannel(n.code);
  else focus(n);
}

// ---------- 進度與小地圖 ----------
function renderProgress() {
  const total = nodes.size, open = revealed.size;
  const pct = Math.round((open / total) * 100);
  $('#map-progress').textContent = `打開了 ${pct}% 的地圖 · 聽過 ${stamps.seen.filter((c) => nodes.has(`ep:${c}`)).length} 個故事`;
  $('#map-bar').style.width = `${pct}%`;
}
let miniDirty = true;
function drawMinimap() { miniDirty = true; }
function paintMinimap() {
  if (!miniDirty) return;
  miniDirty = false;
  const c = $('#minimap'), g = c.getContext('2d'), S = c.width, k = (S / 2 - 6) / worldR;
  g.clearRect(0, 0, S, S);
  g.save();
  g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 2, 0, TAU); g.clip();
  g.fillStyle = '#1c2044'; g.fillRect(0, 0, S, S);
  g.globalAlpha = 0.55;
  g.drawImage(fx.maskCanvas, S / 2 - worldR * k * 1, S / 2 - worldR * k * 1, worldR * 2 * k, worldR * 2 * k);
  g.globalAlpha = 1;
  nodes.forEach((n) => {
    const open = isOpen(n), front = isFrontier(n);
    if (!open && !front) return;
    g.fillStyle = open ? `hsl(${n.hue ?? 40},70%,72%)` : 'rgba(220,220,255,0.45)';
    const r = [4, 3, 2, 1.2][n.depth];
    g.beginPath(); g.arc(S / 2 + n.x * k, S / 2 - n.y * k, r, 0, TAU); g.fill();
  });
  // 現在看到的範圍
  const cv = canvas(), W = cv.clientWidth, H = cv.clientHeight;
  g.strokeStyle = '#efcf8e'; g.lineWidth = 1.5;
  g.beginPath();
  [[0, 0], [W, 0], [W, H], [0, H]].forEach(([sx, sy], i) => { const p = screenToWorld(sx, sy); g[i ? 'lineTo' : 'moveTo'](S / 2 + p.x * k, S / 2 - p.y * k); });
  g.closePath(); g.stroke();
  g.restore();
}

// ---------- 每一格：鏡頭、節點位置 ----------
let lastCam = '';
function onFrame(dt) {
  if (camAnim) {
    camAnim.t = Math.min(1, camAnim.t + dt / camAnim.dur);
    const e = camAnim.t < 0.5 ? 4 * camAnim.t ** 3 : 1 - (-2 * camAnim.t + 2) ** 3 / 2;
    // 距離用對數內插，縮放起來比較順
    cam.x = camAnim.from.x + (camAnim.to.x - camAnim.from.x) * e;
    cam.y = camAnim.from.y + (camAnim.to.y - camAnim.from.y) * e;
    cam.dist = Math.exp(Math.log(camAnim.from.dist) + (Math.log(camAnim.to.dist) - Math.log(camAnim.from.dist)) * e);
    cam.rot = camAnim.from.rot + wrapAngle(camAnim.to.rot - camAnim.from.rot) * e;
    if (camAnim.t >= 1) camAnim = null;
    clampCam();
  } else if (Math.abs(vel.x) + Math.abs(vel.y) > 0.01 && !pointers.size) {
    cam.x += vel.x * dt; cam.y += vel.y * dt;
    vel.x *= Math.pow(0.04, dt); vel.y *= Math.pow(0.04, dt);
    clampCam();
  }
  Object.assign(fx.view, cam);
  const key = `${cam.x.toFixed(2)},${cam.y.toFixed(2)},${cam.dist.toFixed(2)},${cam.rot.toFixed(4)}`;
  if (key !== lastCam || dirty) { lastCam = key; dirty = false; placeChips(); drawMinimap(); }
  paintMinimap();
}
// 鏡頭從正上方看平面：世界座標到螢幕是平移、旋轉加縮放
function worldToScreen(x, y) {
  const c = canvas(), upp = fx.unitsPerPx(), cs = Math.cos(cam.rot), sn = Math.sin(cam.rot);
  const dx = x - cam.x, dy = y - cam.y;
  return { x: c.clientWidth / 2 + (dx * cs + dy * sn) / upp, y: c.clientHeight / 2 - (-dx * sn + dy * cs) / upp };
}
// 螢幕上移動 (sx, sy) 像素，等於世界裡移動多少
function screenDelta(sx, sy) {
  const upp = fx.unitsPerPx(), cs = Math.cos(cam.rot), sn = Math.sin(cam.rot);
  return { x: (sx * cs + sy * sn) * upp, y: (sx * sn - sy * cs) * upp };
}
function placeChips() {
  const c = canvas(), W = c.clientWidth, H = c.clientHeight;
  const p = 1 / fx.unitsPerPx();
  const box = $('#nodes');
  const lod = p < 0.3 ? 'galaxy' : p < 0.55 ? 'far' : p < 0.95 ? 'mid' : p < 1.55 ? 'near' : 'close';
  box.dataset.lod = lod;
  chips.forEach((b, id) => {
    if (b.hidden) return;
    const n = nodes.get(id);
    if (lod === 'galaxy' && n.depth === 3) { b.style.visibility = 'hidden'; return; } // 太遠了，一集一集的故事先收起來
    const s = worldToScreen(n.x, n.y);
    const off = s.x < -80 || s.x > W + 80 || s.y < -80 || s.y > H + 80;
    b.style.visibility = off ? 'hidden' : '';
    if (!off) b.style.transform = `translate3d(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px, 0)`;
  });
}

// ---------- 手勢 ----------
const pointers = new Map();
let drag = null, pinchD = 0, moved = 0;
function screenToWorld(sx, sy) {
  const c = canvas(), d = screenDelta(sx - c.clientWidth / 2, sy - c.clientHeight / 2);
  return { x: cam.x + d.x, y: cam.y + d.y };
}
function zoomAt(sx, sy, factor) {
  const before = screenToWorld(sx, sy);
  cam.dist *= factor;
  clampCam();
  const after = screenToWorld(sx, sy);
  cam.x += before.x - after.x; cam.y += before.y - after.y;
  clampCam();
  camAnim = null;
}
function bindGestures() {
  const stage = $('#stage');
  stage.addEventListener('pointerdown', (ev) => {
    if (ev.pointerType === 'mouse' && ev.button !== 0) return;
    sound.wake();
    // 抓住這根手指：拖到標題或按鈕上才放開，也一樣收得到放開的事件（不然下一次會被當成兩指縮放）
    try { stage.setPointerCapture(ev.pointerId); } catch { /* 舊瀏覽器沒有也沒關係 */ }
    pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (pointers.size === 1) { drag = { x: ev.clientX, y: ev.clientY, t: performance.now(), target: ev.target.closest('.mm-node') }; moved = 0; vel = { x: 0, y: 0 }; camAnim = null; }
    if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinchD = Math.hypot(a.x - b.x, a.y - b.y); drag = null; }
  });
  stage.addEventListener('pointermove', (ev) => {
    if (!pointers.has(ev.pointerId)) return;
    const prev = pointers.get(ev.pointerId);
    pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchD) zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, pinchD / d);
      pinchD = d;
      return;
    }
    if (!drag) return;
    const dx = ev.clientX - prev.x, dy = ev.clientY - prev.y;
    moved += Math.hypot(dx, dy);
    if (moved < 8) return;
    const d = screenDelta(-dx, -dy);
    cam.x += d.x; cam.y += d.y;
    const dtv = Math.max(0.008, (performance.now() - drag.t) / 1000);
    vel = { x: d.x / dtv, y: d.y / dtv };
    drag.t = performance.now();
    clampCam();
  });
  const end = (ev) => {
    if (!pointers.has(ev.pointerId)) return;
    const wasTap = drag && moved < 8 && pointers.size === 1;
    pointers.delete(ev.pointerId);
    if (pointers.size < 2) pinchD = 0;
    if (wasTap) {
      vel = { x: 0, y: 0 };
      const chip = ev.target.closest?.('.mm-node') || drag.target;
      if (chip) activate(nodes.get(chip.dataset.id));
    }
    if (!pointers.size) drag = null;
  };
  stage.addEventListener('pointerup', end);
  const cancel = (ev) => { pointers.delete(ev.pointerId); drag = null; pinchD = 0; };
  stage.addEventListener('pointercancel', cancel);
  stage.addEventListener('lostpointercapture', (ev) => { if (pointers.has(ev.pointerId)) cancel(ev); });
  window.addEventListener('blur', () => { pointers.clear(); drag = null; pinchD = 0; });
  // 視窗大小改變（手機轉橫、轉直）：節點要重新對位
  if (typeof ResizeObserver === 'function') new ResizeObserver(() => { dirty = true; drawMinimap(); }).observe(canvas());
  else window.addEventListener('resize', () => { dirty = true; drawMinimap(); });
  stage.addEventListener('wheel', (ev) => { ev.preventDefault(); zoomAt(ev.clientX, ev.clientY, Math.exp(ev.deltaY * (ev.ctrlKey ? 0.01 : 0.0015))); }, { passive: false });
  // 鍵盤：按 Tab 到節點、按 Enter 打開（滑鼠和手指已經在上面處理過了）
  $('#nodes').addEventListener('click', (ev) => { if (ev.detail !== 0) return; const chip = ev.target.closest('.mm-node'); if (chip) activate(nodes.get(chip.dataset.id)); });
  $('#nodes').addEventListener('focusin', (ev) => { const chip = ev.target.closest('.mm-node'); if (chip && chip.matches(':focus-visible')) { const n = nodes.get(chip.dataset.id); const s = worldToScreen(n.x, n.y); const c = canvas(); if (s.x < 60 || s.y < 60 || s.x > c.clientWidth - 60 || s.y > c.clientHeight - 60) fitTo([n], { dur: 0.5, minUpp: fx.unitsPerPx() }); } });
  $('#minimap').addEventListener('click', (ev) => {
    const c = ev.currentTarget, rect = c.getBoundingClientRect(), k = (c.width / 2 - 6) / worldR;
    const x = ((ev.clientX - rect.left) * (c.width / rect.width) - c.width / 2) / k, y = -((ev.clientY - rect.top) * (c.height / rect.height) - c.height / 2) / k;
    flyTo({ x, y }, 0.6);
  });
}

// ---------- 隊長選單 ----------
function nearestFrontier() {
  let best = null, bestD = Infinity;
  nodes.forEach((n) => { if (isFrontier(n)) { const d = Math.hypot(n.x - cam.x, n.y - cam.y) + n.depth * 60; if (d < bestD) { best = n; bestD = d; } } });
  return best;
}
function pulse(n) {
  const b = chips.get(n.id);
  b.classList.remove('hint'); void b.offsetWidth; b.classList.add('hint');
}
function openGuideMenu() {
  if (!guide.on) guide.on = true;
  guide.say([{ who: 'captain', text: '需要幫忙嗎？想怎麼探索？', actions: [
    { label: '👀 帶我去還沒打開的地方', run: () => { const n = nearestFrontier(); if (!n) { toast('🎉 整張地圖都打開了！'); return; } fitTo([n, nodes.get(n.parent)], { scale: 1.4 }); setTimeout(() => pulse(n), 700); } },
    { label: '🗺️ 看整張地圖', run: () => fitTo([...nodes.values()].filter((n) => isOpen(n) || isFrontier(n)), { rot: 0 }) },
    { label: '🔁 重新蓋上雲朵', run: () => { if (!confirm('要把地圖重新蓋上雲朵嗎？聽過的星章不會不見。')) return; revealed = new Set(['root']); saveMap(); fx.resetFog(); fx.reveal(0, 0, REVEAL_R[0], 0, tintOf(root)); nodes.forEach(updateChip); graph(); renderProgress(); drawMinimap(); fitTo(overview(), { rot: 0 }); } },
    { label: '🤫 先不要說話', run: () => { guide.on = false; } },
  ] }], { urgent: true });
}

// 閒置太久：提醒雲裡還有地方在發光
let idleTimer = null, idleNags = 0;
function resetIdle() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (document.querySelector('dialog[open]') || guide.busy() || !$('#audio').paused) { resetIdle(); return; }
    const n = nearestFrontier();
    if (!n) return;
    idleNags += 1;
    guide.say([{ who: 'captain', text: '雲裡還有地方在發光耶！我們去打開看看？', actions: [{ label: '🔦 帶我去', run: () => { fitTo([n, nodes.get(n.parent)], { scale: 1.4 }); setTimeout(() => pulse(n), 700); } }, { label: '等一下', run: () => {} }] }], { urgent: true });
    resetIdle();
  }, 30000 * 2 ** Math.min(idleNags, 3));
}

function bindHud() {
  $('#guide-btn').addEventListener('click', openGuideMenu);
  $('#logbook-btn').addEventListener('click', () => channels.openJournal());
  $('#sound-btn').addEventListener('click', () => {
    sound.wake(); sound.on = !sound.on;
    $('#sound-btn').textContent = sound.on ? '🔊' : '🔇';
    $('#sound-btn').setAttribute('aria-pressed', String(sound.on));
  });
  document.querySelectorAll('[data-zoom]').forEach((b) => b.addEventListener('click', () => {
    const d = Number(b.dataset.zoom);
    if (d) flyTo({ dist: cam.dist * (d > 0 ? 0.6 : 1.6) }, 0.35);
    else fitTo(overview(), { rot: 0 });
  }));
  ['pointerdown', 'keydown', 'wheel'].forEach((t) => window.addEventListener(t, resetIdle, { passive: true }));
  document.addEventListener('keydown', (ev) => {
    if (document.querySelector('dialog[open]') || ev.target.closest('input')) return;
    const pan = { ArrowLeft: [-90, 0], ArrowRight: [90, 0], ArrowUp: [0, -90], ArrowDown: [0, 90] }[ev.key];
    if (pan) { ev.preventDefault(); const d = screenDelta(pan[0], pan[1]); flyTo({ x: cam.x + d.x, y: cam.y + d.y }, 0.25); }
    if (ev.key === '+' || ev.key === '=') flyTo({ dist: cam.dist * 0.7 }, 0.3);
    if (ev.key === '-') flyTo({ dist: cam.dist * 1.4 }, 0.3);
  });
}

function webglOk() {
  try { const c = document.createElement('canvas'); return !!c.getContext('webgl2'); } catch { return false; }
}

async function init() {
  const [world, catalog, dialogue] = await Promise.all([
    fetch('data/world.json').then((r) => r.json()),
    fetch('data/catalog.json').then((r) => r.json()),
    fetch('data/dialogue.json').then((r) => r.json()),
  ]);
  patchDialogs();
  lines = dialogue;
  byCode = new Map(catalog.episodes.map((e) => [e.code, e]));
  guide = createGuide({ root: $('#guide'), cast: lines.cast });
  channels = createChannels({
    byCode, lines, getStamps: () => stamps, addStamp,
    onOpen: (code) => { idleNags = 0; openPathTo(code); },
    onClear: () => { stamps = { ear: [], hand: [], seen: [], missions: [], guess: 0 }; saveStamps(); nodes.forEach(updateChip); renderProgress(); },
  });
  sound = new Sound();
  if (!webglOk()) {
    $('#loading-text').innerHTML = '這台裝置沒辦法顯示宇宙地圖。<br><a class="btn" href="knob.html?gl=0">改用平面的萬物地圖</a>';
    return;
  }
  buildTree(world, catalog.episodes);
  layout();
  const { createMapFx } = await import('./mapfx.js');
  fx = createMapFx({ canvas: canvas(), worldR, onFrame });
  const firstVisit = (() => { try { return !localStorage.getItem(MAP_KEY); } catch { return true; } })();
  loadMap();
  revealed.forEach((id) => { const n = nodes.get(id); fx.reveal(n.x, n.y, REVEAL_R[n.depth], 0, tintOf(n)); });
  links.forEach(([a, b]) => { if (revealed.has(a) && revealed.has(b)) shownLinks.add(`${a}|${b}`); });
  makeChips();
  graph();
  bindGestures();
  bindHud();
  saveStamps();
  renderProgress();
  // 分享連結 ?ch=代碼：把通往那一集的路打開，再打開那一集；舊版的 ?lv=大主題 也接得起來
  const params = new URLSearchParams(location.search);
  const ch = params.get('ch'), lv = nodes.get(params.get('lv') || '');
  if (ch && nodes.has(`ep:${ch}`)) {
    fitTo(overview(), { dur: 0, rot: 0 });
    openPathTo(ch, { dur: 0 });
    channels.openChannel(ch);
  } else if (lv && lv.depth === 1) {
    reveal(lv, { silent: true });
    fitTo([lv, ...lv.children.map((id) => nodes.get(id))], { rot: 'auto', dur: 0 });
  } else {
    const shown = [...nodes.values()].filter((x) => isOpen(x) || isFrontier(x));
    fitTo(firstVisit ? overview() : shown, { dur: 0, rot: 0 });
  }
  document.body.classList.add('ready');
  if (/[?&]debug\b/.test(location.search) || navigator.webdriver) window.__mapDebug = { nodes, cam, fx, revealed: () => revealed, worldToScreen, links: () => links, busy: () => !!camAnim || pointers.size > 0 };
  if (firstVisit) setTimeout(() => guide.say([
    { who: 'captain', text: '這張宇宙地圖被雲遮住了！' },
    { who: 'captain', text: '點一個會發光的「？」，雲就會散開。一層一層打開，就能找到好多故事！' },
  ], { topic: 'map' }), 600);
  resetIdle();
}

init().catch((err) => {
  console.error(err);
  $('#loading-text').innerHTML = '載入失敗了，可能是網路不穩。<br><button class="btn" type="button" onclick="location.reload()">重新整理</button>';
});
