// 宇宙好好聽：探索畫面。每一格是一個可以拖曳、縮放的場景，每一集是一個發光的「頻道」，
// 耳機號會飛過去。全部用 Canvas 2D 畫，不載入外部圖檔或函式庫。
const TAU = Math.PI * 2;
const GOLDEN = 2.399963;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- 小工具 ----------
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
}
function rng(seed) {
  let s = Math.floor(seed * 2147483647) || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => 1 - Math.pow(1 - t, 3);

// ---------- 每一集的圖示 ----------
const ICONS = [
  ['鯊', '🦈'], ['鯨', '🐋'], ['海豚', '🐬'], ['虎鯨', '🐋'], ['章魚', '🐙'], ['魷', '🦑'], ['烏賊', '🦑'], ['水母', '🪼'],
  ['螳螂蝦', '🦐'], ['蝦', '🦐'], ['蟹', '🦀'], ['海星', '⭐'], ['珊瑚', '🪸'], ['小丑魚', '🐠'], ['翻車魚', '🐡'], ['魟', '🐟'],
  ['海牛', '🦭'], ['海豹', '🦭'], ['食人魚', '🐟'], ['魚', '🐟'], ['龜', '🐢'], ['鱷', '🐊'], ['蛇', '🐍'], ['蟒', '🐍'],
  ['蛙', '🐸'], ['蟾', '🐸'], ['螈', '🦎'], ['蜥', '🦎'], ['變色龍', '🦎'], ['企鵝', '🐧'], ['鸚', '🦜'], ['犀鳥', '🦜'],
  ['巨嘴鳥', '🦜'], ['蜂鳥', '🐦'], ['鴕鳥', '🐦'], ['渡渡', '🦤'], ['海鸚', '🐦'], ['鳥', '🐦'], ['蝙蝠', '🦇'], ['獅', '🦁'],
  ['豹', '🐆'], ['獵豹', '🐆'], ['象', '🐘'], ['長頸鹿', '🦒'], ['霍加', '🦒'], ['斑馬', '🦓'], ['犀牛', '🦏'], ['河馬', '🦛'],
  ['袋鼠', '🦘'], ['大貓熊', '🐼'], ['無尾熊', '🐨'], ['樹懶', '🦥'], ['水豚', '🐹'], ['狐', '🦊'], ['狼', '🐺'], ['馬', '🐴'],
  ['牛', '🐄'], ['鬣狗', '🐕'], ['蜜獾', '🦡'], ['臭鼬', '🦨'], ['猴', '🐒'], ['穿山甲', '🦔'], ['鴨嘴獸', '🦆'], ['河狸', '🦫'],
  ['袋熊', '🐻'], ['蜘蛛', '🕷️'], ['蟻', '🐜'], ['白蟻', '🐜'], ['蜂', '🐝'], ['蝶', '🦋'], ['糞', '🪲'], ['甲蟲', '🪲'],
  ['蝗', '🦗'], ['昆蟲', '🐞'], ['水熊蟲', '🐻'], ['仙人掌', '🌵'], ['麵包樹', '🌳'], ['葉', '🌿'], ['植物', '🌱'], ['種子', '🌱'],
  ['暴龍', '🦖'], ['恐龍', '🦕'], ['蒼龍', '🦕'], ['化石', '🦴'], ['骨', '🦴'], ['肌肉', '💪'], ['皮膚', '🖐️'], ['腦', '🧠'],
  ['細胞', '🧫'], ['腎', '🫘'], ['直升機', '🚁'], ['無人機', '🛸'], ['飛彈', '🎯'], ['飛機', '✈️'], ['戰機', '✈️'], ['轟炸機', '✈️'],
  ['黑鳥', '✈️'], ['潛艦', '🛳️'], ['航母', '🚢'], ['驅逐艦', '🚢'], ['車', '🏎️'], ['機器人', '🤖'], ['AI', '🧠'], ['晶片', '💾'],
  ['電腦', '💻'], ['網路', '🌐'], ['量子', '⚛️'], ['101', '🏙️'], ['大樓', '🏙️'], ['攀登', '🧗'], ['火山', '🌋'], ['地震', '📳'],
  ['颶風', '🌀'], ['颱風', '🌀'], ['龍捲風', '🌪️'], ['雲', '☁️'], ['天氣', '⛅'], ['聖嬰', '🌊'], ['冰河', '🧊'], ['水', '💧'],
  ['岩石', '🪨'], ['寶石', '💎'], ['鑽石', '💎'], ['礦物', '💎'], ['鐘乳石', '🕳️'], ['峽谷', '🏜️'], ['海洋', '🌊'], ['深淵', '🌊'],
  ['板塊', '🧩'], ['地心', '🌍'], ['地球', '🌍'], ['GPS', '📍'], ['衛星', '🛰️'], ['登月', '🚀'], ['火箭', '🚀'], ['月', '🌙'],
  ['太陽', '☀️'], ['帕克', '☀️'], ['極光', '🌌'], ['彗星', '☄️'], ['流星', '☄️'], ['小行星', '☄️'], ['冥王星', '🪐'], ['火星', '🔴'],
  ['行星', '🪐'], ['水星', '🪐'], ['木星', '🪐'], ['天王星', '🪐'], ['航海家', '🛰️'], ['新視野', '🛰️'], ['望遠鏡', '🔭'], ['大眼睛', '🔭'],
  ['光年', '✨'], ['牛郎', '✨'], ['星', '⭐'], ['黑洞', '🕳️'], ['外星', '👽'], ['引力波', '〰️'], ['銀河', '🌌'], ['大霹靂', '💥'],
  ['火球', '💥'], ['暗物質', '🌑'], ['宇宙', '🌌'], ['原子', '⚛️'], ['元素', '🧪'], ['煙火', '🎆'], ['核', '☢️'], ['材料', '🧱'],
  ['物質', '🧊'], ['電', '⚡'], ['磁', '🧲'], ['聲音', '🎵'], ['光', '🌈'], ['熱', '🔥'], ['能量', '🔥'], ['重力', '🍎'],
  ['潮汐', '🌊'], ['力', '🏋️'], ['機械', '⚙️'], ['浮力', '🛟'], ['飛天', '✈️'], ['時空', '⏱️'], ['時間', '⏱️'], ['光速', '⚡'],
  ['牛頓', '🍎'], ['阿基米德', '🛁'], ['愛因斯坦', '⏱️'], ['青銅', '🛡️'], ['鐵', '⚒️'], ['石器', '🪨'], ['人類', '🧒'], ['母親', '💐'],
];
const HOME_ICON = {
  l01: '⚛️', l02: '🧫', l03: '🐾', l04: '⚙️', l05: '🌍', l06: '🌙', l07: '☀️', l08: '⭐', l09: '🌌', l10: '💥',
  'era:bigbang': '💥', 'era:earth': '🌋', 'era:life': '🦕', 'era:human': '🧒', 'era:scientists': '🔬', 'era:now': '🧒',
  'lane:force': '🏋️', 'lane:gravity': '🍎', 'lane:energy': '🔥', 'lane:light': '🌈', 'lane:sound': '🎵', 'lane:em': '⚡',
  'lane:relativity': '⏱️', studio: '🎙️',
};
// 這些字太常見，只有在標題裡找不到更具體的東西時才用。
const GENERIC = new Set(['外星', '時間', '時空', '地球', '水', '光', '星', '力', '電', '磁', '熱', '能量', '宇宙', '月', '雲',
  '海洋', '深淵', '骨', '機械', '人類', '火球', '銀河', '大樓', '物質', '飛天']);
export function iconFor(e) {
  let best = null, fallback = null;
  for (const [word, icon] of ICONS) {
    const i = e.title.indexOf(word);
    if (i < 0) continue;
    const better = (b) => b === null || i < b.i || (i === b.i && word.length > b.len);
    if (GENERIC.has(word)) { if (better(fallback)) fallback = { i, len: word.length, icon }; }
    else if (better(best)) best = { i, len: word.length, icon };
  }
  return (best || fallback)?.icon || HOME_ICON[e.home] || '🎧';
}

// ---------- 場景主題 ----------
const THEMES = {
  l01: { sky: ['#07040f', '#1a0f33'], hue: [268, 300, 190], deco: 'atom', label: '#e7d6ff' },
  l02: { sky: ['#16040b', '#3a0d22'], hue: [340, 10, 300], deco: 'cells', label: '#ffd6e4' },
  l03: { sky: ['#041b2b', '#0b4a5c'], hue: [190, 120, 45], deco: 'life', label: '#e8fff4' },
  l04: { sky: ['#060914', '#141c3a'], hue: [28, 200, 300], deco: 'city', label: '#ffe9c7' },
  l05: { sky: ['#03101f', '#0a2a4a'], hue: [205, 25, 140], deco: 'earth', label: '#dff1ff' },
  l06: { sky: ['#02040b', '#0c1630'], hue: [210, 220, 45], deco: 'moon', label: '#e6efff' },
  l07: { sky: ['#030409', '#170c05'], hue: [35, 15, 200], deco: 'sun', label: '#fff0d6' },
  l08: { sky: ['#03030d', '#100a26'], hue: [230, 280, 50], deco: 'stars', label: '#e9e6ff' },
  l09: { sky: ['#020208', '#0d0820'], hue: [280, 200, 320], deco: 'galaxy', label: '#f1e6ff' },
  l10: { sky: ['#000003', '#0a0316'], hue: [300, 190, 40], deco: 'web', label: '#f6e8ff' },
  era: { sky: ['#120a02', '#2e1a06'], hue: [35, 20, 50], deco: 'time', label: '#fff1d6' },
  lane: { sky: ['#030712', '#0c1426'], hue: [190, 45, 320], deco: 'lanes', label: '#e0fbff' },
  studio: { sky: ['#120a06', '#2a160c'], hue: [30, 15, 45], deco: 'studio', label: '#ffeedd' },
};
const LANE_COLORS = ['#ff8a5c', '#ffd25c', '#ff5c8a', '#7cf2ff', '#b48cff', '#5cffb0', '#ffffff'];

// ---------- 音效（Web Audio，第一次點擊後才啟動） ----------
class Sound {
  constructor() { this.ctx = null; this.on = true; }
  wake() {
    if (this.ctx) return;
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { this.ctx = null; }
  }
  tone(freq, dur, type = 'sine', gain = 0.06, slide = 0) {
    if (!this.on || !this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.ctx.destination);
    o.start(t);
    o.stop(t + dur);
  }
  tune() {
    if (!this.on || !this.ctx) return;
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * 0.35);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    const filter = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();
    src.buffer = buf;
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(400, t);
    filter.frequency.exponentialRampToValueAtTime(3200, t + 0.3);
    g.gain.value = 0.05;
    src.connect(filter).connect(g).connect(this.ctx.destination);
    src.start(t);
    this.tone(220, 0.5, 'triangle', 0.04, 440);
  }
  blip() { this.tone(880, 0.08, 'square', 0.025); }
  pick() { this.tone(523, 0.12, 'triangle', 0.05); setTimeout(() => this.tone(784, 0.18, 'triangle', 0.05), 90); }
  chime() { [659, 880, 1175].forEach((f, i) => setTimeout(() => this.tone(f, 0.35, 'sine', 0.05), i * 110)); }
}

// ---------- 版面 ----------
function buildScene(view, world, episodes) {
  const groups = [];
  const theme = view.kind === 'level' ? view.id : view.kind;
  const hues = THEMES[theme].hue;
  if (view.kind === 'level') {
    const level = world.levels.find((l) => l.id === view.id);
    const here = episodes.filter((e) => e.home === view.id);
    const visiting = episodes.filter((e) => e.home !== view.id && (e.also || []).includes(view.id));
    level.zones.forEach((z, i) => {
      const items = here.filter((e) => e.zone === z.name);
      if (items.length) groups.push({ name: z.name, items, hue: hues[i % hues.length] + i * 9 });
    });
    if (visiting.length) groups.push({ name: '也會經過這裡', items: visiting, hue: hues[2] });
  } else if (view.kind === 'era') {
    world.eras.forEach((era, i) => {
      const items = episodes.filter((e) => e.home === `era:${era.id}` || (e.also || []).includes(`era:${era.id}`));
      groups.push({ name: era.name, items, hue: 30 + i * 8, era: true });
    });
  } else if (view.kind === 'lane') {
    world.lanes.forEach((lane, i) => {
      const items = episodes.filter((e) => e.home === `lane:${lane.id}` || (e.also || []).includes(`lane:${lane.id}`));
      groups.push({ name: lane.name, items, color: LANE_COLORS[i % LANE_COLORS.length] });
    });
  } else {
    groups.push({ name: '錄音室', items: episodes.filter((e) => e.home === 'studio'), hue: 30 });
  }

  // 每一區的大小跟集數有關；區域排成一圈（時光機排成一條時間河）。
  const spacing = 112;
  groups.forEach((g) => { g.r = Math.max(120, spacing * 0.7 * Math.sqrt(g.items.length + 1) + 56); });
  if (view.kind === 'era') {
    let x = 0;
    groups.forEach((g, i) => {
      x += (i ? groups[i - 1].r : 0) + g.r + 110;
      g.x = x;
      g.y = Math.sin(i * 1.3) * 160;
    });
    const mid = x / 2;
    groups.forEach((g) => { g.x -= mid; });
  } else if (groups.length === 1) {
    groups[0].x = 0;
    groups[0].y = 0;
  } else {
    const total = groups.reduce((s, g) => s + g.r * 2 + 120, 0);
    const ring = Math.max(260, total / TAU + 120);
    let angle = -Math.PI / 2;
    groups.forEach((g) => {
      const span = (g.r * 2 + 120) / ring;
      angle += span / 2;
      g.x = Math.cos(angle) * ring;
      g.y = Math.sin(angle) * ring * 0.78;
      angle += span / 2;
    });
  }

  const spots = [];
  groups.forEach((g) => {
    const seed = hash(g.name);
    const order = { public: 0, subscriber: 1, unreleased: 2 };
    g.items = [...g.items].sort((a, b) => order[a.state] - order[b.state]);
    g.items.forEach((e, i) => {
      const r = spacing * 0.7 * Math.sqrt(i + 0.6);
      const a = i * GOLDEN + seed * TAU;
      spots.push({
        e, icon: iconFor(e), group: g,
        x: g.x + Math.cos(a) * r, y: g.y + Math.sin(a) * r,
        phase: hash(e.code) * TAU,
      });
    });
  });

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  groups.forEach((g) => {
    minX = Math.min(minX, g.x - g.r); maxX = Math.max(maxX, g.x + g.r);
    minY = Math.min(minY, g.y - g.r - 40); maxY = Math.max(maxY, g.y + g.r);
  });
  if (!groups.length) { minX = minY = -300; maxX = maxY = 300; }
  return { view, theme, groups, spots, bounds: { minX, minY, maxX, maxY } };
}

// ---------- 主程式 ----------
export function createExplorer({ canvas, world, episodes, getStamps, onPick }) {
  const ctx = canvas.getContext('2d');
  const sound = new Sound();
  const sprites = new Map();
  const cam = { x: 0, y: 0, z: 1, tx: 0, ty: 0, tz: 1 };
  const ship = { x: 0, y: 0, tx: 0, ty: 0, angle: 0, trail: [] };
  let scene = null;
  let W = 0, H = 0, dpr = 1;
  let time = 0, last = performance.now();
  let hover = null;
  let warp = null; // { t, dur, next }
  let flight = null; // { spot, done }
  let stars = [];
  let particles = [];
  let running = true;

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    makeStars();
    if (scene) fit(true);
  }

  function makeStars() {
    const r = rng(0.42);
    const count = Math.min(260, Math.round((W * H) / 3800));
    stars = Array.from({ length: count }, () => ({ x: r(), y: r(), z: 0.2 + r() * 0.8, tw: r() * TAU }));
    particles = Array.from({ length: 40 }, () => ({ x: r(), y: r(), s: 0.5 + r(), v: 0.2 + r() * 0.6 }));
  }

  function fit(instant) {
    const b = scene.bounds;
    const padTop = 150, padBottom = 190;
    if (W < 700 && scene.groups.length > 1) {
      // 手機一開始就停在最熱鬧的一區，不要落在兩區之間的空地。
      const live = (g) => g.items.filter((e) => e.state !== 'unreleased').length;
      const g = scene.groups.reduce((a, c) => (live(c) > live(a) ? c : a));
      cam.tz = Math.max(0.35, Math.min(1, (W - 40) / (g.r * 2 + 60)));
      cam.tx = g.x;
      cam.ty = g.y - (padTop - padBottom) / 2 / cam.tz;
      if (instant) { cam.x = cam.tx; cam.y = cam.ty; cam.z = cam.tz; }
      return;
    }
    const zx = W / (b.maxX - b.minX + 120);
    const zy = (H - padTop - padBottom) / (b.maxY - b.minY + 120);
    const z = Math.max(0.28, Math.min(1.1, Math.min(zx, zy)));
    cam.tz = z;
    cam.tx = (b.minX + b.maxX) / 2;
    cam.ty = (b.minY + b.maxY) / 2 - (padTop - padBottom) / 2 / z;
    if (instant) { cam.x = cam.tx; cam.y = cam.ty; cam.z = cam.tz; }
  }

  const toScreen = (x, y) => [(x - cam.x) * cam.z + W / 2, (y - cam.y) * cam.z + H / 2];
  const toWorld = (sx, sy) => [(sx - W / 2) / cam.z + cam.x, (sy - H / 2) / cam.z + cam.y];

  function sprite(icon, size) {
    const key = `${icon}@${size}`;
    if (!sprites.has(key)) {
      const c = document.createElement('canvas');
      c.width = c.height = Math.ceil(size * 1.4 * dpr);
      const g = c.getContext('2d');
      g.scale(dpr, dpr);
      g.font = `${size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(icon, size * 0.7, size * 0.75);
      sprites.set(key, c);
    }
    return sprites.get(key);
  }

  // ---------- 背景 ----------
  function drawSky(theme) {
    const t = THEMES[theme];
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, t.sky[0]);
    grad.addColorStop(1, t.sky[1]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // 星星（太空格比較多）與遠景光暈，跟著鏡頭有視差。
    const space = ['l06', 'l07', 'l08', 'l09', 'l10', 'lane', 'l01'].includes(theme);
    const density = space ? 1 : 0.35;
    const streak = warp ? Math.sin(Math.min(1, warp.t / warp.dur) * Math.PI) : 0;
    stars.forEach((s, i) => {
      if (i > stars.length * density) return;
      const px = ((s.x * W - cam.x * cam.z * s.z * 0.15) % W + W) % W;
      const py = ((s.y * H - cam.y * cam.z * s.z * 0.15) % H + H) % H;
      const a = 0.35 + 0.65 * Math.abs(Math.sin(time * 1.3 + s.tw));
      ctx.globalAlpha = a * (space ? 1 : 0.6);
      ctx.fillStyle = '#fff';
      if (streak > 0.02) {
        const dx = px - W / 2, dy = py - H / 2;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = s.z * 1.5;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + dx * streak * 0.6 * s.z, py + dy * streak * 0.6 * s.z);
        ctx.stroke();
      } else {
        ctx.fillRect(px, py, s.z * 1.8, s.z * 1.8);
      }
    });
    ctx.globalAlpha = 1;

    t.hue.forEach((h, i) => {
      const nx = W * (0.2 + 0.3 * i) - cam.x * cam.z * 0.05;
      const ny = H * (0.3 + 0.2 * Math.sin(time * 0.1 + i)) - cam.y * cam.z * 0.05;
      const g = ctx.createRadialGradient(nx, ny, 0, nx, ny, Math.max(W, H) * 0.45);
      g.addColorStop(0, `hsla(${h},80%,55%,0.16)`);
      g.addColorStop(1, `hsla(${h},80%,55%,0)`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    });
  }

  function drawDeco(theme) {
    const [cx, cy] = toScreen(0, 0);
    const z = cam.z;
    ctx.save();
    switch (THEMES[theme].deco) {
      case 'sun': {
        const r = 120 * z;
        const g = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * 2.6);
        g.addColorStop(0, '#fff6c8'); g.addColorStop(0.25, '#ffb43c'); g.addColorStop(0.6, 'rgba(255,110,20,0.25)'); g.addColorStop(1, 'rgba(255,80,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(cx, cy, r * 2.6, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(255,200,120,0.12)';
        ctx.lineWidth = 1;
        [1.7, 2.6, 3.6, 4.7, 5.9].forEach((k) => { ctx.beginPath(); ctx.ellipse(cx, cy, r * k * 1.3, r * k, 0, 0, TAU); ctx.stroke(); });
        break;
      }
      case 'moon': {
        const r = 90 * z;
        const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
        g.addColorStop(0, '#7fd0ff'); g.addColorStop(0.6, '#1f6fb8'); g.addColorStop(1, '#0a2a55');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
        const a = time * 0.25;
        const mx = cx + Math.cos(a) * r * 3.4, my = cy + Math.sin(a) * r * 2.4;
        ctx.strokeStyle = 'rgba(200,220,255,0.15)'; ctx.beginPath(); ctx.ellipse(cx, cy, r * 3.4, r * 2.4, 0, 0, TAU); ctx.stroke();
        ctx.fillStyle = '#d9dde6'; ctx.beginPath(); ctx.arc(mx, my, r * 0.27, 0, TAU); ctx.fill();
        break;
      }
      case 'earth': {
        const r = 150 * z;
        [['#ffcf5a', 0.22], ['#ff8a3c', 0.45], ['#c2542a', 0.7]].forEach(([c, k]) => {
          ctx.fillStyle = c; ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.arc(cx, cy, r * k, 0, TAU); ctx.fill();
        });
        ctx.globalAlpha = 1;
        ctx.strokeStyle = 'rgba(120,200,255,0.5)'; ctx.lineWidth = 3 * z;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();
        break;
      }
      case 'stars': {
        for (let i = 0; i < 40; i++) {
          const rr = rng(i / 40 + 0.1);
          const x = cx + (rr() - 0.5) * 700 * z, y = cy + (rr() - 0.5) * 500 * z;
          const s = (1 + rr() * 3) * z * (1 + 0.3 * Math.sin(time * 2 + i));
          ctx.fillStyle = `hsla(${200 + rr() * 60},90%,85%,0.9)`; ctx.beginPath(); ctx.arc(x, y, s, 0, TAU); ctx.fill();
        }
        break;
      }
      case 'galaxy': {
        for (let i = 0; i < 700; i++) {
          const arm = i % 3, t = (i / 700) * 3;
          const a = t * 2.2 + arm * (TAU / 3) + time * 0.03;
          const d = t * 150 * z;
          const jitter = Math.sin(i * 12.9898) * 18 * z;
          ctx.fillStyle = i % 7 === 0 ? 'rgba(255,180,255,0.7)' : 'rgba(190,200,255,0.5)';
          ctx.fillRect(cx + Math.cos(a) * d + jitter, cy + Math.sin(a) * d * 0.6 + jitter, 1.6, 1.6);
        }
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 70 * z);
        g.addColorStop(0, 'rgba(255,240,220,0.9)'); g.addColorStop(1, 'rgba(255,200,255,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, 70 * z, 0, TAU); ctx.fill();
        break;
      }
      case 'web': {
        const rr = rng(0.77);
        const nodes = Array.from({ length: 36 }, () => [cx + (rr() - 0.5) * 1100 * z, cy + (rr() - 0.5) * 800 * z]);
        ctx.strokeStyle = 'rgba(200,140,255,0.18)'; ctx.lineWidth = 1;
        nodes.forEach((n, i) => nodes.slice(i + 1).forEach((m) => {
          if (Math.hypot(n[0] - m[0], n[1] - m[1]) < 260 * z) { ctx.beginPath(); ctx.moveTo(n[0], n[1]); ctx.lineTo(m[0], m[1]); ctx.stroke(); }
        }));
        nodes.forEach(([x, y], i) => { ctx.fillStyle = `rgba(255,210,255,${0.4 + 0.4 * Math.sin(time + i)})`; ctx.beginPath(); ctx.arc(x, y, 3 * z, 0, TAU); ctx.fill(); });
        break;
      }
      case 'atom': {
        ctx.strokeStyle = 'rgba(190,150,255,0.35)'; ctx.lineWidth = 2 * z;
        [0, 1, 2].forEach((k) => {
          ctx.save(); ctx.translate(cx, cy); ctx.rotate(k * Math.PI / 3);
          ctx.beginPath(); ctx.ellipse(0, 0, 260 * z, 90 * z, 0, 0, TAU); ctx.stroke();
          const a = time * (1.2 + k * 0.3);
          ctx.fillStyle = '#9ef0ff'; ctx.beginPath(); ctx.arc(Math.cos(a) * 260 * z, Math.sin(a) * 90 * z, 7 * z, 0, TAU); ctx.fill();
          ctx.restore();
        });
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 50 * z);
        g.addColorStop(0, '#ffe2a8'); g.addColorStop(1, 'rgba(255,120,80,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, 50 * z, 0, TAU); ctx.fill();
        break;
      }
      case 'cells': {
        particles.forEach((p, i) => {
          const x = ((p.x * W + time * 12 * p.v) % (W + 80)) - 40, y = p.y * H + Math.sin(time * p.v + i) * 20;
          ctx.strokeStyle = 'rgba(255,150,190,0.25)'; ctx.fillStyle = 'rgba(255,120,170,0.08)'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(x, y, 14 + p.s * 20, 0, TAU); ctx.fill(); ctx.stroke();
          ctx.fillStyle = 'rgba(255,200,220,0.35)'; ctx.beginPath(); ctx.arc(x + 4, y - 3, 4 + p.s * 4, 0, TAU); ctx.fill();
        });
        break;
      }
      case 'life': {
        particles.forEach((p, i) => {
          const y = H - ((p.y * H + time * 18 * p.v) % (H + 40)), x = p.x * W + Math.sin(time + i) * 10;
          ctx.strokeStyle = 'rgba(200,255,255,0.3)'; ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.arc(x, y, 2 + p.s * 4, 0, TAU); ctx.stroke();
        });
        break;
      }
      case 'city': {
        ctx.strokeStyle = 'rgba(255,170,80,0.12)'; ctx.lineWidth = 1;
        const horizon = H * 0.62;
        for (let i = -12; i <= 12; i++) { ctx.beginPath(); ctx.moveTo(W / 2 + i * 30, horizon); ctx.lineTo(W / 2 + i * 220, H); ctx.stroke(); }
        for (let k = 0; k < 8; k++) { const y = horizon + Math.pow(k / 8, 2) * (H - horizon); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
        const rr = rng(0.33);
        ctx.fillStyle = 'rgba(10,14,30,0.85)';
        for (let x = 0; x < W; x += 34) {
          const h = 40 + rr() * 120;
          ctx.fillRect(x, horizon - h, 30, h);
          ctx.fillStyle = 'rgba(255,190,90,0.5)';
          for (let wy = horizon - h + 8; wy < horizon - 6; wy += 14) if (rr() > 0.55) ctx.fillRect(x + 6 + (rr() > 0.5 ? 12 : 0), wy, 5, 6);
          ctx.fillStyle = 'rgba(10,14,30,0.85)';
        }
        break;
      }
      case 'time': {
        if (!scene.groups.length) break;
        ctx.strokeStyle = 'rgba(255,190,90,0.55)'; ctx.lineWidth = 10 * z; ctx.lineCap = 'round';
        ctx.setLineDash([2 * z, 22 * z]);
        ctx.lineDashOffset = -time * 40;
        ctx.beginPath();
        scene.groups.forEach((g, i) => { const [x, y] = toScreen(g.x, g.y); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
        ctx.stroke();
        ctx.setLineDash([]);
        break;
      }
      case 'lanes': {
        scene.groups.forEach((g) => {
          const [x, y] = toScreen(g.x, g.y);
          ctx.strokeStyle = g.color; ctx.globalAlpha = 0.35; ctx.lineWidth = 6 * z;
          ctx.setLineDash([16 * z, 14 * z]); ctx.lineDashOffset = -time * 60;
          ctx.beginPath(); ctx.moveTo(cx, cy); ctx.quadraticCurveTo((cx + x) / 2 + (y - cy) * 0.3, (cy + y) / 2 - (x - cx) * 0.3, x, y); ctx.stroke();
        });
        ctx.setLineDash([]); ctx.globalAlpha = 1;
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 60 * z);
        g.addColorStop(0, '#ffffff'); g.addColorStop(1, 'rgba(120,220,255,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, 60 * z, 0, TAU); ctx.fill();
        break;
      }
      case 'studio': {
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 400 * z);
        g.addColorStop(0, 'rgba(255,190,120,0.25)'); g.addColorStop(1, 'rgba(255,190,120,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, 400 * z, 0, TAU); ctx.fill();
        break;
      }
      default: break;
    }
    ctx.restore();
  }

  // ---------- 區域與頻道 ----------
  function drawGroups() {
    const t = THEMES[scene.theme];
    scene.groups.forEach((g) => {
      const [x, y] = toScreen(g.x, g.y);
      const r = g.r * cam.z;
      const color = g.color || `hsl(${g.hue},75%,60%)`;
      const grad = ctx.createRadialGradient(x, y, r * 0.1, x, y, r);
      grad.addColorStop(0, g.color ? `${g.color}33` : `hsla(${g.hue},80%,60%,0.22)`);
      grad.addColorStop(1, g.color ? `${g.color}00` : `hsla(${g.hue},80%,60%,0.02)`);
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      ctx.strokeStyle = color; ctx.globalAlpha = 0.35; ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 8]); ctx.lineDashOffset = time * 10;
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
      ctx.setLineDash([]); ctx.globalAlpha = 1;
      const size = Math.max(13, Math.min(22, 18 * cam.z + 6));
      ctx.font = `700 ${size}px "Noto Sans TC","PingFang TC",sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = t.label;
      ctx.shadowColor = color; ctx.shadowBlur = 12;
      ctx.fillText(`${g.name} · ${g.items.length}`, x, y - r - 10);
      ctx.shadowBlur = 0;
    });
  }

  function drawSpots() {
    const stampsNow = getStamps();
    const base = Math.max(18, Math.min(34, 30 * cam.z + 4));
    scene.spots.forEach((s) => {
      const bob = reduceMotion ? 0 : Math.sin(time * 1.6 + s.phase) * 4;
      const [x, y0] = toScreen(s.x, s.y);
      const y = y0 + bob;
      if (x < -60 || x > W + 60 || y < -60 || y > H + 60) return;
      const e = s.e;
      const isHover = hover === s;
      const vip = e.state === 'subscriber', soon = e.state === 'unreleased';
      const r = base * (isHover ? 1.25 : 1) * (soon && !isHover ? 0.6 : 1);
      if (soon && !isHover) ctx.globalAlpha = 0.55;
      const glow = vip ? '255,205,80' : soon ? '140,150,190' : '140,240,255';
      const g = ctx.createRadialGradient(x, y, r * 0.3, x, y, r * 1.9);
      g.addColorStop(0, `rgba(${glow},${soon ? 0.15 : 0.45})`);
      g.addColorStop(1, `rgba(${glow},0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 1.9, 0, TAU); ctx.fill();
      ctx.fillStyle = soon ? 'rgba(20,26,44,0.85)' : 'rgba(10,20,40,0.78)';
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      ctx.lineWidth = vip ? 3 : 2;
      ctx.strokeStyle = `rgba(${glow},${soon ? 0.5 : 0.95})`;
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
      if (vip && !reduceMotion) {
        const a = time * 1.5 + s.phase;
        ctx.fillStyle = '#ffe9a3';
        [0, Math.PI].forEach((o) => { ctx.beginPath(); ctx.arc(x + Math.cos(a + o) * r * 1.25, y + Math.sin(a + o) * r * 1.25, 2.4, 0, TAU); ctx.fill(); });
      }
      if (soon) {
        ctx.globalAlpha = 0.55 + 0.25 * Math.sin(time * 2 + s.phase);
        ctx.fillStyle = '#c9d2ee';
        ctx.font = `700 ${Math.round(r)}px sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('?', x, y + 1);
        ctx.globalAlpha = 1;
      } else {
        const img = sprite(s.icon, Math.round(r * 1.1));
        ctx.drawImage(img, x - img.width / dpr / 2, y - img.height / dpr / 2, img.width / dpr, img.height / dpr);
      }
      ctx.textBaseline = 'alphabetic';
      ctx.globalAlpha = 1;
      if ((cam.z > 0.45 && !soon) || isHover) {
        ctx.font = `700 ${Math.round(Math.max(11, r * 0.42))}px "Noto Sans TC",sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillStyle = vip ? '#ffd970' : soon ? '#8d97b8' : '#e9fbff';
        ctx.fillText(e.code, x, y + r + 15);
      }
      const marks = (stampsNow.ear.includes(e.code) ? '👂' : '') + (stampsNow.hand.includes(e.code) ? '✋' : '');
      if (marks) {
        ctx.font = `${Math.round(r * 0.55)}px sans-serif`;
        ctx.textAlign = 'left';
        ctx.fillText(marks, x + r * 0.55, y - r * 0.55);
      } else if ((stampsNow.seen || []).includes(e.code)) {
        ctx.fillStyle = '#7cf2c8'; ctx.beginPath(); ctx.arc(x + r * 0.75, y - r * 0.75, 5, 0, TAU); ctx.fill();
      }
      if (isHover) {
        const name = soon ? `神秘訊號・${e.title}` : e.title;
        const title = name.length > 22 ? `${name.slice(0, 22)}…` : name;
        ctx.font = '700 14px "Noto Sans TC",sans-serif';
        const w = ctx.measureText(title).width + 20;
        const bx = Math.min(W - w - 8, Math.max(8, x - w / 2)), by = y - r - 46;
        ctx.fillStyle = 'rgba(8,14,30,0.92)'; ctx.strokeStyle = `rgba(${glow},0.9)`; ctx.lineWidth = 1;
        roundRect(bx, by, w, 28, 14); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.fillText(title, bx + 10, by + 19);
      }
    });
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  // ---------- 耳機號 ----------
  function drawShip(dt) {
    ship.x = lerp(ship.x, ship.tx, Math.min(1, dt * 3.2));
    ship.y = lerp(ship.y, ship.ty, Math.min(1, dt * 3.2));
    const dx = ship.tx - ship.x, dy = ship.ty - ship.y;
    const moving = Math.hypot(dx, dy) > 4;
    if (moving) ship.angle = lerp(ship.angle, Math.atan2(dy, dx), Math.min(1, dt * 6));
    const [x, y0] = toScreen(ship.x, ship.y);
    const y = y0 + (reduceMotion ? 0 : Math.sin(time * 2.2) * 3);
    if (moving || Math.random() < 0.3) ship.trail.push({ x, y, life: 1 });
    ship.trail = ship.trail.filter((p) => (p.life -= dt * 1.8) > 0).slice(-40);
    ship.trail.forEach((p) => {
      ctx.fillStyle = `rgba(255,170,60,${p.life * 0.5})`;
      ctx.beginPath(); ctx.arc(p.x, p.y + 10, 6 * p.life, 0, TAU); ctx.fill();
    });
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.cos(ship.angle) * 0.18);
    const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, 46);
    glow.addColorStop(0, 'rgba(255,190,90,0.45)'); glow.addColorStop(1, 'rgba(255,190,90,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, 0, 46, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#f4a640'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, 2, 20, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke();
    [-1, 1].forEach((side) => {
      ctx.fillStyle = '#2f4f6f'; ctx.strokeStyle = '#f4a640'; ctx.lineWidth = 3;
      roundRect(side * 20 - 8, -2, 16, 22, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#94dfe1'; ctx.beginPath(); ctx.arc(side * 20, 9, 3.5, 0, TAU); ctx.fill();
    });
    ctx.fillStyle = '#94dfe1'; ctx.beginPath(); ctx.arc(0, 4, 6, 0, TAU); ctx.fill();
    ctx.restore();
  }

  // ---------- 主迴圈 ----------
  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    time += dt;
    if (scene) {
      const k = Math.min(1, dt * 4);
      cam.x = lerp(cam.x, cam.tx, k); cam.y = lerp(cam.y, cam.ty, k); cam.z = lerp(cam.z, cam.tz, k);
      if (warp) {
        warp.t += dt * 1000;
        const p = Math.min(1, warp.t / warp.dur);
        if (warp.next && p >= 0.5) { setScene(warp.next); warp.next = null; cam.z = cam.tz * 0.35; }
        if (p >= 1) warp = null;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawSky(scene.theme);
      drawDeco(scene.theme);
      drawGroups();
      drawSpots();
      drawShip(dt);
      if (warp) {
        const p = Math.min(1, warp.t / warp.dur);
        ctx.fillStyle = `rgba(255,255,255,${Math.max(0, 0.5 - Math.abs(p - 0.5)) * 1.2})`;
        ctx.fillRect(0, 0, W, H);
      }
      if (flight && Math.hypot(ship.x - flight.spot.x, ship.y - flight.spot.y) < 40) {
        const done = flight;
        flight = null;
        onPick(done.spot.e.code);
      }
    }
    requestAnimationFrame(frame);
  }

  function setScene(view) {
    scene = buildScene(view, world, episodes);
    fit(true);
    ship.x = ship.tx = cam.x;
    ship.y = ship.ty = cam.y + 64;
    hover = null;
  }

  // ---------- 操作 ----------
  const pointers = new Map();
  let drag = null;
  let pinch = null;

  function spotAt(sx, sy) {
    const base = Math.max(18, Math.min(34, 30 * cam.z + 4));
    let best = null, bestD = base + 10;
    scene.spots.forEach((s) => {
      const [x, y] = toScreen(s.x, s.y);
      const d = Math.hypot(x - sx, y - sy);
      if (d < bestD) { best = s; bestD = d; }
    });
    return best;
  }

  canvas.addEventListener('pointerdown', (ev) => {
    sound.wake();
    canvas.setPointerCapture(ev.pointerId);
    pointers.set(ev.pointerId, [ev.offsetX, ev.offsetY]);
    if (pointers.size === 1) drag = { sx: ev.offsetX, sy: ev.offsetY, cx: cam.tx, cy: cam.ty, moved: false };
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), z: cam.tz };
      drag = null;
    }
  });
  canvas.addEventListener('pointermove', (ev) => {
    if (pointers.has(ev.pointerId)) pointers.set(ev.pointerId, [ev.offsetX, ev.offsetY]);
    if (pinch && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      cam.tz = Math.max(0.25, Math.min(2.6, pinch.z * Math.hypot(a[0] - b[0], a[1] - b[1]) / pinch.d));
      return;
    }
    if (drag) {
      const dx = ev.offsetX - drag.sx, dy = ev.offsetY - drag.sy;
      if (Math.hypot(dx, dy) > 6) drag.moved = true;
      if (drag.moved) { cam.tx = drag.cx - dx / cam.z; cam.ty = drag.cy - dy / cam.z; cam.x = cam.tx; cam.y = cam.ty; }
      return;
    }
    const s = spotAt(ev.offsetX, ev.offsetY);
    if (s !== hover) { hover = s; if (s) sound.blip(); }
    canvas.style.cursor = s ? 'pointer' : 'grab';
  });
  const release = (ev) => {
    pointers.delete(ev.pointerId);
    if (pointers.size < 2) pinch = null;
    if (drag && !drag.moved && ev.type === 'pointerup') {
      const s = spotAt(ev.offsetX, ev.offsetY);
      if (s) fly(s);
    }
    drag = null;
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('wheel', (ev) => {
    ev.preventDefault();
    const [wx, wy] = toWorld(ev.offsetX, ev.offsetY);
    const nz = Math.max(0.25, Math.min(2.6, cam.tz * Math.exp(-ev.deltaY * 0.0015)));
    cam.tx = wx - (ev.offsetX - W / 2) / nz;
    cam.ty = wy - (ev.offsetY - H / 2) / nz;
    cam.tz = nz;
  }, { passive: false });

  function fly(spot) {
    sound.pick();
    ship.tx = spot.x;
    ship.ty = spot.y;
    cam.tx = spot.x;
    cam.ty = spot.y;
    cam.tz = Math.max(cam.tz, 0.9);
    flight = { spot };
    if (reduceMotion) { ship.x = spot.x; ship.y = spot.y; }
  }

  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => {
    running = !document.hidden;
    if (running) { last = performance.now(); requestAnimationFrame(frame); }
  });

  resize();
  requestAnimationFrame(frame);

  return {
    show(view) {
      if (!scene || reduceMotion) { setScene(view); return; }
      sound.tune();
      warp = { t: 0, dur: 700, next: view };
    },
    zoom(delta) { cam.tz = Math.max(0.25, Math.min(2.6, cam.tz * (delta > 0 ? 1.25 : 0.8))); },
    home() { fit(false); },
    pan(dx, dy) { cam.tx += dx / cam.z; cam.ty += dy / cam.z; },
    celebrate() { sound.chime(); },
    sound,
    progress(view) {
      const sc = scene && scene.view === view ? scene : buildScene(view, world, episodes);
      const seen = new Set(getStamps().seen || []);
      return { seen: sc.spots.filter((s) => seen.has(s.e.code)).length, total: sc.spots.length };
    },
  };
}
