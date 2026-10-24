// 宇宙群島：一座一座浮在天上的島。每座島 = 浮空岩塊 + 這個主題的小東西（靜態的合成一個網格，會動的另外放）。
// 座標：島的地面在 y = 0，島心在 (0, 0, 0)；半徑 R 大約 11～22。居民大約 2 個單位高。
import * as THREE from 'three';
import { TAU, mergeStatic, cached, glowSprite, EMOJI_FONT } from './kit3d.js';
import { rng, hash } from './explorer.js';

// ---------- 共用的基本形狀（所有島一起用，縮放、轉一下就變成不同東西） ----------
let S = null;
function shapes() {
  if (S) return S;
  S = {
    box: new THREE.BoxGeometry(1, 1, 1),
    cyl: new THREE.CylinderGeometry(1, 1, 1, 12),
    cyl6: new THREE.CylinderGeometry(1, 1, 1, 6),
    cyl3: new THREE.CylinderGeometry(1, 1, 1, 3),
    cone: new THREE.ConeGeometry(1, 1, 12),
    cone6: new THREE.ConeGeometry(1, 1, 6),
    cone4: new THREE.ConeGeometry(1, 1, 4),
    frustum: new THREE.CylinderGeometry(0.7, 1, 1, 4),
    ball: new THREE.SphereGeometry(1, 14, 10),
    bead: new THREE.SphereGeometry(1, 7, 5), // 小小的球（花、果子、眼睛）不用那麼圓
    half: new THREE.SphereGeometry(1, 14, 8, 0, TAU, 0, Math.PI / 2),
    blob: new THREE.IcosahedronGeometry(1, 1),
    lump: new THREE.IcosahedronGeometry(1, 0),
    dodeca: new THREE.DodecahedronGeometry(1, 0),
    octa: new THREE.OctahedronGeometry(1, 0),
    torus: new THREE.TorusGeometry(1, 0.22, 8, 24),
    thin: new THREE.TorusGeometry(1, 0.06, 6, 40),
    arch: new THREE.TorusGeometry(1, 0.16, 8, 24, Math.PI),
    capsule: new THREE.CapsuleGeometry(0.5, 1, 3, 8),
    disc: new THREE.CylinderGeometry(1, 1, 0.1, 24),
    knot: new THREE.TorusKnotGeometry(0.45, 0.15, 48, 6),
  };
  return S;
}
const mats = new Map();
/** 會動的東西用的材質（同樣的顏色共用一個）。 */
function M(color, { e = 0, ei = 0.6, rough = 0.7, metal = 0, opacity = 1, flat = true, side = THREE.FrontSide } = {}) {
  const key = [color, e, ei, rough, metal, opacity, flat, side].join(',');
  if (!mats.has(key)) {
    mats.set(key, new THREE.MeshStandardMaterial({ color, emissive: e || 0x000000, emissiveIntensity: ei, roughness: rough, metalness: metal, flatShading: flat,
      transparent: opacity < 1, opacity, depthWrite: opacity >= 1, side }));
  }
  return mats.get(key);
}
export const PALETTE = {
  leaf: [0x5fcf6a, 0x45b85c, 0x7edc6c, 0x3fa35a], trunk: 0x9a6a46, rock: 0xc7b8a8, water: 0x5cc8f2,
  flower: [0xff7aa8, 0xffd25a, 0xffffff, 0xb98cff, 0xff9a5c], roof: [0xff8a6b, 0x6cb8ff, 0xffc25a, 0xb98cff, 0x5fcfa0, 0xff7aa8],
  wall: [0xfff4e0, 0xffe6d0, 0xe6f4ff, 0xfff0f6, 0xeaffea],
};

// 每種島：地面、邊緣、下面一層一層的土、要不要長草
// cliff：陡坡露出的岩石；shore：水邊；peak／peakY：高處的顏色（雪）
const BIOMES = {
  studio: { ground: 0x9fe07c, edge: 0x7ac85e, soil: [0xf0bb84, 0xdc9c6c, 0xbf7f58], cliff: 0xc89a72 },
  rainforest: { ground: 0x6fd46e, edge: 0x4cb85a, soil: [0xe0a878, 0xc78a62, 0xa86e50], cliff: 0xa8805a, shore: 0xc8b07a },
  savanna: { ground: 0xf4d880, edge: 0xe3bd62, soil: [0xeab27a, 0xd49464, 0xb87a52], cliff: 0xc8946a, shore: 0xb89060 },
  desert: { ground: 0xfbe3a6, edge: 0xf1cc84, soil: [0xf6c98a, 0xe8b072, 0xd0955e], cliff: 0xe0a070 },
  stoneage: { ground: 0xbcd47e, edge: 0x9cbc62, soil: [0xd9a87a, 0xbf8c62, 0xa0724e], cliff: 0x9a8270, shore: 0xc8b48a },
  dino: { ground: 0x9ad872, edge: 0x7cc05c, soil: [0xe2ac7c, 0xc98f66, 0xaa7354], cliff: 0xb88a62 },
  volcano: { ground: 0xd9a585, edge: 0xc48b6c, soil: [0xc08068, 0xa66a58, 0x8a5648], cliff: 0x8a5a48 },
  ice: { ground: 0xf6fbff, edge: 0xdcefff, soil: [0xc8e8fb, 0xa6d6f4, 0x86c2ec], cliff: 0x9fc4e0, shore: 0xd6ecfa, peak: 0xffffff, peakY: 2.4 },
  ocean: { ground: 0xfbe6b2, edge: 0xf0d394, soil: [0xeec08a, 0xd9a676, 0xc08a62] },
  wetland: { ground: 0x8edc7a, edge: 0x6cc462, soil: [0xd9a87c, 0xc28e66, 0xa67452], cliff: 0xa88a62, shore: 0x8a7a52 },
  zoo: { ground: 0xa6e482, edge: 0x84cc66, soil: [0xebb684, 0xd49a6c, 0xb88058], cliff: 0xb89a72 },
  sky: { ground: 0xffffff, edge: 0xf2f6ff, soil: null, cliff: 0xe2ecff },
  body: { ground: 0xffd2de, edge: 0xffb6ca, soil: [0xf7a6bf, 0xe88ca8, 0xd27392], cliff: 0xf08aa8 },
  atom: { ground: 0xdcefff, edge: 0xbcdcf8, soil: [0xc2b2f4, 0xa996e6, 0x8e7cd4], cliff: 0xa996e6 },
  force: { ground: 0xffe7a0, edge: 0xf6cf74, soil: [0xf6b27a, 0xe8955e, 0xcc7a4c], cliff: 0xe8955e },
  lightning: { ground: 0xe2dcff, edge: 0xc8beff, soil: [0xb4a6f6, 0x9886e6, 0x7c6cd0], cliff: 0xa898f0 },
  scientists: { ground: 0xa8e08c, edge: 0x88c870, soil: [0xe8b688, 0xd09a70, 0xb4805a], cliff: 0xb89a72 },
  city: { ground: 0xe4e8f2, edge: 0x9fdc84, soil: [0xc8cede, 0xaeb6ca, 0x949db4], cliff: 0xaeb6ca },
  flight: { ground: 0xaee494, edge: 0x8ccc74, soil: [0xe8b688, 0xd09a70, 0xb4805a], cliff: 0xb89a72 },
  moon: { ground: 0xeceef4, edge: 0xd2d6e2, soil: [0xc2c6d4, 0xa8adbf, 0x8e94a8], cliff: 0xaab0c0 },
  planets: { ground: 0xffe6c2, edge: 0xf8cc98, soil: [0xf2b088, 0xe09470, 0xc8785c], cliff: 0xe09470 },
  stars: { ground: 0xd6c8ff, edge: 0xbca8ff, soil: [0xa892f6, 0x8c74e6, 0x705ad2], cliff: 0x9a86e0 },
};

// ---------- 擺東西的工具 ----------
class Kit {
  constructor(def, R) {
    this.def = def; this.R = R;
    this.r = rng(hash(def.id) + 0.123);
    this.solid = []; this.live = new THREE.Group(); this.ticks = []; this.obst = [];
    this.S = shapes();
    this.walkR = R * 0.8; this.walkY = 0;
    // 地形：hraw 是這座島的起伏（邊緣會自動收回 0）；flats 是要整平的地方（建築、池塘、停機坪）
    this.hraw = () => 0; this.flats = []; this.water = null; this.wob = wobble(hash(def.id));
  }
  /** 這裡的地面有多高。 */
  ground(x, z) {
    const r = Math.hypot(x, z);
    let h = this.hraw(x, z) * (1 - smooth01((r - this.R * 0.72) / (this.R * 0.24)));
    for (const f of this.flats) {
      const d = Math.hypot(x - f.x, z - f.z);
      if (d < f.r + f.blend) h += (f.h - h) * (d <= f.r ? 1 : 1 - smooth01((d - f.r) / f.blend));
    }
    return h;
  }
  /** 把一塊地整平（高度不給就用現在中心的高度）。 */
  flat(x, z, r, h = null, blend = 1.5) { this.flats.push({ x, z, r, h: h ?? this.ground(x, z), blend }); }
  slope(x, z, r = 0.8) {
    const c = this.ground(x, z);
    return Math.max(Math.abs(this.ground(x + r, z) - c), Math.abs(this.ground(x - r, z) - c), Math.abs(this.ground(x, z + r) - c), Math.abs(this.ground(x, z - r) - c)) / r;
  }
  /** 能不能放東西／走路：不能太陡、不能在水裡。 */
  usable(x, z, r = 0.8, maxSlope = 0.55) {
    if (this.water != null && this.ground(x, z) < this.water + 0.25) return false;
    return this.slope(x, z, Math.max(0.6, r)) <= maxSlope;
  }
  rand(a = 0, b = 1) { return a + this.r() * (b - a); }
  pick(list) { return list[Math.floor(this.r() * list.length) % list.length]; }
  /** 一個靜態零件（最後合成一個網格）。ry 是朝向，rx／rz 是在自己身上的傾斜。 */
  part(geo, color, x, y, z, sx = 1, sy = sx, sz = sx, ry = 0, rx = 0, rz = 0, anchor = null) {
    if (geo === this.S.ball && Math.max(sx, sy, sz) < 0.36) geo = this.S.bead;
    const m = new THREE.Mesh(geo, { color: new THREE.Color(color) });
    m.userData.shared = true;
    m.userData.own = !Object.values(this.S).includes(geo); // 自己做的形狀：合成之後丟掉
    // 站在地形上：一組東西（房子、樹）用同一個錨點的高度，才不會被坡度拆開
    const g = this.noGround ? 0 : anchor ? this.ground(anchor[0], anchor[1]) : this.ground(x, z);
    m.position.set(x, y + g, z);
    m.scale.set(sx, sy, sz);
    m.rotation.order = 'YXZ';
    m.rotation.set(rx, ry, rz);
    this.solid.push(m);
    return m;
  }
  /** 以 (x, z) 為原點、朝 ry 的方向擺零件（房子、樹這類有好幾塊的東西用）。 */
  at(x, z, ry = 0, s = 1) {
    const c = Math.cos(ry), sn = Math.sin(ry);
    const anchor = [x, z];
    return (geo, color, lx, ly, lz, sx = 1, sy = sx, sz = sx, lry = 0, rx = 0, rz = 0) =>
      this.part(geo, color, x + (lx * c + lz * sn) * s, ly * s, z + (-lx * sn + lz * c) * s, sx * s, sy * s, sz * s, ry + lry, rx, rz, anchor);
  }
  /** 這裡有東西了（之後別的東西不會放上來、居民不會走進去）。大東西底下順便整平。 */
  block(x, z, r, flatten = true) {
    if (flatten && r >= 1.3) this.flats.push({ x, z, r: r * 0.85, h: this.ground(x, z), blend: 1.2 });
    this.obst.push({ x, z, r });
  }
  free(x, z, r) { return this.obst.every((o) => Math.hypot(o.x - x, o.z - z) > o.r + r); }
  /** 在 min～max 半徑之間找一塊空地（找不到就回傳 null）。 */
  spot(min, max, r = 1, tries = 50) {
    for (let i = 0; i < tries; i++) {
      const a = this.r() * TAU, d = Math.sqrt(this.rand(min * min, max * max));
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (this.free(x, z, r) && this.usable(x, z, r, r > 1.2 ? 0.4 : 0.7)) { this.block(x, z, r); return [x, z]; }
    }
    return null;
  }
  scatter(n, min, max, r, fn) { for (let i = 0; i < n; i++) { const p = this.spot(min, max, r); if (p) fn(p[0], p[1], i); } }
  /** 會動的東西：mesh 放進場景，tick(t) 每一格呼叫。 */
  add(obj, tick) {
    // 會動的東西也站在地形上（每一格自己設定位置的，要在 tick 裡自己加 ground）
    if (!obj.userData.free && !this.noGround) obj.position.y += this.ground(obj.position.x, obj.position.z);
    this.live.add(obj); if (tick) this.ticks.push(tick); return obj;
  }
  mesh(geo, mat, x, y, z, sx = 1, sy = sx, sz = sx) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); return m; }

  // ----- 常用的小東西 -----
  tree(x, z, s = 1, leaf = this.pick(PALETTE.leaf)) {
    const p = this.at(x, z, this.rand(0, TAU), s);
    p(this.S.cyl6, PALETTE.trunk, 0, 0.9, 0, 0.22, 1.8, 0.22);
    p(this.S.lump, leaf, 0, 2.3, 0, 1.25, 1.05, 1.25);
    p(this.S.lump, new THREE.Color(leaf).offsetHSL(0, 0, 0.06).getHex(), 0.35, 2.9, 0.2, 0.85);
    p(this.S.lump, new THREE.Color(leaf).offsetHSL(0, 0, -0.04).getHex(), -0.45, 2.6, -0.25, 0.75);
    this.block(x, z, 1.1 * s);
  }
  pine(x, z, s = 1, color = 0x3fae6a, snow = false) {
    const p = this.at(x, z, this.rand(0, TAU), s);
    p(this.S.cyl6, PALETTE.trunk, 0, 0.5, 0, 0.2, 1, 0.2);
    [[1.3, 1.6, 1.2], [1.0, 1.4, 2.0], [0.7, 1.2, 2.7]].forEach(([w, h, y], i) => {
      p(this.S.cone6, color, 0, y, 0, w, h, w, i * 0.4);
      if (snow) p(this.S.cone6, 0xffffff, 0, y + h * 0.28, 0, w * 0.5, h * 0.45, w * 0.5, i * 0.4);
    });
    this.block(x, z, 1.0 * s);
  }
  palm(x, z, s = 1) {
    const ry = this.rand(0, TAU), p = this.at(x, z, ry, s);
    let px = 0, py = 0;
    for (let i = 0; i < 5; i++) { p(this.S.cyl6, 0xb88a5a, px, py + 0.4, 0, 0.17 - i * 0.015, 0.85, 0.17 - i * 0.015, 0, 0, -0.08 * i); px += 0.06 * i; py += 0.8; }
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * TAU;
      p(this.S.cone4, k % 2 ? 0x4cbf5a : 0x5fd06a, px + Math.cos(a) * 0.9, py + 0.1, Math.sin(a) * 0.9, 0.35, 2.0, 0.12, -a, 0, -(Math.PI / 2 - 0.35));
    }
    p(this.S.ball, 0x8a5a36, px + 0.2, py - 0.15, 0.15, 0.22);
    p(this.S.ball, 0x8a5a36, px - 0.15, py - 0.2, -0.1, 0.22);
    this.block(x, z, 0.9 * s);
  }
  acacia(x, z, s = 1) {
    const p = this.at(x, z, this.rand(0, TAU), s);
    p(this.S.cyl6, 0x8a6240, 0, 1.2, 0, 0.2, 2.4, 0.2, 0, 0, 0.15);
    p(this.S.cyl6, 0x8a6240, 0.4, 2.2, 0, 0.12, 1.2, 0.12, 0, 0, -0.7);
    p(this.S.cyl, 0x7bb04a, 0.1, 2.75, 0, 2.2, 0.45, 1.8);
    p(this.S.cyl, 0x8fc25a, 0.7, 3.05, 0.2, 1.3, 0.35, 1.1);
    this.block(x, z, 1.4 * s);
  }
  bush(x, z, s = 1, color = this.pick(PALETTE.leaf)) {
    const p = this.at(x, z, this.rand(0, TAU), s);
    p(this.S.lump, color, 0, 0.45, 0, 0.75, 0.6, 0.75);
    p(this.S.lump, new THREE.Color(color).offsetHSL(0, 0, 0.05).getHex(), 0.5, 0.35, 0.2, 0.5);
    p(this.S.lump, new THREE.Color(color).offsetHSL(0, 0, -0.03).getHex(), -0.4, 0.3, -0.2, 0.45);
    this.block(x, z, 0.8 * s);
  }
  flowers(x, z, n = 5, spread = 1, colors = PALETTE.flower) {
    for (let i = 0; i < n; i++) {
      const a = this.rand(0, TAU), d = this.rand(0, spread), fx = x + Math.cos(a) * d, fz = z + Math.sin(a) * d;
      this.part(this.S.cyl6, 0x4cae5a, fx, 0.25, fz, 0.04, 0.5, 0.04);
      this.part(this.S.ball, this.pick(colors), fx, 0.55, fz, 0.16);
    }
  }
  rock(x, z, s = 1, color = PALETTE.rock) {
    this.part(this.S.dodeca, color, x, 0.3 * s, z, s, 0.7 * s, s * 0.9, this.rand(0, TAU));
    this.block(x, z, 0.9 * s);
  }
  tuft(x, z, s = 1, color = 0x7cc85a) {
    for (let i = 0; i < 3; i++) this.part(this.S.cone4, color, x + (i - 1) * 0.18 * s, 0.35 * s, z + this.rand(-0.1, 0.1), 0.1 * s, 0.7 * s, 0.1 * s, this.rand(0, TAU), 0, (i - 1) * 0.3);
  }
  mushroom(x, z, s = 1, cap = 0xff6a6a) {
    const p = this.at(x, z, 0, s);
    p(this.S.cyl, 0xfff2dc, 0, 0.35, 0, 0.16, 0.7, 0.16);
    p(this.S.half, cap, 0, 0.65, 0, 0.5, 0.35, 0.5);
    [[0.2, 0.15], [-0.18, 0.05], [0.02, -0.25]].forEach(([dx, dz]) => p(this.S.ball, 0xffffff, dx, 0.85, dz, 0.07));
    this.block(x, z, 0.5 * s);
  }
  house(x, z, { w = 2.4, d = 2.2, h = 2, wall = this.pick(PALETTE.wall), roof = this.pick(PALETTE.roof), ry = this.rand(0, TAU), chimney = true } = {}) {
    const p = this.at(x, z, ry);
    p(this.S.box, wall, 0, h / 2, 0, w, h, d);
    p(this.S.cone4, roof, 0, h + 0.7, 0, w * 0.78, 1.4, d * 0.78, Math.PI / 4);
    p(this.S.box, 0x8a5a3a, 0, 0.55, d / 2 + 0.01, 0.6, 1.1, 0.06);
    p(this.S.box, 0x9fdcff, -w * 0.28, h * 0.6, d / 2 + 0.01, 0.5, 0.5, 0.06);
    p(this.S.box, 0x9fdcff, w * 0.28, h * 0.6, d / 2 + 0.01, 0.5, 0.5, 0.06);
    if (chimney) p(this.S.box, 0xd08a6a, w * 0.25, h + 1.1, -d * 0.15, 0.35, 0.8, 0.35);
    this.block(x, z, Math.max(w, d) * 0.75);
  }
  fenceArc(rad, a0, a1, color = 0xd8a874) {
    const n = Math.max(2, Math.round((Math.abs(a1 - a0) * rad) / 1.1));
    for (let i = 0; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      this.part(this.S.box, color, Math.cos(a) * rad, 0.45, Math.sin(a) * rad, 0.14, 0.9, 0.14);
      if (i < n) {
        const b = a0 + ((a1 - a0) * (i + 0.5)) / n, len = (Math.abs(a1 - a0) * rad) / n;
        this.part(this.S.box, color, Math.cos(b) * rad, 0.65, Math.sin(b) * rad, len, 0.1, 0.08, -b + Math.PI / 2);
        this.part(this.S.box, color, Math.cos(b) * rad, 0.35, Math.sin(b) * rad, len, 0.1, 0.08, -b + Math.PI / 2);
      }
    }
  }
  lamp(x, z, glow = 0xfff2b8) {
    this.part(this.S.cyl6, 0x5a6a8a, x, 1.2, z, 0.07, 2.4, 0.07);
    this.part(this.S.ball, glow, x, 2.5, z, 0.25);
    this.block(x, z, 0.3);
  }
  flag(x, z, color = 0xff8a6b, h = 3) {
    this.part(this.S.cyl6, 0xe8e8f0, x, h / 2, z, 0.06, h, 0.06);
    const f = this.mesh(this.S.box, M(color, { e: color, ei: 0.15 }), x + 0.5, h - 0.35, z, 1, 0.6, 0.04);
    this.add(f, (t) => { f.rotation.y = Math.sin(t * 2 + x) * 0.3; f.scale.x = 1 + Math.sin(t * 5 + z) * 0.08; });
    this.block(x, z, 0.3);
  }
  crystal(x, z, s = 1, color = 0xb98cff) {
    const ry = this.rand(0, TAU);
    this.part(this.S.octa, color, x, 0.9 * s, z, 0.45 * s, 1.1 * s, 0.45 * s, ry);
    this.part(this.S.octa, new THREE.Color(color).offsetHSL(0.03, 0, 0.08).getHex(), x + 0.45 * s, 0.5 * s, z + 0.2 * s, 0.25 * s, 0.6 * s, 0.25 * s, ry, 0, 0.4);
    this.part(this.S.octa, new THREE.Color(color).offsetHSL(-0.03, 0, -0.05).getHex(), x - 0.35 * s, 0.45 * s, z - 0.25 * s, 0.22 * s, 0.55 * s, 0.22 * s, ry, 0, -0.5);
    this.block(x, z, 0.8 * s);
  }
  cactus(x, z, s = 1) {
    const p = this.at(x, z, this.rand(0, TAU), s);
    p(this.S.capsule, 0x5cbf6a, 0, 1.4, 0, 0.7, 2.0, 0.7);
    p(this.S.capsule, 0x5cbf6a, 0.55, 1.6, 0, 0.42, 0.7, 0.42);
    p(this.S.capsule, 0x5cbf6a, 0.75, 2.05, 0, 0.36, 0.6, 0.36);
    p(this.S.capsule, 0x4cae5a, -0.5, 1.25, 0, 0.38, 0.5, 0.38);
    p(this.S.capsule, 0x4cae5a, -0.68, 1.6, 0, 0.32, 0.5, 0.32);
    p(this.S.ball, 0xff7aa8, 0, 2.65, 0, 0.16);
    this.block(x, z, 0.8 * s);
  }
  /** 平平的一塊水（會擋住居民走路）。 */
  pond(x, z, r, color = PALETTE.water, rim = 0xd8c8a8) {
    this.flat(x, z, r + 0.8, null, 1.4);
    this.part(this.S.disc, rim, x, 0.06, z, r + 0.35, 1, r + 0.35);
    const w = this.mesh(this.S.disc, M(color, { e: 0x2a8ac0, ei: 0.25, rough: 0.15, metal: 0.1, flat: false }), x, 0.12, z, r, 1, r);
    this.add(w);
    this.block(x, z, r + 0.3);
    return w;
  }
  plaza(r, color = 0xf6ead2) { this.flat(0, 0, r + 0.5, null, 1.5); this.part(this.S.disc, color, 0, 0.03, 0, r, 1, r); }
  // 瀑布：從島邊流下去，掉到雲裡變成水花
  waterfall(angle, width = 1.4, y = 0.1, stream = true) {
    const count = 120, R = this.R * 0.99;
    const geo = new THREE.BufferGeometry();
    const seed = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) seed.set([(this.r() - 0.5) * width, this.r(), 0.6 + this.r() * 0.6], i * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    geo.setAttribute('seed', new THREE.BufferAttribute(seed, 3));
    const mat = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 }, drop: { value: this.R * 1.1 } },
      vertexShader: /* glsl */ `attribute vec3 seed; uniform float time; uniform float drop; varying float vA;
        void main() {
          float f = fract(time * 0.3 * seed.z + seed.y);
          vec3 p = vec3(seed.x * (1.0 + f), -f * f * drop, f * 1.6);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = max(2.0, (2.5 + f * 5.0) * 300.0 / -mv.z);
          vA = (1.0 - f * f) * 0.85;
        }`,
      fragmentShader: /* glsl */ `varying float vA;
        void main() { float d = length(gl_PointCoord - 0.5); float a = (1.0 - smoothstep(0.2, 0.5, d)) * vA; gl_FragColor = vec4(mix(vec3(0.3, 0.68, 1.0), vec3(1.0), 0.3), a); }`,
      transparent: true, depthWrite: false,
    });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    pts.position.set(Math.cos(angle) * R, y, Math.sin(angle) * R);
    pts.rotation.y = -angle + Math.PI / 2;
    // 水流到邊邊的那一條小溪
    if (stream) this.part(this.S.box, PALETTE.water, Math.cos(angle) * R * 0.86, 0.05, Math.sin(angle) * R * 0.86, width + 0.4, 0.12, R * 0.3, -angle + Math.PI / 2);
    this.add(pts, (t) => { mat.uniforms.time.value = t; });
  }
  spin(obj, axis, speed) { this.add(obj, (t) => { obj.rotation[axis] = t * speed; }); return obj; }
}

// ---------- 浮空岩塊 ----------
const smooth01 = (t) => { const u = Math.max(0, Math.min(1, t)); return u * u * (3 - 2 * u); };
function wobble(seed) {
  const r = rng(seed);
  const k = [[2, r() * TAU, 0.05], [3, r() * TAU, 0.04], [5, r() * TAU, 0.025], [8, r() * TAU, 0.015]];
  return (a) => 1 + k.reduce((s, [n, ph, amp]) => s + Math.sin(a * n + ph) * amp, 0);
}
function shaped(geo, wob, jitter = 0, seed = 1) {
  const p = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const a = Math.atan2(v.z, v.x), k = wob(a);
    // 同一個位置一定得到同一個抖動，接縫才不會裂開
    const h = Math.sin(Math.round(v.x * 10) * 12.9898 + Math.round(v.y * 10) * 78.233 + Math.round(v.z * 10) * 37.719 + seed) * 43758.5453;
    const j = 1 + (h - Math.floor(h) - 0.5) * jitter;
    p.setXYZ(i, v.x * k * j, v.y, v.z * k * j);
  }
  geo.computeVertexNormals();
  return geo;
}
function baseRock(kit, biome) {
  const R = kit.R, wob = wobble(hash(kit.def.id));
  const parts = [];
  const piece = (geo, color, y) => { const m = new THREE.Mesh(geo, { color: new THREE.Color(color) }); m.userData.shared = true; m.userData.own = true; m.position.y = y; parts.push(m); };
  const [s1, s2, s3] = biome.soil;
  // 由上往下：草皮、邊緣、三層土，最下面是一個尖尖的岩錐
  piece(shaped(new THREE.CylinderGeometry(R, R * 0.98, 0.6, 40, 1, true), wob), biome.edge, -0.3); // 上面不封口：地形就是蓋子
  piece(shaped(new THREE.CylinderGeometry(R * 0.98, R * 0.93, 0.9, 40, 1), wob, 0.03, 2), biome.edge, -1.05);
  piece(shaped(new THREE.CylinderGeometry(R * 0.93, R * 0.72, R * 0.28, 32, 2), wob, 0.08, 3), s1, -1.5 - R * 0.14);
  piece(shaped(new THREE.CylinderGeometry(R * 0.72, R * 0.42, R * 0.3, 24, 2), wob, 0.12, 4), s2, -1.5 - R * 0.43);
  piece(shaped(new THREE.ConeGeometry(R * 0.42, R * 0.55, 18, 3).rotateX(Math.PI), wob, 0.18, 5), s3, -1.5 - R * 0.855);
  // 底下垂著幾塊小石頭
  for (let i = 0; i < 5; i++) {
    const a = kit.rand(0, TAU), d = kit.rand(0.3, 0.7) * R * 0.6;
    const m = new THREE.Mesh(kit.S.dodeca, { color: new THREE.Color(i % 2 ? s2 : s3) });
    m.userData.shared = true;
    m.position.set(Math.cos(a) * d, -1.5 - R * kit.rand(0.45, 0.8), Math.sin(a) * d);
    m.scale.setScalar(R * kit.rand(0.06, 0.1));
    parts.push(m);
  }
  // 邊上長一點小草
  for (let i = 0; i < Math.round(R * 1.6); i++) {
    const a = kit.rand(0, TAU), d = R * kit.rand(0.86, 0.95);
    kit.tuft(Math.cos(a) * d * wob(a), Math.sin(a) * d * wob(a), kit.rand(0.6, 1), new THREE.Color(biome.edge).offsetHSL(0, 0.05, -0.05).getHex());
  }
  return parts;
}
function cloudBase(kit) {
  const R = kit.R, parts = [];
  // 每一朵雲的頂端都在地面（y = 0）下面一點，只有邊邊的雲會冒上來一點點，像蓬蓬的圍牆
  const puff = (x, z, s, rise = 0, c = 0xffffff) => {
    const m = new THREE.Mesh(kit.S.blob, { color: new THREE.Color(c) }); m.userData.shared = true;
    m.position.set(x, -s * 0.6 + rise, z); m.scale.set(s, s * 0.6, s); parts.push(m);
  };
  puff(0, 0, R * 0.9, -0.3, 0xfbfdff);
  for (let i = 0; i < 18; i++) { const a = (i / 18) * TAU + kit.rand(-0.1, 0.1), d = R * kit.rand(0.8, 0.95), s = R * kit.rand(0.16, 0.24); puff(Math.cos(a) * d, Math.sin(a) * d, s, s * 0.25); }
  for (let i = 0; i < 10; i++) { const a = kit.rand(0, TAU), d = R * kit.rand(0.2, 0.7), s = R * kit.rand(0.3, 0.45); const m = new THREE.Mesh(kit.S.blob, { color: new THREE.Color(0xeef3ff) }); m.userData.shared = true; m.position.set(Math.cos(a) * d, -R * kit.rand(0.45, 0.75), Math.sin(a) * d); m.scale.set(s, s * 0.7, s); parts.push(m); }
  const top = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.92, R * 0.9, 0.5, 32, 1, true), { color: new THREE.Color(0xffffff) });
  top.userData.shared = true; top.userData.own = true;
  top.position.y = -0.25;
  parts.push(top);
  return parts;
}

// ---------- 地形：每種島自己的起伏（hraw），最後長成一片會跟著高度、坡度變色的地 ----------
const gauss = (x, z, cx, cz, r) => Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / (r * r));
function waves(seed) {
  const a = seed * 7.13, b = seed * 3.37;
  return (x, z, f = 0.2) => Math.sin(x * f + a) * Math.cos(z * f * 0.85 + b) + 0.5 * Math.sin((x - z) * f * 1.7 + a * 0.5);
}
const polar = (k, a, d) => [Math.cos(a) * k.R * d, Math.sin(a) * k.R * d];
function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(px - ax - dx * t, pz - az - dz * t);
}
// 每一個回傳「特別的顏色」（[顏色, 比例] 或 null）；要擋路的山用 obst.push（不要整平）
const TERRAIN = {
  studio(k) {
    const w = waves(1.1), h1 = polar(k, k.rand(0, TAU), 0.66), h2 = polar(k, k.rand(0, TAU), 0.62);
    k.hraw = (x, z) => 0.5 * w(x, z, 0.25) + 3.6 * gauss(x, z, ...h1, 3.8) + 2.8 * gauss(x, z, ...h2, 3.2);
    k.flat(0, 0, 6, 0); k.flat(-6, -3.5, 4.6, 0); k.flat(6, -4, 2.2, 0);
  },
  rainforest(k) {
    const w = waves(2.3), lake = [-3, 4], ang = Math.atan2(4, -3) + 0.15;
    const end = [Math.cos(ang) * k.R * 0.97, Math.sin(ang) * k.R * 0.97];
    const hA = polar(k, ang + 2.3, 0.5), hB = polar(k, ang - 2.4, 0.46);
    k.water = -0.35; k.lake = lake; k.riverEnd = end;
    k.hraw = (x, z) => {
      let h = 1.1 * w(x, z, 0.22) + 5.2 * gauss(x, z, ...hA, 4.4) + 4.2 * gauss(x, z, ...hB, 3.6) + 0.6;
      const r = segDist(x, z, ...lake, ...end);
      h -= (h + 1.0) * Math.exp(-(r * r) / 2.4); // 河谷
      return h - 1.6 * gauss(x, z, ...lake, 2.6); // 湖
    };
  },
  savanna(k) {
    const w = waves(3.7), A = polar(k, k.rand(0, TAU), 0.56), B = polar(k, k.rand(0, TAU), 0.6);
    k.hraw = (x, z) => 0.9 * w(x, z, 0.17) + 3.6 * Math.pow(gauss(x, z, ...A, 3.2), 0.8) + 2.6 * gauss(x, z, ...B, 2.6);
    k.kopjes = [A, B];
    k.flat(-5, -4, 3.4);
  },
  desert(k) {
    const th = k.rand(0, TAU), c = Math.cos(th), s = Math.sin(th), M = polar(k, Math.atan2(-5, -5) + Math.PI + k.rand(-0.6, 0.6), 0.56);
    k.hraw = (x, z) => {
      const u = x * c + z * s, v = -x * s + z * c;
      const dune = 1.8 * Math.pow(0.5 + 0.5 * Math.sin(u * 0.55 + 0.9 * Math.sin(v * 0.28)), 2.2);
      const mesa = 4.8 * (1 - smooth01((Math.hypot(x - M[0], z - M[1]) - 2.6) / 1.1));
      return Math.max(dune, mesa);
    };
    k.mesa = M;
    k.flat(-5, -5, 3.8, 0);
    k.obst.push({ x: M[0], z: M[1], r: 3.4 });
    return (x, z, y) => (Math.hypot(x - M[0], z - M[1]) < 4.2 && y > 0.8 ? [[0xd9805a, 0xf2b07e, 0xc86a4a][Math.floor(y * 1.4) % 3], 0.85] : null);
  },
  dino(k) {
    // 一座露出一層一層岩層的化石崖（像挖掘現場），旁邊再一個小丘
    const w = waves(4.4), A = polar(k, k.rand(0, TAU), 0.58), B = polar(k, k.rand(0, TAU), 0.6);
    k.hraw = (x, z) => 0.9 * w(x, z, 0.2) + 4.6 * Math.min(1, 1.6 * gauss(x, z, ...A, 3.6)) + 2.2 * gauss(x, z, ...B, 2.8) + 0.3;
    k.flat(-4, -3, 4.8, 0.3);
    k.cliff = A;
    k.obst.push({ x: A[0], z: A[1], r: 3.2 });
    return (x, z, y, slope) => (slope > 0.45 && y > 0.8 ? [[0xd9a066, 0xc07a4a, 0xe8c08a, 0xa86a44][Math.floor(y * 1.6) % 4], 0.9] : null);
  },
  stoneage(k) {
    // 一座大岩丘（洞穴就挖在它面向島中間的那一面），旁邊幾個小丘，低處一條小溪
    const w = waves(12.4), H = polar(k, k.rand(0, TAU), 0.6), B = polar(k, k.rand(0, TAU), 0.58);
    const brook = [polar(k, Math.atan2(H[1], H[0]) + 2.2, 0.95), polar(k, Math.atan2(H[1], H[0]) + 2.9, 0.2)];
    k.water = -0.3;
    k.hraw = (x, z) => {
      let h = 0.6 * w(x, z, 0.24) + 0.4 + 4.4 * Math.min(1, 1.5 * gauss(x, z, ...H, 3.4)) + 1.8 * gauss(x, z, ...B, 2.6);
      const r = segDist(x, z, ...brook[0], ...brook[1]);
      return h - (h + 0.9) * Math.exp(-(r * r) / 1.6);
    };
    k.hill = H;
    k.obst.push({ x: H[0], z: H[1], r: 3 });
    return (x, z, y, slope) => (slope > 0.6 && y > 1 ? [[0xa89078, 0x96806a, 0xb49c82][Math.floor(y * 1.3) % 3], 0.85] : null);
  },
  volcano(k) {
    const W = k.R * 0.55, H = k.R * 0.62, cr = W * 0.27, w = waves(5.2);
    const cone = (d) => H * Math.pow(Math.max(0, 1 - d / W), 1.1);
    const rim = cone(cr);
    k.hraw = (x, z) => {
      const d = Math.hypot(x, z);
      const h = d < cr ? rim - (cr - d) * 1.1 : cone(d);
      return h + 0.25 * w(x, z, 0.5) * Math.min(1, d / W) + 0.3;
    };
    k.cone = { W, H, cr, rim: rim + 0.3, floor: rim - cr * 1.1 + 0.3 };
    const flows = [0.4, 2.0, 3.7, 5.1];
    return (x, z) => {
      const d = Math.hypot(x, z);
      if (d < cr * 0.85) return [0xff7a2c, 0.9]; // 火山口裡的岩漿
      if (d < W * 0.98 && d > cr) {
        const a = Math.atan2(z, x);
        for (const f of flows) {
          const da = Math.abs(((a - f + Math.PI * 3) % TAU) - Math.PI), width = 0.1 + 0.05 * Math.sin(d * 2 + f);
          if (da < width) return [d < W * 0.6 ? 0xff8a3c : 0xffb067, 0.95 * (1 - da / width)];
        }
      }
      return null;
    };
  },
  ice(k) {
    const peaks = [[-5, -5, 6.5, 3.4], [-1.5, -7.5, 5, 2.6], [-7.8, -1.2, 4.4, 2.4], [-3.2, -9.4, 3.4, 2]];
    const w = waves(6.1);
    k.water = -0.3; k.waterColor = 0xcff0ff;
    k.hraw = (x, z) => {
      let h = 0.4 * w(x, z, 0.3) + 0.2;
      for (const [px, pz, ph, pr] of peaks) h = Math.max(h, ph * Math.exp(-Math.pow(Math.hypot(x - px, z - pz) / pr, 1.4)));
      return h - 1.3 * gauss(x, z, -2, 4.2, 2.6);
    };
    k.flat(4, -3, 2.8); k.flat(5, 4, 1.4);
    peaks.forEach(([px, pz, , pr]) => k.obst.push({ x: px, z: pz, r: pr }));
    k.obst.push({ x: -2, z: 4.2, r: 2.4 });
  },
  ocean(k) {
    const W = k.R * 0.8;
    const islets = [0, 1, 2].map((i) => [...polar(k, (i / 3) * TAU + k.rand(0, 1.5), k.rand(0.3, 0.52)), i === 0 ? 2.3 : 1.9]);
    k.islets = islets;
    k.hraw = (x, z) => {
      const d = Math.hypot(x, z);
      if (d > W) return 0;
      let h = -0.55 + 0.2 * Math.sin(x * 0.6) * Math.cos(z * 0.5);
      for (const [ix, iz, ih] of islets) h = Math.max(h, ih * gauss(x, z, ix, iz, 2.6) - 0.45);
      return h * smooth01((W - d) / 1.5);
    };
    islets.forEach(([ix, iz]) => k.obst.push({ x: ix, z: iz, r: 1.6 }));
    return (x, z, y) => (Math.hypot(x, z) > W - 0.3 ? null : y > 0.95 ? [0x7cc85a, 0.8] : y < 0.4 ? [0xa8e6dc, 0.55] : [0xf6dca4, 0.7]);
  },
  wetland(k) {
    const w = waves(7.3), P = [polar(k, k.rand(0, TAU), 0.62), polar(k, k.rand(0, TAU), 0.6)];
    k.water = -0.2; k.ponds = P;
    k.hraw = (x, z) => 0.5 * w(x, z, 0.32) + 0.3 - P.reduce((acc, [px, pz]) => acc + 1.3 * gauss(x, z, px, pz, 1.9), 0);
  },
  zoo(k) {
    const w = waves(8.2);
    k.hraw = (x, z) => (0.5 + 2.6 * Math.max(0, w(x, z, 0.22))) * smooth01((Math.hypot(x, z) - k.R * 0.42) / (k.R * 0.25));
  },
  sky(k) {
    const puffs = Array.from({ length: 9 }, () => [...polar(k, k.rand(0, TAU), Math.sqrt(k.r()) * 0.75), k.rand(0.6, 1.5), k.rand(1.8, 3.2)]);
    k.hraw = (x, z) => puffs.reduce((m, [px, pz, ph, pr]) => Math.max(m, ph * Math.pow(Math.max(0, 1 - ((x - px) ** 2 + (z - pz) ** 2) / (pr * pr)), 0.6)), 0);
    k.outline = () => k.R * 0.92;
    return (x, z, y) => [y > 0.3 ? 0xffffff : 0xe6efff, 0.9];
  },
  body(k) {
    const mounds = Array.from({ length: 6 }, () => [...polar(k, k.rand(0, TAU), k.rand(0.3, 0.7)), k.rand(0.8, 1.8), k.rand(2, 3.4)]);
    k.hraw = (x, z) => mounds.reduce((acc, [px, pz, ph, pr]) => acc + ph * gauss(x, z, px, pz, pr), 0);
    k.flat(0, -4, 1.8, 0);
    return (x, z, y) => [0xff8fb2, Math.min(0.55, y * 0.3)];
  },
  atom(k) {
    const steps = 4, top = k.R * 0.85;
    k.hraw = (x, z) => {
      const t = Math.max(0, 1 - Math.hypot(x, z) / top), lv = Math.min(steps - 1, Math.floor(t * steps));
      return (lv + smooth01((t * steps - lv - 0.82) / 0.18)) * 0.75;
    };
    return (x, z, y) => [[0xdcefff, 0xf2f6ff, 0xdcd2ff, 0xcfeaff][Math.round(y / 0.75) % 4], 0.85];
  },
  force(k) {
    const w = waves(9.1), Hh = polar(k, k.rand(0, TAU), 0.56);
    k.hraw = (x, z) => 0.4 * w(x, z, 0.25) + 4.6 * gauss(x, z, ...Hh, 4.2);
    k.obst.push({ x: Hh[0], z: Hh[1], r: 3 });
  },
  lightning(k) {
    const th = k.rand(0, TAU), c = Math.cos(th), s = Math.sin(th);
    k.hraw = (x, z) => { const u = x * c + z * s, v = -x * s + z * c; return 3.4 * Math.pow(Math.max(0, Math.sin(u * 0.6 + Math.sin(v * 0.35) * 1.2)), 4) * (0.6 + 0.4 * Math.sin(v * 0.5 + 1)); };
    return (x, z, y) => (y > 0.8 ? [0xfff2a8, Math.min(0.7, (y - 0.8) * 0.45)] : null);
  },
  scientists(k) {
    const w = waves(10.3);
    k.hraw = (x, z) => 0.35 * w(x, z, 0.3) + 2.6 * gauss(x, z, 0, 0, 5.5);
  },
  city(k) {
    const RR = k.R * 0.62, P = polar(k, k.rand(0, TAU), 0.84);
    k.hraw = (x, z) => 3.2 * gauss(x, z, ...P, 3) * smooth01((Math.hypot(x, z) - RR - 1.2) / 1.5);
    k.park = P;
  },
  flight(k) {
    const ra = k.rand(0, Math.PI), w = waves(11.2);
    k.ra = ra;
    k.hraw = (x, z) => 2.6 * Math.max(0, w(x, z, 0.2) + 0.4) * smooth01((Math.abs(x * Math.cos(ra) - z * Math.sin(ra)) - 3.4) / 2.5);
  },
  moon(k) {
    const craters = Array.from({ length: 8 }, () => [...polar(k, k.rand(0, TAU), Math.sqrt(k.r()) * 0.78), k.rand(1.2, 3.4)]);
    k.hraw = (x, z) => {
      let h = 0.12 * Math.sin(x * 1.3) * Math.cos(z * 1.1) + 0.3;
      for (const [cx, cz, r] of craters) {
        const d = Math.hypot(x - cx, z - cz) / r;
        if (d < 1.7) h += (-0.8 * Math.max(0, 1 - d * d) + 0.45 * Math.exp(-(((d - 1) / 0.28) ** 2))) * (r / 3);
      }
      return h;
    };
    return (x, z, y) => (y < 0.15 ? [0xb4b9ca, 0.6] : null);
  },
  planets(k) {
    k.hraw = (x, z) => { const d = Math.hypot(x, z); return 1.6 * smooth01((d - k.R * 0.5) / (k.R * 0.18)) + 0.25 * Math.sin(d * 2.2); };
    k.flat(0, 0, k.R * 0.46, 0, 1);
  },
  stars(k) {
    const spikes = Array.from({ length: 6 }, () => [...polar(k, k.rand(0, TAU), k.rand(0.48, 0.8)), k.rand(2.8, 5.2), k.rand(1.3, 2.2)]);
    k.hraw = (x, z) => spikes.reduce((m, [px, pz, ph, pr]) => Math.max(m, ph * Math.pow(Math.max(0, 1 - Math.hypot(x - px, z - pz) / pr), 1.3)), 0.15 * Math.sin(x) * Math.sin(z) + 0.15);
    k.flat(-4, -3, 3.6, 0); k.flat(k.R * 0.45, k.R * 0.35, 1.2);
    spikes.forEach(([px, pz, , pr]) => k.obst.push({ x: px, z: pz, r: pr * 0.85 }));
    return (x, z, y) => (y > 1.2 ? [0xf6e6ff, Math.min(0.85, (y - 1.2) / 2.5)] : null);
  },
};
function terrainColor(k, biome, x, z, y, slope, special) {
  const c = new THREE.Color(biome.ground);
  const n = Math.sin(x * 0.7 + z * 0.3) * Math.sin(z * 0.6 - x * 0.2);
  c.offsetHSL(n * 0.012, 0, n * 0.035 + Math.max(-0.08, Math.min(0.06, y * 0.012)));
  if (k.water != null && y < k.water + 0.25) c.lerp(new THREE.Color(biome.shore ?? 0xe8d8a8), smooth01((k.water + 0.25 - y) / 0.35));
  if (slope > 0.75) c.lerp(new THREE.Color(biome.cliff ?? biome.edge), smooth01((slope - 0.75) / 0.6) * 0.85);
  if (biome.peak != null && y > biome.peakY) c.lerp(new THREE.Color(biome.peak), smooth01((y - biome.peakY) / 1.2));
  const sp = special?.(x, z, y, slope);
  if (sp) c.lerp(new THREE.Color(sp[0]), sp[1]);
  return c;
}
/** 地形網格：從島心一圈一圈往外，最外圈跟岩塊的邊緣對齊（高度 0）。 */
function terrainMesh(k, biome, special) {
  const R = k.R, N = Math.max(14, Math.min(28, Math.round(R * 1.25))), Mseg = 60;
  const outline = k.outline || ((a) => R * k.wob(a));
  const pos = [], col = [], idx = [];
  const vert = (x, z, edge) => {
    const y = edge ? 0 : k.ground(x, z);
    pos.push(x, y, z);
    const c = terrainColor(k, biome, x, z, y, edge ? 0 : k.slope(x, z, 0.7), special);
    col.push(c.r, c.g, c.b);
  };
  vert(0, 0, false);
  for (let i = 1; i <= N; i++) for (let j = 0; j < Mseg; j++) { const a = (j / Mseg) * TAU, rr = (i / N) * outline(a); vert(Math.cos(a) * rr, Math.sin(a) * rr, i === N); }
  for (let j = 0; j < Mseg; j++) idx.push(0, 1 + ((j + 1) % Mseg), 1 + j);
  for (let i = 1; i < N; i++) for (let j = 0; j < Mseg; j++) {
    const a = 1 + (i - 1) * Mseg + j, b = 1 + (i - 1) * Mseg + ((j + 1) % Mseg), c = 1 + i * Mseg + j, d = 1 + i * Mseg + ((j + 1) % Mseg);
    idx.push(a, b, c, b, d, c);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  const m = new THREE.Mesh(geo, { color: new THREE.Color(0xffffff) });
  m.userData.shared = true; m.userData.own = true;
  return m;
}

// ---------- 各種島 ----------
const BUILD = {
  studio(k) {
    k.plaza(5.5);
    // 錄音室：圓圓的房子，屋頂戴著一副大耳機
    const p = k.at(-6, -3.5, 0.5);
    p(k.S.cyl, 0xfff3dc, 0, 1.7, 0, 3.4, 3.4, 3.4);
    p(k.S.half, 0xff9f6b, 0, 3.4, 0, 3.6, 1.6, 3.6);
    p(k.S.box, 0x8a5a3a, 0, 0.8, 3.38, 1, 1.6, 0.1);
    [-1.2, 1.2].forEach((dx) => p(k.S.cyl, 0x9fdcff, dx * 1.6, 2.1, 2.9, 0.45, 0.1, 0.45, 0, Math.PI / 2));
    p(k.S.arch, 0xff8a5c, 0, 5.0, 0, 2.6, 2.6, 2.4);
    [-1, 1].forEach((sd) => { p(k.S.cyl, 0x4a5f8a, sd * 2.6, 4.9, 0, 0.9, 0.7, 0.9, 0, 0, Math.PI / 2); p(k.S.torus, 0xa8e0d6, sd * 3.0, 4.9, 0, 0.6, 0.6, 0.6, Math.PI / 2); });
    k.block(-6, -3.5, 4);
    const onAir = k.mesh(k.S.box, M(0xff5c5c, { e: 0xff3030, ei: 0.9 }), -6 + Math.sin(0.5) * 3.45, 2.95, -3.5 + Math.cos(0.5) * 3.45, 1.6, 0.5, 0.1);
    onAir.rotation.y = 0.5;
    k.add(onAir, (t) => { onAir.material.emissiveIntensity = 0.5 + 0.5 * (Math.sin(t * 3) > 0 ? 1 : 0.3); });
    // 超大麥克風塔
    const m = k.at(6, -4, 0);
    m(k.S.cyl, 0xb8c2d6, 0, 0.2, 0, 1.4, 0.4, 1.4);
    m(k.S.cyl6, 0x8a96b0, 0, 3, 0, 0.18, 5.6, 0.18);
    m(k.S.capsule, 0xdfe6f2, 0, 6.6, 0, 1.7, 1.6, 1.7);
    m(k.S.torus, 0xffc25a, 0, 6.2, 0, 0.92, 0.92, 0.92, 0, Math.PI / 2);
    k.block(6, -4, 1.6);
    k.flowers(-2.5, 2.5, 6, 1.4); k.flowers(3, 3, 6, 1.4);
    [[-9, 4], [9, 3], [-3, -9], [3, -10], [10, -1]].forEach(([x, z]) => { if (k.free(x, z, 1.2)) k.tree(x, z, k.rand(0.9, 1.2)); });
    k.scatter(5, 7, 12, 1, (x, z) => k.bush(x, z, k.rand(0.7, 1)));
    [[-4, 5.5], [4, 5.5], [-5.5, 1], [5.5, 1]].forEach(([x, z]) => k.lamp(x, z));
    k.flag(-1.5, -7, 0xff8a6b); k.flag(1.5, -7, 0x6cb8ff);
  },
  rainforest(k) {
    k.waterfall(Math.atan2(4, -3) + 0.15, 1.6);
    for (let i = 0; i < 9; i++) { const p = k.spot(2, k.R * 0.85, 1.6); if (!p) break; const big = k.r() < 0.45; if (big) { k.tree(p[0], p[1], k.rand(1.4, 1.9), k.pick([0x3fae55, 0x2f9a4a, 0x4cbf5a])); } else k.palm(p[0], p[1], k.rand(1, 1.4)); }
    k.scatter(8, 2, k.R * 0.9, 0.8, (x, z) => k.bush(x, z, k.rand(0.8, 1.2), k.pick([0x3fae55, 0x5fcf6a])));
    k.scatter(6, 2, k.R * 0.9, 0.5, (x, z) => k.mushroom(x, z, k.rand(0.7, 1.1), k.pick([0xff6a6a, 0xffa84a, 0xb98cff])));
    k.scatter(5, 2, k.R * 0.9, 0.5, (x, z) => k.flowers(x, z, 4, 0.6, [0xff5c8a, 0xff8a3c, 0xffd25a]));
    // 島邊垂下來的藤蔓
    for (let i = 0; i < 14; i++) { const a = k.rand(0, TAU), d = k.R * 0.97, len = k.rand(1.5, 4); k.part(k.S.cyl6, 0x4cae5a, Math.cos(a) * d, -len / 2 - 0.6, Math.sin(a) * d, 0.06, len, 0.06); k.part(k.S.lump, 0x5fcf6a, Math.cos(a) * d, -len - 0.6, Math.sin(a) * d, 0.25); }
    birds(k, [0xff5c5c, 0xffd25a, 0x5cb8ff, 0x5fd06a], 7);
  },
  savanna(k) {
    k.pond(4, 3, 2.2, 0x6cc8e8, 0xc8a06a);
    // 榮耀石：一塊疊一塊的大石頭
    const p = k.at(-5, -4, 0.6);
    p(k.S.dodeca, 0xd8a878, 0, 1.2, 0, 2.6, 1.6, 2.2);
    p(k.S.box, 0xe4b888, 1.2, 2.5, 0, 3.6, 0.6, 1.6, 0, 0, 0.12);
    k.block(-5, -4, 2.8);
    k.scatter(5, 3, k.R * 0.85, 1.6, (x, z) => k.acacia(x, z, k.rand(1, 1.4)));
    // 白蟻丘和猴麵包樹
    k.scatter(3, 3, k.R * 0.85, 0.8, (x, z) => { k.part(k.S.cone6, 0xc8865a, x, 1.1, z, 0.8, 2.2, 0.8); k.part(k.S.cone6, 0xb87a50, x + 0.5, 0.6, z, 0.4, 1.2, 0.4); });
    const b = k.spot(3, k.R * 0.8, 1.6);
    if (b) { const q = k.at(b[0], b[1], 0); q(k.S.cyl, 0xa8825a, 0, 1.4, 0, 0.9, 2.8, 0.9); q(k.S.lump, 0x8fc25a, 0, 3.4, 0, 1.6, 0.8, 1.6); }
    for (let i = 0; i < 26; i++) { const a = k.rand(0, TAU), d = k.rand(2, k.R * 0.9); if (k.free(Math.cos(a) * d, Math.sin(a) * d, 0.2)) k.tuft(Math.cos(a) * d, Math.sin(a) * d, k.rand(1, 1.6), k.pick([0xe0b850, 0xd8a840, 0xc8c060])); }
    k.scatter(4, 2, k.R * 0.85, 0.7, (x, z) => k.rock(x, z, k.rand(0.5, 0.9), 0xd8b890));
  },
  desert(k) {
    // 金字塔
    const p = k.at(-5, -5, 0.4);
    p(k.S.cone4, 0xf0c070, 0, 2.2, 0, 3.6, 4.4, 3.6, Math.PI / 4);
    p(k.S.box, 0x8a6a4a, 0, 0.6, 2.4, 0.7, 1.2, 0.2);
    k.block(-5, -5, 3.4);
    // 綠洲
    k.pond(4, 4, 1.8);
    k.palm(5.8, 3.2, 1.2); k.palm(2.4, 5.4, 1);
    k.scatter(7, 2, k.R * 0.85, 0.9, (x, z) => k.cactus(x, z, k.rand(0.8, 1.3)));
    k.scatter(4, 2, k.R * 0.85, 0.7, (x, z) => k.rock(x, z, k.rand(0.5, 1), 0xe0a070));
    // 滾來滾去的風滾草
    const weed = k.mesh(k.S.blob, M(0xc8a060, { opacity: 0.9 }), 0, 0.5, 0, 0.5);
    k.add(weed, (t) => { const a = t * 0.25, x = Math.cos(a) * k.R * 0.6, z = Math.sin(a) * k.R * 0.6; weed.position.set(x, k.ground(x, z) + 0.5 + Math.abs(Math.sin(t * 3)) * 0.4, z); weed.rotation.z = -t * 3; });
  },
  dino(k) {
    // 長脖子恐龍雕像（島上的地標）
    const p = k.at(-4, -3, 0.8, 1.3);
    p(k.S.ball, 0x8ad46e, 0, 2.2, 0, 1.9, 1.4, 1.3);
    p(k.S.capsule, 0x8ad46e, 1.4, 4.0, 0, 0.7, 2.6, 0.7, 0, 0, -0.45);
    p(k.S.ball, 0x8ad46e, 2.3, 5.6, 0, 0.6, 0.5, 0.5);
    p(k.S.ball, 0x222233, 2.55, 5.75, 0.3, 0.09); p(k.S.ball, 0x222233, 2.55, 5.75, -0.3, 0.09);
    p(k.S.cone, 0x8ad46e, -2.4, 2.0, 0, 0.55, 2.6, 0.55, 0, 0, Math.PI / 2 + 0.25);
    [[-0.9, 0.7], [0.9, 0.7], [-0.9, -0.7], [0.9, -0.7]].forEach(([dx, dz]) => p(k.S.cyl, 0x78c060, dx, 0.8, dz, 0.35, 1.6, 0.35));
    [[0, 3.4], [-0.8, 3.3], [0.8, 3.3]].forEach(([dx, y]) => p(k.S.cone4, 0xffc25a, dx, y, 0, 0.25, 0.5, 0.25));
    k.block(-4, -3, 3.6);
    // 恐龍蛋巢
    const n = k.spot(3, k.R * 0.7, 1.4);
    if (n) { k.part(k.S.torus, 0xc8a070, n[0], 0.2, n[1], 1.1, 1.1, 1.1, 0, Math.PI / 2); [[0, 0], [0.45, 0.3], [-0.4, 0.3], [0, -0.5]].forEach(([dx, dz], i) => k.part(k.S.ball, i % 2 ? 0xfff2dc : 0xe6f4ff, n[0] + dx, 0.45, n[1] + dz, 0.35, 0.48, 0.35)); }
    // 小火山
    const v = k.spot(4, k.R * 0.8, 2.4);
    if (v) { k.part(k.S.cone, 0xb98a6a, v[0], 1.4, v[1], 2.2, 2.8, 2.2); const lava = k.mesh(k.S.disc, M(0xff8a3c, { e: 0xff6a20, ei: 1 }), v[0], 2.75, v[1], 0.6, 1, 0.6); k.add(lava); smoke(k, v[0], 3, v[1], 0.8); }
    // 化石挖掘場
    const f = k.spot(3, k.R * 0.8, 1.8);
    if (f) { k.part(k.S.disc, 0xf0d6a0, f[0], 0.05, f[1], 1.7, 1, 1.7); [[-0.6, 0], [0, 0], [0.6, 0]].forEach(([dx]) => k.part(k.S.capsule, 0xfffaf0, f[0] + dx, 0.2, f[1], 0.18, 0.8, 0.18, 0, Math.PI / 2)); k.part(k.S.capsule, 0xfffaf0, f[0], 0.2, f[1], 0.2, 1.8, 0.2, Math.PI / 2, Math.PI / 2); }
    k.scatter(6, 2, k.R * 0.88, 1.2, (x, z) => k.palm(x, z, k.rand(0.9, 1.3)));
    // 蕨類
    k.scatter(8, 2, k.R * 0.9, 0.7, (x, z) => { for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU; k.part(k.S.cone4, 0x4cae5a, x + Math.cos(a) * 0.4, 0.4, z + Math.sin(a) * 0.4, 0.2, 1.2, 0.08, -a, 0, -(Math.PI / 2 - 0.6)); } });
  },
  stoneage(k) {
    // 洞穴：在大岩丘面向島中間的那一面，黑黑的洞口、洞口兩邊有壁畫
    const [hx, hz] = k.hill, toC = Math.atan2(-hz, -hx), d = 2.6, cx = hx + Math.cos(toC) * d, cz = hz + Math.sin(toC) * d;
    const face = -toC + Math.PI / 2;
    k.flat(cx + Math.cos(toC) * 1.2, cz + Math.sin(toC) * 1.2, 1.8);
    const p = k.at(cx, cz, face);
    p(k.S.half, 0x2c2430, 0, 0, 0.1, 1.7, 2.2, 0.6, 0, -Math.PI / 2);
    p(k.S.arch, 0x8a7462, 0, 0, 0.35, 1.8, 2.3, 2.5);
    for (let i = 0; i < 5; i++) p(k.S.dodeca, k.pick([0x9a8270, 0xa89078, 0x8a7462]), k.rand(-2.6, 2.6), k.rand(0.3, 2.6), k.rand(-0.4, 0.4), k.rand(0.6, 1.1));
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.4), new THREE.MeshBasicMaterial({ map: caveArtTexture(), transparent: true }));
    wall.position.set(cx + Math.cos(face) * 2.9 + Math.cos(toC) * 0.6, 1.5, cz - Math.sin(face) * 2.9 + Math.sin(toC) * 0.6);
    wall.rotation.y = face; k.add(wall);
    k.part(k.S.box, 0xa89078, cx + Math.cos(face) * 2.9, 1.3, cz - Math.sin(face) * 2.9, 3, 2.6, 0.6, face);
    k.block(cx, cz, 2.2, false);
    // 營火和圍坐的石頭
    const f = k.spot(3, k.R * 0.6, 1.8);
    if (f) { campfire(k, f[0], f[1]); smoke(k, f[0], 1.6, f[1], 0.7); for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU + 0.4; k.part(k.S.box, 0x9a8270, f[0] + Math.cos(a) * 1.8, 0.25, f[1] + Math.sin(a) * 1.8, 0.9, 0.5, 0.5, -a); } }
    // 長毛象
    const m = k.spot(3, k.R * 0.8, 2.4);
    if (m) {
      const q = k.at(m[0], m[1], k.rand(0, TAU), 1.15), fur = 0x8a5a3a;
      q(k.S.ball, fur, 0, 2.3, 0, 1.9, 1.5, 1.2);
      q(k.S.ball, fur, 1.7, 2.9, 0, 0.9);
      q(k.S.ball, 0x7a4e30, 1.8, 3.6, 0, 0.55, 0.4, 0.5);
      q(k.S.capsule, fur, 2.5, 1.9, 0, 0.3, 1.6, 0.3, 0, 0, 0.25);
      [0.32, -0.32].forEach((z) => q(new THREE.TorusGeometry(0.8, 0.09, 6, 16, Math.PI * 0.9), 0xfff6e6, 2.3, 2.2, z, 1, 1, 1, 0, 0, Math.PI * 0.9));
      [[-1, 0.6], [-1, -0.6], [1, 0.6], [1, -0.6]].forEach(([x, z]) => q(k.S.cyl, fur, x, 0.8, z, 0.38, 1.6, 0.38));
      q(k.S.ball, 0x222233, 2.35, 3.05, 0.55, 0.08); q(k.S.ball, 0x222233, 2.35, 3.05, -0.55, 0.08);
      q(k.S.cone, fur, -1.95, 2.3, 0, 0.12, 0.8, 0.12, 0, 0, Math.PI / 2 + 0.5);
    }
    // 長毛象骨頭搭的小屋
    k.scatter(2, 3, k.R * 0.8, 1.6, (x, z) => {
      const q = k.at(x, z, k.rand(0, TAU));
      q(k.S.cone, 0xc8a070, 0, 1.2, 0, 1.4, 2.4, 1.4);
      for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; q(k.S.capsule, 0xfff6e6, Math.cos(a) * 1.0, 1.1, Math.sin(a) * 1.0, 0.12, 2.2, 0.12, -a, 0, 0.45 * (i % 2 ? 1 : -1)); }
      q(k.S.half, 0x3a2c28, 0, 0, 1.3, 0.5, 0.9, 0.2, 0, -Math.PI / 2);
    });
    // 巨石陣
    const st = k.spot(4, k.R * 0.82, 2.6);
    if (st) {
      const q = k.at(st[0], st[1], k.rand(0, TAU));
      for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU, x = Math.cos(a) * 1.9, z = Math.sin(a) * 1.9; q(k.S.box, 0xb8b4ac, x, 1.2, z, 0.6, 2.4, 0.4, -a + Math.PI / 2); if (i % 2 === 0) q(k.S.box, 0xaaa69e, Math.cos(a + 0.52) * 1.75, 2.55, Math.sin(a + 0.52) * 1.75, 1.9, 0.35, 0.4, -(a + 0.52) + Math.PI / 2); }
    }
    // 石器、骨頭、青銅器
    k.scatter(5, 2, k.R * 0.85, 0.5, (x, z) => { k.part(k.S.octa, 0x7a7a8a, x, 0.2, z, 0.3, 0.12, 0.45, k.rand(0, TAU)); k.part(k.S.cyl6, 0x9a6a46, x + 0.4, 0.06, z, 0.05, 0.9, 0.05, k.rand(0, TAU), Math.PI / 2); });
    const bz = k.spot(3, k.R * 0.8, 0.9);
    if (bz) { k.part(k.S.ball, 0xc8963c, bz[0], 0.55, bz[1], 0.55, 0.5, 0.55); k.part(k.S.cyl, 0xc8963c, bz[0], 1.0, bz[1], 0.3, 0.35, 0.3); k.part(k.S.torus, 0xb07a2c, bz[0], 1.15, bz[1], 0.35, 0.35, 0.5, 0, Math.PI / 2); }
    k.scatter(6, 2, k.R * 0.9, 1.1, (x, z) => k.pine(x, z, k.rand(0.8, 1.1), 0x5a9e5a));
  },
  volcano(k) {
    // 火山本身是地形（TERRAIN.volcano）：這裡放火山口裡的岩漿和冒出來的煙
    const { W, cr, rim, floor } = k.cone;
    const lava = k.mesh(k.S.disc, M(0xff8a3c, { e: 0xff6a1c, ei: 1.1 }), 0, floor + 0.4, 0, cr * 0.95, 1, cr * 0.95);
    lava.userData.free = true;
    k.add(lava, (t) => { lava.material.emissiveIntensity = 0.9 + Math.sin(t * 2) * 0.25; });
    const glow = glowSprite(0xff9a4a, cr * 5, 0.9); glow.position.set(0, rim + 0.5, 0); glow.userData.free = true; k.add(glow);
    k.block(0, 0, W * 1.05, false);
    smoke(k, 0, rim + 0.3, 0, 1.6, true);
    k.scatter(6, W * 1.3, k.R * 0.88, 1, (x, z) => k.crystal(x, z, k.rand(0.7, 1.1), k.pick([0xb98cff, 0x7cc8ff, 0xff8ab8, 0xffd25a])));
    k.scatter(6, W * 1.3, k.R * 0.9, 0.8, (x, z) => k.rock(x, z, k.rand(0.6, 1.1), k.pick([0xb8a090, 0xa89080, 0xd0b8a0])));
    // 地震觀測站
    const s = k.spot(W * 1.4, k.R * 0.8, 1.6);
    if (s) { k.house(s[0], s[1], { w: 2, d: 1.8, h: 1.6, wall: 0xe6f4ff, roof: 0x6cb8ff, chimney: false }); k.part(k.S.cyl6, 0xd0d6e2, s[0], 3.2, s[1], 0.05, 2.4, 0.05); k.part(k.S.ball, 0xff5c5c, s[0], 4.4, s[1], 0.15); }
    k.scatter(4, W * 1.3, k.R * 0.9, 1, (x, z) => k.pine(x, z, k.rand(0.7, 1), 0x5fb870));
  },
  ice(k) {
    // 冰屋
    const p = k.at(4, -3, -0.8);
    p(k.S.half, 0xffffff, 0, 0, 0, 2, 1.8, 2);
    p(k.S.arch, 0xe6f4ff, 0, 0, 1.9, 0.7, 0.9, 1.2);
    for (let i = 1; i < 4; i++) p(k.S.thin, 0xd6ecfa, 0, i * 0.42, 0, Math.cos(Math.asin(i * 0.21)) * 2.02, Math.cos(Math.asin(i * 0.21)) * 2.02, 4, 0, Math.PI / 2);
    k.block(4, -3, 2.3);
    // 雪人
    const s = k.at(5, 4, -2.2);
    s(k.S.ball, 0xffffff, 0, 0.8, 0, 0.9); s(k.S.ball, 0xffffff, 0, 1.9, 0, 0.65); s(k.S.ball, 0xffffff, 0, 2.75, 0, 0.45);
    s(k.S.cone, 0xff8a3c, 0, 2.75, 0.5, 0.1, 0.5, 0.1, 0, Math.PI / 2); s(k.S.ball, 0x333344, 0.15, 2.9, 0.38, 0.06); s(k.S.ball, 0x333344, -0.15, 2.9, 0.38, 0.06);
    s(k.S.cyl, 0x5c6aa0, 0, 3.25, 0, 0.35, 0.5, 0.35); s(k.S.cyl, 0x5c6aa0, 0, 3.02, 0, 0.55, 0.06, 0.55);
    s(k.S.torus, 0xff5c5c, 0, 2.35, 0, 0.45, 0.45, 0.6, 0, Math.PI / 2);
    k.block(5, 4, 1);
    k.scatter(8, 2, k.R * 0.88, 0.8, (x, z) => k.part(k.S.cone6, k.pick([0xbfe9ff, 0xd6f2ff, 0x9fd8f8]), x, 0.9, z, 0.4, k.rand(1.2, 2.4), 0.4, k.rand(0, 1), k.rand(-0.15, 0.15), k.rand(-0.15, 0.15)));
    k.scatter(6, 2, k.R * 0.9, 1, (x, z) => k.pine(x, z, k.rand(0.8, 1.1), 0x4cae7a, true));
    snow(k);
  },
  ocean(k) {
    // 整座島是一個大潟湖：居民在水上游泳
    const W = k.R * 0.8, WY = 0.7;
    // 沙岸圍起來，裡面是潟湖
    k.noGround = true;
    k.part(new THREE.LatheGeometry([[W - 0.3, 0], [W + 0.1, 0.8], [W + 0.7, 0.95], [k.R * 0.97, 0.35], [k.R * 0.98, 0]].map(([x, y]) => new THREE.Vector2(x, y)), 56), 0xf6dca4, 0, 0, 0, 1, 1, 1);
    k.noGround = false;
    const water = new THREE.Mesh(new THREE.CircleGeometry(W + 0.15, 56).rotateX(-Math.PI / 2), lagoonMaterial());
    water.position.y = WY; water.userData.free = true;
    k.add(water, (t) => { water.material.uniforms.time.value = t; });
    k.walkR = W * 0.86; k.walkY = WY; k.swim = true;
    // 水下的珊瑚和海星（水是半透明的，看得到）
    for (let i = 0; i < 18; i++) { const a = k.rand(0, TAU), d = k.rand(0.15, 0.92) * W; k.part(k.S.knot, k.pick([0xff7aa8, 0xffb15a, 0xb98cff, 0x5fdcc0]), Math.cos(a) * d, 0.3, Math.sin(a) * d, k.rand(0.5, 0.8), k.rand(0.4, 0.7), k.rand(0.5, 0.8), k.rand(0, TAU)); }
    for (let i = 0; i < 8; i++) { const a = k.rand(0, TAU), d = k.rand(0.2, 0.9) * W; k.part(k.S.cone4, 0xffa84a, Math.cos(a) * d, 0.12, Math.sin(a) * d, 0.35, 0.1, 0.35, k.rand(0, TAU)); }
    // 燈塔
    const la = k.rand(0, TAU), lx = Math.cos(la) * (W + 0.9), lz = Math.sin(la) * (W + 0.9);
    [[0, 0xffffff], [1, 0xff5c5c], [2, 0xffffff], [3, 0xff5c5c]].forEach(([i, c]) => k.part(k.S.cyl, c, lx, 0.6 + i * 1.2, lz, 0.75 - i * 0.08, 1.2, 0.75 - i * 0.08));
    k.part(k.S.cyl, 0x9fdcff, lx, 5.4, lz, 0.5, 0.8, 0.5); k.part(k.S.cone, 0xff5c5c, lx, 6.2, lz, 0.6, 0.8, 0.6);
    const beam = k.mesh(new THREE.ConeGeometry(1.2, 6, 16, 1, true).rotateZ(Math.PI / 2).translate(3, 0, 0), new THREE.MeshBasicMaterial({ color: 0xfff6c8, transparent: true, opacity: 0.25, depthWrite: false, side: THREE.DoubleSide }), lx, 5.4, lz);
    k.add(beam, (t) => { beam.rotation.y = t * 0.8; });
    // 岸邊的椰子樹和石頭
    for (let i = 0; i < 5; i++) { const a = la + 1 + i * 1.05, d = W + 0.9; k.palm(Math.cos(a) * d, Math.sin(a) * d, k.rand(0.8, 1.1)); }
    for (let i = 0; i < 6; i++) { const a = k.rand(0, TAU), d = W + 1; k.part(k.S.dodeca, 0xd8c8b0, Math.cos(a) * d, 0.8, Math.sin(a) * d, 0.6, 0.5, 0.6); }
    // 鯨魚：在湖裡慢慢游，偶爾噴水
    const whale = new THREE.Group();
    const wm = M(0x5c8ad8, { flat: false, rough: 0.5 });
    whale.add(k.mesh(k.S.ball, wm, 0, 0, 0, 2.2, 1, 1.2), k.mesh(k.S.ball, M(0xe6f0ff, { flat: false }), 0.4, -0.4, 0, 1.8, 0.5, 1.0));
    const tail = k.mesh(k.S.cone4, wm, -2.6, 0.3, 0, 0.5, 1.4, 1.2); tail.rotation.z = Math.PI / 2 + 0.5; whale.add(tail);
    whale.add(k.mesh(k.S.ball, M(0x222233), 1.6, 0.25, 0.75, 0.12), k.mesh(k.S.ball, M(0x222233), 1.6, 0.25, -0.75, 0.12));
    const spout = sprinkle(0xdff6ff, 40, 0.8);
    spout.position.set(0.8, 0.9, 0);
    whale.add(spout);
    k.add(whale, (t) => { const a = t * 0.12; whale.position.set(Math.cos(a) * W * 0.45, WY - 0.35 + Math.sin(t * 0.8) * 0.25, Math.sin(a) * W * 0.45); whale.rotation.y = -a - Math.PI / 2; tail.rotation.y = Math.sin(t * 2) * 0.3; spout.userData.tick(t); });
    // 跳出水面的小魚
    for (let i = 0; i < 3; i++) {
      const fish = k.mesh(k.S.cone, M(k.pick([0xffa84a, 0xff7aa8, 0xffd25a])), 0, 0, 0, 0.25, 0.7, 0.18);
      const cx = k.rand(-0.5, 0.5) * W, cz = k.rand(-0.5, 0.5) * W, ph = i * 2.1;
      k.add(fish, (t) => { const f = ((t * 0.5 + ph) % 3) / 1.2; fish.visible = f < 1; const u = Math.min(1, f); fish.position.set(cx + (u - 0.5) * 3, WY + Math.sin(u * Math.PI) * 2.2, cz); fish.rotation.z = -Math.PI / 2 + (u - 0.5) * 2.4; });
    }
    [0.5, 2.6, 4.4].forEach((a) => k.waterfall(a, 2.4, 0.3, false));
  },
  wetland(k) {
    const pond = k.pond(-2, 0, 4.2, 0x6cd0e8, 0xbfa880);
    void pond;
    // 荷葉和荷花
    for (let i = 0; i < 12; i++) { const a = k.rand(0, TAU), d = k.rand(0.5, 3.6); k.part(k.S.disc, 0x5fbf5a, -2 + Math.cos(a) * d, 0.18, Math.sin(a) * d, k.rand(0.35, 0.6), 1, k.rand(0.35, 0.6)); if (i % 3 === 0) k.part(k.S.cone6, 0xff9ac0, -2 + Math.cos(a) * d, 0.35, Math.sin(a) * d, 0.22, 0.35, 0.22, 0, Math.PI); }
    // 木棧道橫過池塘
    for (let i = -4; i <= 4; i++) k.part(k.S.box, 0xd8a874, -2 + i * 0.6, 0.35, 1.2, 0.5, 0.12, 1.4);
    for (let i = -4; i <= 4; i += 2) { k.part(k.S.cyl6, 0xb88a5a, -2 + i * 0.6, 0.15, 0.55, 0.08, 0.6, 0.08); k.part(k.S.cyl6, 0xb88a5a, -2 + i * 0.6, 0.15, 1.85, 0.08, 0.6, 0.08); }
    // 香蒲
    for (let i = 0; i < 18; i++) { const a = k.rand(0, TAU), d = 4.3 + k.rand(0, 0.6), x = -2 + Math.cos(a) * d, z = Math.sin(a) * d; k.part(k.S.cyl6, 0x6cae4a, x, 0.8, z, 0.05, 1.6, 0.05); k.part(k.S.capsule, 0x9a6a40, x, 1.55, z, 0.14, 0.35, 0.14); }
    // 溫室
    const g = k.spot(5, k.R * 0.8, 2);
    if (g) { const p = k.at(g[0], g[1], k.rand(0, TAU)); p(k.S.box, 0xd6f2ff, 0, 1, 0, 3, 2, 2.2); p(k.S.cyl3, 0xc2eaff, 0, 2.4, 0, 1.3, 2.9, 1.3, 0, 0, Math.PI / 2); p(k.S.box, 0xffffff, 0, 1, 1.12, 3.05, 0.1, 0.05); }
    // 花圃：一排一排不同顏色
    const f = k.spot(4, k.R * 0.8, 2.2);
    if (f) for (let row = 0; row < 4; row++) for (let i = 0; i < 6; i++) { k.part(k.S.ball, PALETTE.flower[row % 5], f[0] - 1.5 + i * 0.6, 0.35, f[1] - 0.9 + row * 0.6, 0.22); }
    k.scatter(6, 5, k.R * 0.9, 1, (x, z) => k.tree(x, z, k.rand(0.8, 1.1)));
    k.scatter(6, 4, k.R * 0.9, 0.5, (x, z) => k.mushroom(x, z, k.rand(0.6, 0.9)));
    butterflies(k, 6);
  },
  zoo(k) {
    k.plaza(3.2, 0xf6e2c2);
    // 大門
    const ga = k.rand(0, TAU), gx = Math.cos(ga) * k.R * 0.78, gz = Math.sin(ga) * k.R * 0.78;
    const p = k.at(gx, gz, -ga + Math.PI / 2);
    p(k.S.box, 0xff8a6b, -2, 1.6, 0, 0.6, 3.2, 0.6); p(k.S.box, 0xff8a6b, 2, 1.6, 0, 0.6, 3.2, 0.6);
    p(k.S.box, 0xffd25a, 0, 3.4, 0, 5, 0.9, 0.5); p(k.S.ball, 0x5fd06a, -2, 3.6, 0, 0.5); p(k.S.ball, 0x5fd06a, 2, 3.6, 0, 0.5);
    // 摩天輪
    const fa = ga + Math.PI, fx = Math.cos(fa) * k.R * 0.55, fz = Math.sin(fa) * k.R * 0.55;
    const f = k.at(fx, fz, -fa);
    f(k.S.box, 0xb8c2d6, 0, 2.6, -0.6, 0.25, 5.4, 0.25, 0, 0, 0.35); f(k.S.box, 0xb8c2d6, 0, 2.6, -0.6, 0.25, 5.4, 0.25, 0, 0, -0.35);
    f(k.S.box, 0xb8c2d6, 0, 2.6, 0.6, 0.25, 5.4, 0.25, 0, 0, 0.35); f(k.S.box, 0xb8c2d6, 0, 2.6, 0.6, 0.25, 5.4, 0.25, 0, 0, -0.35);
    k.block(fx, fz, 2.6);
    const wheel = new THREE.Group();
    wheel.position.set(fx, 5.2, fz); wheel.rotation.y = -fa;
    const rim = k.mesh(k.S.thin, M(0xff7aa8), 0, 0, 0, 3.4, 3.4, 8); wheel.add(rim);
    const spokes = new THREE.Group(); wheel.add(spokes);
    spokes.add(rim);
    const cabins = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      const sp = k.mesh(k.S.box, M(0xffffff), Math.cos(a) * 1.7, Math.sin(a) * 1.7, 0, 3.4, 0.08, 0.08); sp.rotation.z = a; spokes.add(sp);
      const c = k.mesh(k.S.box, M(PALETTE.roof[i % 6]), 0, 0, 0, 0.7, 0.6, 0.6); wheel.add(c); cabins.push([c, a]);
    }
    k.add(wheel, (t) => { const w = t * 0.25; spokes.rotation.z = w; cabins.forEach(([c, a]) => c.position.set(Math.cos(a + w) * 3.4, Math.sin(a + w) * 3.4 - 0.4, 0)); });
    // 動物小屋和柵欄
    for (let i = 0; i < 4; i++) { const a = ga + 1.1 + i * 1.0, d = k.R * 0.6; const x = Math.cos(a) * d, z = Math.sin(a) * d; if (k.free(x, z, 1.8)) k.house(x, z, { w: 2, d: 1.8, h: 1.5, ry: -a - Math.PI / 2, chimney: false }); }
    k.fenceArc(k.R * 0.4, ga + 0.6, ga + 2.2); k.fenceArc(k.R * 0.4, ga - 2.2, ga - 0.6);
    // 冰淇淋攤
    const s = k.spot(3.5, k.R * 0.7, 1.2);
    if (s) { k.part(k.S.box, 0xffffff, s[0], 0.6, s[1], 1.4, 1.2, 1); k.part(k.S.cone6, 0xff9ac0, s[0], 1.7, s[1], 1.2, 0.6, 1.2); k.part(k.S.cyl6, 0xe8e8f0, s[0], 1.2, s[1], 0.05, 1.2, 0.05); }
    k.scatter(6, 3.5, k.R * 0.9, 1.1, (x, z) => k.tree(x, z, k.rand(0.8, 1.2)));
    balloons(k, 5);
  },
  sky(k) {
    // 彩虹
    const rb = [0xff6a6a, 0xffa84a, 0xffe05a, 0x6cd86a, 0x5cb8ff, 0xa88cff];
    const ra = k.rand(0, TAU);
    rb.forEach((c, i) => k.part(new THREE.TorusGeometry(6.2 - i * 0.34, 0.18, 6, 40, Math.PI), c, Math.cos(ra) * 2, 0, Math.sin(ra) * 2, 1, 1, 1.2, -ra));
    k.block(Math.cos(ra) * 2 + Math.sin(ra) * 6, Math.sin(ra) * 2 - Math.cos(ra) * 6, 1.2); k.block(Math.cos(ra) * 2 - Math.sin(ra) * 6, Math.sin(ra) * 2 + Math.cos(ra) * 6, 1.2);
    // 氣象站（風向雞）和風車
    const w = k.spot(4, k.R * 0.75, 1.2);
    if (w) { k.part(k.S.cyl6, 0xd0d6e2, w[0], 2, w[1], 0.08, 4, 0.08); const vane = k.mesh(k.S.cone4, M(0xff8a6b), w[0], 4.1, w[1], 0.25, 1.2, 0.1); vane.rotation.z = Math.PI / 2; k.add(vane, (t) => { vane.rotation.y = Math.sin(t * 0.4) * 1.5; }); }
    const m = k.spot(4, k.R * 0.75, 1.4);
    if (m) windmill(k, m[0], m[1], 0xffffff, 0x6cb8ff);
    // 島上的小雲朵
    k.scatter(8, 3, k.R * 0.9, 1, (x, z) => { k.part(k.S.blob, 0xffffff, x, 0.5, z, 1, 0.7, 1); k.part(k.S.blob, 0xf6f9ff, x + 0.7, 0.35, z, 0.7, 0.5, 0.7); });
    // 熱氣球
    for (let i = 0; i < 3; i++) {
      const g = new THREE.Group();
      g.add(k.mesh(k.S.ball, M(PALETTE.roof[i * 2], { flat: false }), 0, 1.6, 0, 1.2, 1.4, 1.2), k.mesh(k.S.cone, M(PALETTE.roof[i * 2], { flat: false }), 0, 0.5, 0, 0.7, 0.8, 0.7));
      g.add(k.mesh(k.S.box, M(0xb88a5a), 0, -0.3, 0, 0.6, 0.5, 0.6));
      const ph = i * 2.1, rr = k.R * (0.8 + i * 0.15);
      k.add(g, (t) => { const a = t * 0.06 + ph; g.position.set(Math.cos(a) * rr, 6 + i * 2 + Math.sin(t * 0.7 + ph) * 0.8, Math.sin(a) * rr); });
    }
    birds(k, [0xffffff, 0xffd6e6, 0xd6eaff], 8);
  },
  body(k) {
    // 會跳的大愛心
    const heart = new THREE.Group();
    const hm = M(0xff5c7a, { flat: false, rough: 0.4 });
    heart.add(k.mesh(k.S.ball, hm, -0.55, 0.35, 0, 0.8), k.mesh(k.S.ball, hm, 0.55, 0.35, 0, 0.8));
    const tip = k.mesh(k.S.cone, hm, 0, -0.55, 0, 1.15, 1.5, 0.75); tip.rotation.z = Math.PI; heart.add(tip);
    heart.position.set(0, 3.2, -4);
    k.part(k.S.cyl, 0xffe6ee, 0, 0.6, -4, 1, 1.2, 1);
    k.block(0, -4, 1.3);
    k.add(heart, (t) => { const b = 1 + Math.max(0, Math.sin(t * 4)) * 0.12; heart.scale.setScalar(b * 1.3); heart.rotation.y = Math.sin(t * 0.5) * 0.4; });
    // 骨頭拱門
    const ba = k.rand(0, TAU), bx = Math.cos(ba) * k.R * 0.6, bz = Math.sin(ba) * k.R * 0.6;
    const b = k.at(bx, bz, -ba);
    [-1.6, 1.6].forEach((dx) => { b(k.S.capsule, 0xfffaf0, dx, 1.6, 0, 0.5, 2.6, 0.5); b(k.S.ball, 0xfffaf0, dx - 0.25, 0.25, 0, 0.38); b(k.S.ball, 0xfffaf0, dx + 0.25, 0.25, 0, 0.38); });
    b(k.S.capsule, 0xfffaf0, 0, 3.3, 0, 0.5, 3, 0.5, 0, 0, Math.PI / 2);
    [-1.9, 1.9].forEach((dx) => { b(k.S.ball, 0xfffaf0, dx, 3.55, 0, 0.42); b(k.S.ball, 0xfffaf0, dx, 3.05, 0, 0.42); });
    k.block(bx, bz, 2.2);
    // 細胞圓頂（裡面有細胞核）
    k.scatter(3, 4, k.R * 0.8, 1.8, (x, z) => { k.part(k.S.half, k.pick([0xffb6ca, 0xc8e6ff, 0xd6f5c8]), x, 0, z, 1.6, 1.3, 1.6); k.part(k.S.ball, 0xb98cff, x + 0.4, 1.1, z + 0.3, 0.45); });
    // DNA 螺旋
    const dna = new THREE.Group();
    const d = k.spot(3, k.R * 0.75, 1.2);
    if (d) {
      dna.position.set(d[0], 0.3, d[1]);
      for (let i = 0; i < 14; i++) { const a = i * 0.55, y = i * 0.38; dna.add(k.mesh(k.S.ball, M(0x5cb8ff), Math.cos(a) * 0.8, y, Math.sin(a) * 0.8, 0.18), k.mesh(k.S.ball, M(0xff8ab8), -Math.cos(a) * 0.8, y, -Math.sin(a) * 0.8, 0.18)); const rung = k.mesh(k.S.box, M(0xfff2b8), 0, y, 0, 1.6, 0.06, 0.06); rung.rotation.y = -a; dna.add(rung); }
      k.spin(dna, 'y', 0.6);
    }
    // 紅血球
    k.scatter(8, 2, k.R * 0.9, 0.6, (x, z) => k.part(k.S.torus, 0xff6a7a, x, 0.2, z, 0.45, 0.45, 0.6, 0, Math.PI / 2));
    // 大腦形狀的花叢
    const br = k.spot(3, k.R * 0.8, 1.6);
    if (br) { k.part(k.S.blob, 0xffa8c4, br[0] - 0.5, 1, br[1], 1.1, 0.9, 1.2); k.part(k.S.blob, 0xff9ab8, br[0] + 0.5, 1, br[1], 1.1, 0.9, 1.2); }
    k.scatter(5, 3, k.R * 0.9, 0.8, (x, z) => k.bush(x, z, k.rand(0.7, 1), k.pick([0xff9ab8, 0xffb6ca, 0x8fd88a])));
  },
  atom(k) {
    k.plaza(4, 0xeef6ff);
    // 超大原子模型：原子核加三條電子軌道
    const atom = new THREE.Group();
    atom.position.set(0, 5.2, 0);
    const nuc = new THREE.Group();
    for (let i = 0; i < 9; i++) { const a = i * 2.4, r = i ? 0.45 : 0; nuc.add(k.mesh(k.S.ball, M(i % 2 ? 0xff7a7a : 0x7ab8ff, { flat: false, rough: 0.4 }), Math.cos(a) * r, Math.sin(i * 1.3) * r, Math.sin(a) * r, 0.42)); }
    atom.add(nuc);
    const orbits = [0, 1.05, 2.1].map((tilt, i) => {
      const o = new THREE.Group(); o.rotation.set(Math.PI / 2 + 0.4 * Math.sin(tilt), tilt, 0);
      o.add(k.mesh(k.S.thin, M(0xb98cff, { e: 0xb98cff, ei: 0.4 }), 0, 0, 0, 2.6, 2.6, 3));
      const e = k.mesh(k.S.ball, M(0x5fdcc0, { e: 0x5fdcc0, ei: 0.8, flat: false }), 2.6, 0, 0, 0.28); o.add(e);
      atom.add(o); return [o, e, 1.2 + i * 0.4];
    });
    k.add(atom, (t) => { nuc.rotation.y = t * 0.5; orbits.forEach(([o, e, s]) => { e.position.set(Math.cos(t * s) * 2.6, Math.sin(t * s) * 2.6, 0); }); });
    k.part(k.S.cyl, 0xc8d6ea, 0, 1.2, 0, 0.25, 2.4, 0.25); k.part(k.S.cyl, 0xdfe8f6, 0, 0.2, 0, 1.2, 0.4, 1.2);
    k.block(0, 0, 1.4);
    // 實驗室
    const l = k.spot(5, k.R * 0.75, 2.6);
    if (l) { k.house(l[0], l[1], { w: 3.6, d: 2.6, h: 2.4, wall: 0xffffff, roof: 0x7a9cff, chimney: false }); }
    // 元素週期表牆
    const wa = k.rand(0, TAU), wx = Math.cos(wa) * k.R * 0.7, wz = Math.sin(wa) * k.R * 0.7;
    const w = k.at(wx, wz, -wa + Math.PI / 2);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 7; c++) if (!(r === 0 && c > 0 && c < 6)) w(k.S.box, PALETTE.roof[(r * 7 + c) % 6], (c - 3) * 0.62, 0.4 + r * 0.62, 0, 0.56, 0.56, 0.2);
    k.block(wx, wz, 2.4);
    // 燒杯和寶石
    k.scatter(5, 3, k.R * 0.88, 0.6, (x, z) => { k.part(k.S.cyl, 0xe6f6ff, x, 0.5, z, 0.35, 1, 0.35); k.part(k.S.cyl, k.pick([0x5fdcc0, 0xff7aa8, 0xffd25a, 0xb98cff]), x, 0.35, z, 0.3, 0.6, 0.3); });
    k.scatter(4, 3, k.R * 0.88, 0.9, (x, z) => k.crystal(x, z, k.rand(0.6, 0.9), k.pick([0x7cc8ff, 0xff8ab8, 0x9ae8b8])));
    k.scatter(3, 4, k.R * 0.9, 1, (x, z) => k.tree(x, z, k.rand(0.8, 1)));
    fireworks(k);
  },
  force(k) {
    // 大鐘擺
    const pa = k.rand(0, TAU), px = Math.cos(pa) * k.R * 0.45, pz = Math.sin(pa) * k.R * 0.45;
    const fr = k.at(px, pz, -pa);
    fr(k.S.box, 0xff8a5c, -1.6, 2.6, 0, 0.3, 5.2, 0.3); fr(k.S.box, 0xff8a5c, 1.6, 2.6, 0, 0.3, 5.2, 0.3); fr(k.S.box, 0xff8a5c, 0, 5.2, 0, 3.6, 0.3, 0.3);
    k.block(px, pz, 2);
    const pend = new THREE.Group(); pend.position.set(px, 5.1, pz); pend.rotation.y = -pa;
    const arm = new THREE.Group(); pend.add(arm);
    arm.add(k.mesh(k.S.cyl6, M(0xb8c2d6), 0, -1.8, 0, 0.05, 3.6, 0.05), k.mesh(k.S.ball, M(0xffd25a, { flat: false, metal: 0.3, rough: 0.3 }), 0, -3.8, 0, 0.6));
    k.add(pend, (t) => { arm.rotation.x = Math.sin(t * 1.6) * 0.6; });
    // 翹翹板
    const s = k.spot(4, k.R * 0.8, 2);
    if (s) { k.part(k.S.cyl3, 0xb8c2d6, s[0], 0.4, s[1], 0.5, 0.6, 0.5, 0, Math.PI / 2); const board = k.mesh(k.S.box, M(0x5cb8ff), s[0], 0.85, s[1], 4, 0.18, 0.6); board.rotation.y = k.rand(0, TAU); const ry = board.rotation.y; k.add(board, (t) => { board.rotation.set(0, ry, Math.sin(t * 1.2) * 0.25, 'YXZ'); }); }
    // 風車（風的能量）
    const m = k.spot(4, k.R * 0.8, 1.4);
    if (m) windmill(k, m[0], m[1], 0xfff4e0, 0xff8a6b);
    // 營火（熱的能量）
    const c = k.spot(3, k.R * 0.75, 1.2);
    if (c) campfire(k, c[0], c[1]);
    // 斜坡上滾下來的球
    const r = k.spot(4, k.R * 0.75, 2.2);
    if (r) {
      const ry = k.rand(0, TAU), p = k.at(r[0], r[1], ry);
      p(k.S.box, 0x9ae8b8, 0, 0.7, 0, 3.6, 0.2, 1, 0, 0, 0.35);
      const ball = k.mesh(k.S.ball, M(0xff5c7a, { flat: false }), 0, 0, 0, 0.35);
      const by = k.ground(r[0], r[1]);
      k.add(ball, (t) => { const u = (t * 0.4) % 1; const lx = 1.6 - u * 3.2, ly = 1.35 - u * 1.15 + 0.3; ball.position.set(r[0] + lx * Math.cos(ry), by + ly, r[1] - lx * Math.sin(ry)); });
    }
    // 喇叭和飄出來的音符（聲音）
    const sp = k.spot(4, k.R * 0.8, 1.2);
    if (sp) { k.part(k.S.box, 0x5c6aa0, sp[0], 1, sp[1], 1.2, 2, 1); k.part(k.S.cyl, 0x333344, sp[0], 1.4, sp[1] + 0.51, 0.4, 0.05, 0.4, 0, Math.PI / 2); k.part(k.S.cyl, 0x333344, sp[0], 0.6, sp[1] + 0.51, 0.25, 0.05, 0.25, 0, Math.PI / 2); notes(k, sp[0], 2.2, sp[1]); }
    // 啞鈴
    k.scatter(2, 3, k.R * 0.85, 0.8, (x, z) => { const p = k.at(x, z, k.rand(0, TAU)); p(k.S.cyl6, 0x8a96b0, 0, 0.3, 0, 0.08, 1.4, 0.08, 0, 0, Math.PI / 2); p(k.S.cyl, 0x444a66, 0.7, 0.3, 0, 0.3, 0.2, 0.3, 0, 0, Math.PI / 2); p(k.S.cyl, 0x444a66, -0.7, 0.3, 0, 0.3, 0.2, 0.3, 0, 0, Math.PI / 2); });
    k.scatter(5, 3, k.R * 0.9, 1, (x, z) => k.tree(x, z, k.rand(0.8, 1.1), k.pick([0x8fd86a, 0xffc25a, 0xff9a5c])));
  },
  lightning(k) {
    // 特斯拉線圈：頂端會冒出電光
    const ta = k.rand(0, TAU), tx = Math.cos(ta) * k.R * 0.4, tz = Math.sin(ta) * k.R * 0.4;
    k.part(k.S.cyl, 0x8a96b0, tx, 0.4, tz, 1, 0.8, 1);
    for (let i = 0; i < 6; i++) k.part(k.S.cyl, i % 2 ? 0xd08a4a : 0xe8a060, tx, 1 + i * 0.5, tz, 0.45, 0.5, 0.45);
    k.part(k.S.torus, 0xdfe6f2, tx, 4.4, tz, 0.9, 0.9, 1.4, 0, Math.PI / 2);
    k.block(tx, tz, 1.2);
    sparks(k, tx, 4.5, tz);
    // 三稜鏡把光分成彩虹
    const pa = ta + 2.2, px = Math.cos(pa) * k.R * 0.5, pz = Math.sin(pa) * k.R * 0.5;
    k.part(k.S.cyl3, 0xe6f6ff, px, 1.2, pz, 1, 1.6, 1);
    k.block(px, pz, 1.2);
    const fan = new THREE.Group(); fan.position.set(px, 1.2, pz); fan.rotation.y = -pa;
    [0xff6a6a, 0xffa84a, 0xffe05a, 0x6cd86a, 0x5cb8ff, 0xa88cff].forEach((c, i) => { const b = k.mesh(new THREE.PlaneGeometry(3, 0.16).translate(1.5, 0, 0), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false }), 0.4, 0, 0); b.rotation.z = -0.25 + i * 0.1; fan.add(b); });
    k.add(fan, (t) => { fan.children.forEach((b, i) => { b.material.opacity = 0.5 + 0.3 * Math.sin(t * 3 + i); }); });
    // 大磁鐵
    const ma = ta - 2.2, mx = Math.cos(ma) * k.R * 0.5, mz = Math.sin(ma) * k.R * 0.5;
    const m = k.at(mx, mz, -ma);
    m(k.S.arch, 0xff5c5c, 0, 2.2, 0, 1.2, 1.2, 2.5, 0, 0, Math.PI);
    m(k.S.box, 0xffffff, -1.2, 2.2, 0, 0.42, 0.5, 0.42); m(k.S.box, 0xffffff, 1.2, 2.2, 0, 0.42, 0.5, 0.42);
    m(k.S.cyl, 0x8a96b0, 0, 0.9, 0, 0.2, 1.8, 0.2);
    k.block(mx, mz, 1.6);
    // 燈泡路燈
    k.scatter(5, 3, k.R * 0.88, 0.5, (x, z) => { k.part(k.S.cyl6, 0x5a6a8a, x, 1.1, z, 0.07, 2.2, 0.07); const bulb = k.mesh(k.S.ball, M(0xfff2a0, { e: 0xffe060, ei: 0.8, flat: false }), x, 2.5, z, 0.35); const ph = x * 3; k.add(bulb, (t) => { bulb.material.emissiveIntensity = 0.6 + 0.4 * Math.sin(t * 2 + ph); }); k.block(x, z, 0.3); });
    // 時鐘塔（光速和時間）
    const c = k.spot(4, k.R * 0.8, 1.6);
    if (c) {
      const p = k.at(c[0], c[1], 0);
      p(k.S.box, 0xfff4e0, 0, 2.5, 0, 1.6, 5, 1.6); p(k.S.cone4, 0x7a9cff, 0, 5.6, 0, 1.3, 1.4, 1.3, Math.PI / 4);
      const face = k.mesh(k.S.cyl, M(0xffffff, { flat: false }), c[0], 4, c[1] + 0.81, 0.6, 0.05, 0.6); face.rotation.x = Math.PI / 2; k.add(face);
      const hand = k.mesh(new THREE.BoxGeometry(0.06, 0.5, 0.04).translate(0, 0.25, 0), M(0x333344), c[0], 4, c[1] + 0.86);
      k.add(hand, (t) => { hand.rotation.z = -t * 2.5; });
    }
    // 電池
    k.scatter(3, 3, k.R * 0.85, 0.6, (x, z) => { k.part(k.S.cyl, 0x444a66, x, 0.6, z, 0.4, 1.2, 0.4); k.part(k.S.cyl, 0xffc25a, x, 0.9, z, 0.41, 0.5, 0.41); k.part(k.S.cyl, 0xd0d6e2, x, 1.3, z, 0.15, 0.2, 0.15); });
    k.scatter(4, 3, k.R * 0.9, 0.9, (x, z) => k.crystal(x, z, k.rand(0.6, 0.9), 0xfff08a));
  },
  scientists(k) {
    k.plaza(3.6, 0xeadfcf);
    // 牛頓的蘋果樹（蘋果會掉下來）
    const p = k.at(0, 0, 0, 1.6);
    p(k.S.cyl6, PALETTE.trunk, 0, 1, 0, 0.3, 2, 0.3);
    p(k.S.lump, 0x5fcf6a, 0, 2.8, 0, 1.6, 1.3, 1.6);
    p(k.S.lump, 0x6fd876, 0.6, 3.4, 0.3, 1.0);
    k.block(0, 0, 1.6);
    for (let i = 0; i < 8; i++) { const a = i * 0.8; k.part(k.S.ball, 0xff4a4a, Math.cos(a) * 2.45, 4.2 + Math.sin(i * 2) * 0.7, Math.sin(a) * 2.45, 0.24); }
    const apple = k.mesh(k.S.ball, M(0xff4a4a, { flat: false }), 1.2, 4, 1, 0.22);
    const top = k.ground(0, 0) + 4.6, bottom = k.ground(1.2, 1) + 0.2;
    k.add(apple, (t) => { const u = (t % 5) / 5; const f = Math.min(1, u * 3); apple.position.y = top + (bottom - top) * f * f; apple.visible = u < 0.75; });
    // 圖書館（有柱子）
    const la = k.rand(0, TAU), lx = Math.cos(la) * k.R * 0.6, lz = Math.sin(la) * k.R * 0.6;
    const l = k.at(lx, lz, -la - Math.PI / 2);
    l(k.S.box, 0xfff8ec, 0, 0.2, 0, 4.6, 0.4, 3); l(k.S.box, 0xf6ead2, 0, 1.6, -0.5, 4, 2.6, 2);
    for (let i = 0; i < 5; i++) l(k.S.cyl, 0xffffff, -1.8 + i * 0.9, 1.6, 0.9, 0.2, 2.6, 0.2);
    l(k.S.cone4, 0xe8d8c0, 0, 3.4, 0.2, 3.2, 1, 1.8, Math.PI / 4);
    k.block(lx, lz, 2.8);
    // 黑板 E=mc²（另外的網格，才能貼字）
    const ba = la + 2.1, bx = Math.cos(ba) * k.R * 0.55, bz = Math.sin(ba) * k.R * 0.55;
    const board = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.5), new THREE.MeshStandardMaterial({ map: chalkTexture(), roughness: 0.9 }));
    board.position.set(bx, 1.8, bz); board.rotation.y = -ba - Math.PI / 2;
    k.add(board);
    k.part(k.S.box, 0x9a6a46, bx, 1.8, bz, 2.8, 1.7, 0.12, -ba - Math.PI / 2);
    k.part(k.S.box, 0x9a6a46, bx, 0.5, bz, 0.12, 1, 0.12);
    k.block(bx, bz, 1.4);
    // 伽利略的望遠鏡
    const ta = la - 2.1, tx = Math.cos(ta) * k.R * 0.55, tz = Math.sin(ta) * k.R * 0.55;
    const tl = k.at(tx, tz, -ta);
    [0, 2.1, 4.2].forEach((a) => tl(k.S.cyl6, 0x9a6a46, Math.cos(a) * 0.35, 0.7, Math.sin(a) * 0.35, 0.05, 1.5, 0.05, -a, 0.25));
    tl(k.S.cyl, 0xc8963c, 0, 1.6, 0, 0.18, 2, 0.18, 0, 0.9);
    k.block(tx, tz, 1);
    // 阿基米德的浴缸
    const s = k.spot(4, k.R * 0.8, 1.4);
    if (s) { k.part(k.S.capsule, 0xffffff, s[0], 0.6, s[1], 1.2, 1.4, 1, 0, 0, Math.PI / 2); k.part(k.S.disc, 0x5cc8f2, s[0], 0.95, s[1], 0.9, 1, 0.55); }
    // 小鎮的房子
    k.scatter(4, 5, k.R * 0.88, 1.8, (x, z) => k.house(x, z, { ry: Math.atan2(-x, -z) }));
    k.scatter(4, 4, k.R * 0.9, 0.3, (x, z) => k.lamp(x, z));
    k.scatter(3, 4, k.R * 0.9, 0.9, (x, z) => k.bush(x, z));
  },
  city(k) {
    // 環狀馬路，車子一直開
    const RR = k.R * 0.62;
    k.part(new THREE.RingGeometry(RR - 0.8, RR + 0.8, 56).rotateX(-Math.PI / 2), 0x6a7088, 0, 0.04, 0, 1, 1, 1);
    k.part(new THREE.RingGeometry(RR - 0.05, RR + 0.05, 56).rotateX(-Math.PI / 2), 0xffffff, 0, 0.06, 0, 1, 1, 1);
    for (let i = 0; i < 6; i++) {
      const car = k.mesh(k.S.box, M(PALETTE.roof[i % 6], { flat: true }), 0, 0.45, 0, 0.7, 0.5, 1.2);
      car.add(k.mesh(k.S.box, M(0xd6f2ff), 0, 0.35, -0.05, 0.6, 0.3, 0.6));
      const ph = (i / 6) * TAU, dir = i % 2 ? 1 : -1, lane = RR + (i % 2 ? 0.35 : -0.35);
      k.add(car, (t) => { const a = ph + t * 0.25 * dir; car.position.set(Math.cos(a) * lane, 0.3, Math.sin(a) * lane); car.rotation.y = -a + (dir > 0 ? 0 : Math.PI); });
    }
    // 中間的 101 大樓
    const tw = k.at(0, 0, 0);
    tw(k.S.box, 0x9fd8d0, 0, 1, 0, 2.4, 2, 2.4);
    for (let i = 0; i < 8; i++) tw(k.S.frustum, i % 2 ? 0x7ec8c0 : 0x8fd2ca, 0, 2.4 + i * 0.95, 0, 1.25 - i * 0.03, 0.95, 1.25 - i * 0.03, Math.PI / 4);
    tw(k.S.cyl6, 0xd6eef0, 0, 11, 0, 0.12, 2.4, 0.12);
    k.block(0, 0, 1.8);
    // 粉彩大樓（窗戶一排一排）
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * TAU + k.rand(-0.2, 0.2), d = k.rand(RR + 1.6, k.R * 0.9), x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (!k.free(x, z, 1.1)) continue;
      const h = k.rand(2.5, 7), w = k.rand(1.3, 1.9), col = k.pick([0xffd6c2, 0xc8e6ff, 0xfff0b8, 0xe6d6ff, 0xc8f2dc]);
      const p = k.at(x, z, -a);
      p(k.S.box, col, 0, h / 2, 0, w, h, w);
      for (let y = 0.8; y < h - 0.3; y += 0.9) p(k.S.box, 0x9fdcff, 0, y, w / 2 + 0.01, w * 0.7, 0.35, 0.04);
      p(k.S.box, new THREE.Color(col).offsetHSL(0, 0, -0.1).getHex(), 0, h + 0.15, 0, w * 1.05, 0.3, w * 1.05);
      k.block(x, z, w * 0.8);
    }
    // 大機器人雕像
    const r = k.spot(2.4, RR - 1, 1.2) || k.spot(RR + 1.6, k.R * 0.85, 1.2);
    if (r) {
      const p = k.at(r[0], r[1], Math.atan2(r[0], r[1]));
      p(k.S.box, 0xc8d6ea, 0, 1.3, 0, 1.4, 1.6, 1); p(k.S.box, 0xdfe8f6, 0, 2.6, 0, 1.1, 0.9, 0.9);
      p(k.S.ball, 0x5cb8ff, -0.25, 2.7, 0.46, 0.13); p(k.S.ball, 0x5cb8ff, 0.25, 2.7, 0.46, 0.13);
      p(k.S.cyl6, 0x8a96b0, 0, 3.3, 0, 0.04, 0.5, 0.04); p(k.S.ball, 0xff5c5c, 0, 3.6, 0, 0.14);
      p(k.S.cyl, 0xb8c2d6, -0.45, 0.25, 0, 0.25, 0.5, 0.25); p(k.S.cyl, 0xb8c2d6, 0.45, 0.25, 0, 0.25, 0.5, 0.25);
      p(k.S.capsule, 0xb8c2d6, -0.95, 1.4, 0, 0.3, 0.8, 0.3, 0, 0, 0.3); p(k.S.capsule, 0xb8c2d6, 0.95, 1.4, 0, 0.3, 0.8, 0.3, 0, 0, -0.3);
    }
    k.scatter(6, 2.4, k.R * 0.9, 0.9, (x, z) => k.tree(x, z, k.rand(0.6, 0.9)));
  },
  flight(k) {
    // 跑道
    const ra = k.ra;
    const p = k.at(0, 0, ra);
    p(k.S.box, 0x6a7088, 0, 0.04, 0, 2.6, 0.1, k.R * 1.6);
    for (let i = -5; i <= 5; i++) p(k.S.box, 0xffffff, 0, 0.1, i * k.R * 0.14, 0.18, 0.04, k.R * 0.07);
    for (let s = -1; s <= 1; s += 2) for (let i = -6; i <= 6; i++) p(k.S.ball, 0xffd25a, s * 1.4, 0.12, i * k.R * 0.12, 0.08);
    for (let i = -8; i <= 8; i++) k.block(Math.sin(ra) * i * k.R * 0.09, Math.cos(ra) * i * k.R * 0.09, 1.6);
    // 塔台和機棚
    const side = (d, along) => [Math.cos(ra) * d + Math.sin(ra) * along, -Math.sin(ra) * d + Math.cos(ra) * along];
    const [tx, tz] = side(4.5, -3);
    k.part(k.S.cyl, 0xeef2fa, tx, 2.2, tz, 0.6, 4.4, 0.6); k.part(k.S.cyl, 0x9fdcff, tx, 4.8, tz, 1.1, 0.9, 1.1); k.part(k.S.cyl, 0xff8a6b, tx, 5.4, tz, 1.2, 0.3, 1.2);
    k.block(tx, tz, 1.2);
    const radar = k.mesh(k.S.half, M(0xffffff, { side: THREE.DoubleSide }), tx, 6, tz, 0.7, 0.3, 0.7);
    radar.rotation.x = Math.PI / 2;
    const rg = new THREE.Group(); rg.add(radar); radar.position.set(0, 0, 0); rg.position.set(tx, 6, tz);
    k.add(rg, (t) => { rg.rotation.y = t * 1.2; });
    const [hx, hz] = side(-5, 2);
    k.part(new THREE.CylinderGeometry(1, 1, 1, 16, 1, false, 0, Math.PI), 0xc8d6ea, hx, 0, hz, 2.2, 4, 2.2, ra + Math.PI / 2, 0, Math.PI / 2);
    k.block(hx, hz, 2.6);
    // 停好的飛機
    const [ax, az] = side(5, 3.5);
    plane(k, ax, 0.6, az, ra, true);
    // 繞著飛的飛機和直升機
    const fly = plane(k, 0, 0, 0, 0, false);
    k.add(fly, (t) => { const a = t * 0.35; fly.position.set(Math.cos(a) * k.R * 1.1, 8 + Math.sin(t) * 0.6, Math.sin(a) * k.R * 1.1); fly.rotation.set(0, -a, 0.3); });
    const heli = new THREE.Group();
    heli.add(k.mesh(k.S.ball, M(0xffd25a), 0, 0, 0, 0.8, 0.6, 0.6), k.mesh(k.S.box, M(0xffd25a), -1, 0.1, 0, 1.4, 0.2, 0.2));
    const rotor = k.mesh(k.S.box, M(0x444a66), 0, 0.7, 0, 3, 0.05, 0.2); heli.add(rotor);
    k.add(heli, (t) => { const a = -t * 0.2 + 2; heli.position.set(Math.cos(a) * k.R * 0.7, 5 + Math.sin(t * 0.7), Math.sin(a) * k.R * 0.7); heli.rotation.y = -a; rotor.rotation.y = t * 20; });
    // 潛水艇停在港口的水池裡
    const [sx, sz] = side(-5, -4);
    k.pond(sx, sz, 2);
    const sub = new THREE.Group();
    sub.add(k.mesh(k.S.capsule, M(0xffd25a, { flat: false }), 0, 0, 0, 0.9, 2, 0.9), k.mesh(k.S.box, M(0xffc040), 0, 0.6, 0, 0.5, 0.6, 0.8));
    sub.children[0].rotation.z = Math.PI / 2;
    const subY = k.ground(sx, sz);
    k.add(sub, (t) => { sub.position.set(sx, subY + 0.25 + Math.sin(t) * 0.1, sz); sub.rotation.y = ra; });
    // 風向袋
    const [wx, wz] = side(3, -6);
    k.part(k.S.cyl6, 0xffffff, wx, 1.5, wz, 0.06, 3, 0.06);
    const sock = k.mesh(k.S.cone, M(0xff7a4a), wx + 0.6, 2.8, wz, 0.3, 1.2, 0.3); sock.rotation.z = Math.PI / 2;
    k.add(sock, (t) => { sock.rotation.y = Math.sin(t * 0.8) * 0.6; });
    k.scatter(5, 4, k.R * 0.92, 1, (x, z) => k.tree(x, z, k.rand(0.7, 1)));
  },
  moon(k) {
    // 登月小艇
    const l = k.spot(3, k.R * 0.6, 2);
    if (l) {
      const p = k.at(l[0], l[1], k.rand(0, TAU));
      p(k.S.box, 0xffcf5a, 0, 1.4, 0, 1.6, 1, 1.6); p(k.S.cyl6, 0xdfe2ea, 0, 2.4, 0, 0.8, 1, 0.8);
      p(k.S.ball, 0x9fdcff, 0, 2.5, 0.65, 0.25);
      [[1, 1], [-1, 1], [1, -1], [-1, -1]].forEach(([dx, dz]) => { p(k.S.cyl6, 0xb8c2d6, dx * 1, 0.6, dz * 1, 0.06, 1.4, 0.06, 0, dz * 0.4, -dx * 0.4); p(k.S.disc, 0xb8c2d6, dx * 1.25, 0.05, dz * 1.25, 0.3, 1, 0.3); });
    }
    k.flag(-3, 3, 0xff8a6b, 2.6);
    // 月球車
    const rover = new THREE.Group();
    rover.add(k.mesh(k.S.box, M(0xdfe2ea), 0, 0.6, 0, 1.2, 0.3, 0.8), k.mesh(k.S.box, M(0x5c8ad8), -0.2, 0.9, 0, 0.6, 0.05, 0.7));
    [[0.5, 0.45], [-0.5, 0.45], [0.5, -0.45], [-0.5, -0.45]].forEach(([dx, dz]) => { const w = k.mesh(k.S.cyl, M(0x555b70), dx, 0.3, dz, 0.3, 0.15, 0.3); w.rotation.x = Math.PI / 2; rover.add(w); });
    k.add(rover, (t) => { const a = t * 0.15, x = Math.cos(a) * k.R * 0.55, z = Math.sin(a) * k.R * 0.55; rover.position.set(x, k.ground(x, z), z); rover.rotation.y = -a; });
    // 天線碟
    const d = k.spot(4, k.R * 0.8, 1.4);
    if (d) { k.part(k.S.cyl6, 0xdfe2ea, d[0], 0.9, d[1], 0.1, 1.8, 0.1); const dish = k.mesh(k.S.half, M(0xffffff, { side: THREE.DoubleSide }), d[0], 2, d[1], 1.1, 0.4, 1.1); dish.rotation.x = Math.PI * 0.7; k.add(dish, (t) => { dish.rotation.z = Math.sin(t * 0.3) * 0.6; }); }
    // 月亮島頭上有地球，還有繞圈圈的人造衛星
    const earth = new THREE.Group();
    earth.add(k.mesh(k.S.ball, M(0x5cb8ff, { flat: false, rough: 0.5 }), 0, 0, 0, 2.2));
    [[0.8, 0.9, 1.2], [-1.1, -0.3, 1.1], [0.2, -1.2, 0.9]].forEach(([x, y, s]) => earth.add(k.mesh(k.S.blob, M(0x6cd86a), x, y, 1.6, s * 0.8, s * 0.6, 0.6)));
    earth.add(k.mesh(k.S.ball, M(0xffffff, { opacity: 0.35, flat: false }), 0, 0, 0, 2.35));
    earth.position.set(-k.R * 0.8, 12, -k.R * 0.6);
    k.spin(earth, 'y', 0.15);
    const sat = new THREE.Group();
    sat.add(k.mesh(k.S.box, M(0xffcf5a), 0, 0, 0, 0.6, 0.6, 0.6), k.mesh(k.S.box, M(0x5c8ad8), 1, 0, 0, 1.2, 0.05, 0.5), k.mesh(k.S.box, M(0x5c8ad8), -1, 0, 0, 1.2, 0.05, 0.5));
    k.add(sat, (t) => { const a = t * 0.4; sat.position.set(Math.cos(a) * k.R * 0.9, 7 + Math.sin(a * 2), Math.sin(a) * k.R * 0.9); sat.rotation.y = -a; });
    k.scatter(6, 2, k.R * 0.9, 0.7, (x, z) => k.rock(x, z, k.rand(0.4, 0.8), 0xd2d6e2));
    // 腳印
    for (let i = 0; i < 10; i++) k.part(k.S.disc, 0xc2c6d2, -3 + i * 0.5, 0.05, 3.5 - i * 0.6 + (i % 2) * 0.3, 0.15, 1, 0.25);
  },
  planets(k) {
    // 太陽系儀：中間的太陽，八顆行星繞著轉
    k.part(k.S.cyl, 0xfff0d6, 0, 0.4, 0, 1.6, 0.8, 1.6);
    k.part(k.S.cyl6, 0xd0b890, 0, 1.8, 0, 0.18, 2.4, 0.18);
    const sun = k.mesh(k.S.ball, M(0xffd25a, { e: 0xffb020, ei: 0.9, flat: false }), 0, 3.6, 0, 1.5);
    k.add(sun, (t) => { sun.scale.setScalar(1.5 + Math.sin(t * 2) * 0.05); });
    const glow = glowSprite(0xffd28a, 8, 0.8); glow.position.set(0, 3.6, 0); k.add(glow);
    k.block(0, 0, 1.8);
    const P = [[0xc8b8a8, 0.25, 2.4], [0xffc88a, 0.35, 3.2], [0x5cb8ff, 0.38, 4.1], [0xff7a5c, 0.3, 5], [0xf0b88a, 0.8, 6.2], [0xf6d89a, 0.65, 7.6], [0x9ae8f0, 0.5, 8.8], [0x6c8cff, 0.48, 9.9]];
    P.forEach(([c, s, r], i) => {
      if (r > k.R * 0.95) return;
      k.part(new THREE.RingGeometry(r - 0.06, r + 0.06, 64).rotateX(-Math.PI / 2), 0xf0b888, 0, 0.05, 0, 1, 1, 1);
      const pl = new THREE.Group();
      pl.add(k.mesh(k.S.ball, M(c, { flat: false, rough: 0.5 }), 0, 0, 0, s));
      if (i === 5) { const ringM = k.mesh(k.S.torus, M(0xe8c88a, { flat: false }), 0, 0, 0, s * 1.6, s * 1.6, 0.25); ringM.rotation.x = Math.PI / 2 - 0.4; pl.add(ringM); }
      const sp = 0.6 / Math.sqrt(r), ph = i * 1.7;
      k.add(pl, (t) => { const a = ph + t * sp; pl.position.set(Math.cos(a) * r, 3.6 + Math.sin(a + i) * 0.3, Math.sin(a) * r); });
    });
    // 天文台
    const o = k.spot(k.R * 0.6, k.R * 0.9, 1.8);
    if (o) { k.part(k.S.cyl, 0xffffff, o[0], 0.9, o[1], 1.5, 1.8, 1.5); k.part(k.S.half, 0xc8d6ea, o[0], 1.8, o[1], 1.5, 1.3, 1.5); k.part(k.S.box, 0x5c6aa0, o[0], 2.6, o[1] + 0.9, 0.4, 0.9, 0.6, 0, 0.6); }
    // 彗星
    const comet = new THREE.Group();
    comet.add(k.mesh(k.S.ball, M(0xe6f6ff, { e: 0x9fdcff, ei: 0.8 }), 0, 0, 0, 0.4));
    const tail = k.mesh(k.S.cone, new THREE.MeshBasicMaterial({ color: 0xbfe9ff, transparent: true, opacity: 0.45, depthWrite: false }), 1.6, 0, 0, 0.35, 3, 0.35); tail.rotation.z = -Math.PI / 2; comet.add(tail);
    k.add(comet, (t) => { const a = t * 0.18; comet.position.set(Math.cos(a) * k.R * 1.3, 10 + Math.sin(a) * 2, Math.sin(a) * k.R * 1.3); comet.rotation.y = -a + Math.PI / 2; });
    k.scatter(4, k.R * 0.55, k.R * 0.92, 0.8, (x, z) => k.rock(x, z, k.rand(0.4, 0.7), 0xf0c8a0));
  },
  stars(k) {
    // 大天文台
    const p = k.at(-4, -3, 0.7);
    p(k.S.cyl, 0xf6f2ff, 0, 1.4, 0, 2.6, 2.8, 2.6); p(k.S.half, 0xd6ccff, 0, 2.8, 0, 2.7, 2.4, 2.7);
    p(k.S.box, 0x5c4a9a, 0, 3.8, 1.6, 0.9, 1.8, 1.2, 0, -0.5);
    p(k.S.cyl, 0xffc25a, 0, 4.6, 1.8, 0.35, 2.4, 0.35, 0, 0.9);
    p(k.S.box, 0x8a5a3a, 0, 0.75, 2.6, 0.8, 1.5, 0.1);
    k.block(-4, -3, 3);
    // 會發光的星星水晶
    const glowMat = M(0xfff08a, { e: 0xffd84a, ei: 0.7 });
    k.scatter(9, 2, k.R * 0.88, 0.9, (x, z) => { const s = k.rand(0.6, 1.1); const c = k.mesh(k.S.octa, glowMat, x, 0.9 * s, z, 0.4 * s, 1 * s, 0.4 * s); c.rotation.y = k.rand(0, TAU); k.add(c); k.block(x, z, 0.6 * s); });
    k.ticks.push((t) => { glowMat.emissiveIntensity = 0.5 + 0.3 * Math.sin(t * 2); });
    k.scatter(6, 2, k.R * 0.9, 0.9, (x, z) => k.crystal(x, z, k.rand(0.6, 1), k.pick([0xb98cff, 0x8cb8ff, 0xff9ad8])));
    // 頭上的星座（點和線）
    const pts = [[0, 0], [2, 1], [3.5, 0.2], [5, 1.4], [6.2, 0.5], [3.2, 2.6]];
    const cons = new THREE.Group(); cons.position.set(k.R * 0.2, 11, -k.R * 0.3);
    pts.forEach(([x, y]) => cons.add(k.mesh(k.S.octa, M(0xfff6c8, { e: 0xffe08a, ei: 1 }), x * 1.4, y * 1.4, 0, 0.3)));
    const lg = new THREE.BufferGeometry().setFromPoints([[0, 1], [1, 2], [2, 3], [3, 4], [2, 5]].flatMap(([a, b]) => [new THREE.Vector3(pts[a][0] * 1.4, pts[a][1] * 1.4, 0), new THREE.Vector3(pts[b][0] * 1.4, pts[b][1] * 1.4, 0)]));
    cons.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 })));
    k.add(cons, (t) => { cons.rotation.y = Math.sin(t * 0.1) * 0.5; });
    // 小小的黑洞（有一圈轉動的光盤）
    const bh = new THREE.Group(); bh.position.set(k.R * 0.45, 5, k.R * 0.35);
    bh.add(k.mesh(k.S.ball, M(0x1a1430, { flat: false, rough: 1 }), 0, 0, 0, 0.9));
    const disk = k.mesh(new THREE.RingGeometry(1.1, 2.4, 40), new THREE.MeshBasicMaterial({ map: diskTexture(), transparent: true, side: THREE.DoubleSide, depthWrite: false }), 0, 0, 0);
    disk.rotation.x = -Math.PI / 2 + 0.35; bh.add(disk);
    k.part(k.S.cyl6, 0xb8a6f0, k.R * 0.45, 2, k.R * 0.35, 0.12, 4, 0.12);
    k.block(k.R * 0.45, k.R * 0.35, 0.8);
    k.add(bh, (t) => { disk.rotation.z = t * 0.8; });
    // 銀河漩渦
    const gal = new THREE.Sprite(new THREE.SpriteMaterial({ map: galaxyTexture(), transparent: true, depthWrite: false }));
    gal.scale.set(9, 9, 1); gal.position.set(-k.R * 0.6, 14, k.R * 0.5);
    k.add(gal, (t) => { gal.material.rotation = t * 0.1; });
  },
};

// ---------- 會動的小效果 ----------
function smoke(k, x, y, z, s = 1, absolute = false) {
  if (!absolute) y += k.ground(x, z);
  const puffs = [];
  const mat = new THREE.SpriteMaterial({ map: puffTexture(), color: 0xffffff, transparent: true, depthWrite: false });
  for (let i = 0; i < 6; i++) { const sp = new THREE.Sprite(mat.clone()); sp.userData.free = true; k.add(sp); puffs.push([sp, i / 6]); }
  k.ticks.push((t) => puffs.forEach(([sp, ph]) => { const u = (t * 0.18 + ph) % 1; sp.position.set(x + Math.sin(u * 6 + ph * 9) * 0.6 * s, y + u * 6 * s, z + u * 1.2 * s); const sc = (1 + u * 2.5) * s; sp.scale.set(sc, sc, 1); sp.material.opacity = 0.75 * (1 - u); }));
}
function snow(k) {
  const n = 160, geo = new THREE.BufferGeometry(), pos = new Float32Array(n * 3), seed = [];
  for (let i = 0; i < n; i++) { seed.push([k.rand(-1, 1) * k.R, k.rand(0, 14), k.rand(-1, 1) * k.R, k.rand(0.5, 1.2)]); }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.35, transparent: true, opacity: 0.9, depthWrite: false }));
  pts.frustumCulled = false;
  k.add(pts, (t) => { seed.forEach(([x, y, z, sp], i) => { pos[i * 3] = x + Math.sin(t + i) * 0.5; pos[i * 3 + 1] = 14 - ((y + t * sp) % 14); pos[i * 3 + 2] = z; }); geo.attributes.position.needsUpdate = true; });
}
/** 一小撮噴出來的水花／火花（給鯨魚、煙火用）。 */
function sprinkle(color, n = 40, spread = 1) {
  const geo = new THREE.BufferGeometry(), pos = new Float32Array(n * 3), dir = [];
  for (let i = 0; i < n; i++) { const a = Math.random() * TAU; dir.push([Math.cos(a) * spread * Math.random(), 1.5 + Math.random() * 1.5, Math.sin(a) * spread * Math.random()]); }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color, size: 0.3, transparent: true, opacity: 0.9, depthWrite: false }));
  pts.frustumCulled = false;
  pts.userData.tick = (t, period = 5) => {
    const u = (t % period) / 1.2;
    pts.visible = u < 1;
    if (!pts.visible) return;
    dir.forEach(([dx, dy, dz], i) => { pos[i * 3] = dx * u * 2; pos[i * 3 + 1] = dy * u * 2 - 4 * u * u; pos[i * 3 + 2] = dz * u * 2; });
    geo.attributes.position.needsUpdate = true;
    pts.material.opacity = 0.9 * (1 - u);
  };
  return pts;
}
function fireworks(k) {
  const bursts = [0xff7aa8, 0xffd25a, 0x5fdcc0].map((c, i) => { const s = sprinkle(c, 60, 3); s.material.size = 0.45; k.add(s); return [s, i]; });
  k.ticks.push((t) => bursts.forEach(([s, i]) => { const tt = t + i * 1.7; const cycle = Math.floor(tt / 5); s.position.set(Math.cos(cycle * 2.3 + i) * k.R * 0.5, 9 + i, Math.sin(cycle * 2.3 + i) * k.R * 0.5); s.userData.tick(tt, 5); }));
}
function windmill(k, x, z, body, blade) {
  k.part(k.S.cone6, body, x, 2, z, 1, 4, 1);
  k.part(k.S.cone4, blade, x, 4.4, z, 0.9, 1, 0.9, Math.PI / 4);
  k.block(x, z, 1.1);
  const hub = new THREE.Group(); hub.position.set(x, 3.6, z); hub.rotation.y = Math.atan2(x, z);
  const rot = new THREE.Group(); rot.position.z = 0.9; hub.add(rot);
  for (let i = 0; i < 4; i++) { const b = k.mesh(new THREE.BoxGeometry(0.5, 2.6, 0.05).translate(0, 1.4, 0), M(0xffffff)); b.rotation.z = (i / 4) * TAU; rot.add(b); }
  k.add(hub, (t) => { rot.rotation.z = t * 1.2; });
}
function campfire(k, x, z) {
  for (let i = 0; i < 4; i++) k.part(k.S.cyl6, 0x8a5a3a, x, 0.2, z, 0.12, 1.4, 0.12, (i / 4) * Math.PI, Math.PI / 2 - 0.3);
  for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; k.part(k.S.dodeca, 0xb8b0a8, x + Math.cos(a) * 0.8, 0.15, z + Math.sin(a) * 0.8, 0.22); }
  const flames = [0xffd25a, 0xff9a3c, 0xff6a3c].map((c, i) => { const f = k.mesh(k.S.cone, M(c, { e: c, ei: 1 }), x, 0.6, z, 0.45 - i * 0.1, 1.2 - i * 0.2, 0.45 - i * 0.1); k.add(f); return f; });
  k.ticks.push((t) => flames.forEach((f, i) => { f.scale.y = (1.2 - i * 0.2) * (1 + Math.sin(t * 12 + i * 2) * 0.15); f.rotation.y = t * (2 + i); }));
}
function sparks(k, x, y, z) {
  y += k.ground(x, z);
  const mat = new THREE.LineBasicMaterial({ color: 0xbfe9ff, transparent: true, opacity: 0.9 });
  const geo = new THREE.BufferGeometry(); const pos = new Float32Array(6 * 2 * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const lines = new THREE.LineSegments(geo, mat); lines.frustumCulled = false; lines.userData.free = true;
  const glow = glowSprite(0x9fdcff, 3, 1); glow.position.set(x, y, z); glow.userData.free = true;
  k.add(lines); k.add(glow);
  k.ticks.push((t) => {
    const f = Math.floor(t * 10);
    for (let i = 0; i < 6; i++) {
      const h = Math.sin(f * 12.9 + i * 78.2) * 43758.5; const r = h - Math.floor(h);
      const a = r * TAU, len = 1 + ((h * 7) % 1) * 1.2;
      pos.set([x, y, z, x + Math.cos(a) * len, y + (r - 0.3) * 1.2, z + Math.sin(a) * len], i * 6);
    }
    geo.attributes.position.needsUpdate = true;
    mat.opacity = 0.5 + 0.5 * Math.abs(Math.sin(t * 17));
  });
}
function notes(k, x, y, z) {
  y += k.ground(x, z);
  const mat = new THREE.SpriteMaterial({ map: noteTexture(), transparent: true, depthWrite: false });
  const list = [0, 1, 2].map(() => { const s = new THREE.Sprite(mat.clone()); k.add(s); return s; });
  k.ticks.push((t) => list.forEach((s, i) => { const u = (t * 0.3 + i / 3) % 1; s.position.set(x + Math.sin(u * 6 + i) * 0.6, y + u * 3, z); s.scale.setScalar(0.9); s.material.opacity = 1 - u; }));
}
function birds(k, colors, n = 6) {
  const wing = new THREE.PlaneGeometry(0.8, 0.3).translate(0.4, 0, 0).rotateX(-Math.PI / 2);
  const flock = Array.from({ length: n }, (_, i) => {
    const b = new THREE.Group(), m = M(colors[i % colors.length], { side: THREE.DoubleSide });
    const L = new THREE.Mesh(wing, m), R = new THREE.Mesh(wing, m); R.scale.x = -1;
    b.add(L, R, k.mesh(k.S.ball, m, 0, 0, 0, 0.18, 0.15, 0.3));
    k.add(b);
    return { b, L, R, d: k.R * k.rand(0.6, 1.2), y: k.rand(6, 11), ph: k.rand(0, TAU), sp: k.rand(0.15, 0.3) * (k.r() > 0.5 ? 1 : -1) };
  });
  k.ticks.push((t) => flock.forEach((f) => { const a = f.ph + t * f.sp; f.b.position.set(Math.cos(a) * f.d, f.y + Math.sin(t + f.ph) * 0.5, Math.sin(a) * f.d); f.b.rotation.y = -a + (f.sp > 0 ? 0 : Math.PI); const w = Math.sin(t * 9 + f.ph) * 0.7; f.L.rotation.z = w; f.R.rotation.z = -w; }));
}
function butterflies(k, n) {
  const wing = new THREE.CircleGeometry(0.3, 8).translate(0.3, 0, 0).rotateX(-Math.PI / 2);
  for (let i = 0; i < n; i++) {
    const b = new THREE.Group(), m = M(PALETTE.flower[i % 5], { side: THREE.DoubleSide, flat: false });
    const L = new THREE.Mesh(wing, m), R = new THREE.Mesh(wing, m); R.scale.x = -1; b.add(L, R);
    const cx = k.rand(-0.6, 0.6) * k.R, cz = k.rand(-0.6, 0.6) * k.R, ph = k.rand(0, TAU);
    k.add(b, (t) => { const x = cx + Math.sin(t * 0.5 + ph) * 2, z = cz + Math.cos(t * 0.4 + ph) * 2; b.position.set(x, k.ground(x, z) + 1.5 + Math.sin(t * 1.3 + ph) * 0.6, z); b.rotation.y = t * 0.5 + ph; const w = Math.sin(t * 14 + ph) * 1.1; L.rotation.z = w; R.rotation.z = -w; });
  }
}
function balloons(k, n) {
  for (let i = 0; i < n; i++) {
    const g = new THREE.Group();
    g.add(k.mesh(k.S.ball, M(PALETTE.roof[i % 6], { flat: false, rough: 0.3 }), 0, 0, 0, 0.45, 0.55, 0.45));
    g.add(k.mesh(k.S.cyl6, M(0xffffff), 0, -0.9, 0, 0.01, 1.2, 0.01));
    const cx = k.rand(-0.6, 0.6) * k.R, cz = k.rand(-0.6, 0.6) * k.R, ph = k.rand(0, TAU);
    k.add(g, (t) => g.position.set(cx + Math.sin(t * 0.3 + ph), 4.5 + Math.sin(t * 0.8 + ph) * 0.6, cz));
  }
}
function plane(k, x, y, z, ry, parked) {
  const g = new THREE.Group();
  const white = M(0xffffff, { flat: false }), accent = M(0x6cb8ff);
  const body = k.mesh(k.S.capsule, white, 0, 0, 0, 0.6, 2.6, 0.6); body.rotation.x = Math.PI / 2; g.add(body);
  g.add(k.mesh(k.S.box, accent, 0, 0, 0.1, 3.6, 0.08, 0.7), k.mesh(k.S.box, accent, 0, 0.5, -1.4, 0.08, 0.9, 0.5), k.mesh(k.S.box, accent, 0, 0.1, -1.4, 1.3, 0.06, 0.4));
  g.add(k.mesh(k.S.ball, M(0x9fdcff), 0, 0.2, 1.3, 0.25));
  g.position.set(x, y, z); g.rotation.y = ry;
  if (parked) { k.add(g); k.block(x, z, 1.8); }
  return g;
}
// 深海島的水：會閃的波紋（明亮的藍綠色）
function lagoonMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 } },
    vertexShader: /* glsl */ `varying vec2 vP; void main() { vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `uniform float time; varying vec2 vP;
      void main() {
        float r = length(vP);
        float w = sin(vP.x * 0.9 + time * 1.3) * sin(vP.y * 0.8 - time * 1.1) + sin(r * 1.4 - time * 1.8) * 0.5;
        vec3 deep = vec3(0.22, 0.62, 0.92), shallow = vec3(0.45, 0.88, 0.95);
        vec3 c = mix(deep, shallow, smoothstep(0.0, 1.0, r / 14.0));
        c += vec3(1.0) * smoothstep(0.92, 1.0, w * 0.5 + 0.5) * 0.35;
        gl_FragColor = vec4(c, 0.82);
      }`,
    transparent: true, depthWrite: false,
  });
}
// ---------- 小貼圖 ----------
// 木頭站牌：深色的字寫在木板上
function signTexture(emoji, name) {
  return cached(`sign:${name}`, () => {
    const c = document.createElement('canvas'), g = c.getContext('2d');
    g.font = '800 46px "Noto Sans TC","PingFang TC",sans-serif';
    const tw = g.measureText(name).width;
    c.width = Math.ceil(tw + 120); c.height = 84;
    g.fillStyle = '#b8834e'; g.beginPath(); g.roundRect(0, 0, c.width, 84, 18); g.fill();
    g.fillStyle = '#f6d9a8'; g.beginPath(); g.roundRect(5, 5, c.width - 10, 74, 14); g.fill();
    g.textBaseline = 'middle';
    g.font = `40px ${EMOJI_FONT}`; g.fillText(emoji, 16, 44);
    g.font = '800 46px "Noto Sans TC","PingFang TC",sans-serif'; g.fillStyle = '#5a3a1c'; g.fillText(name, 72, 45);
    return c;
  });
}
function caveArtTexture() {
  return cached('cave-art', () => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 140; const g = c.getContext('2d');
    g.fillStyle = '#b8a088'; g.globalAlpha = 0.95; g.fillRect(0, 0, 256, 140); g.globalAlpha = 1;
    // 手印
    const hand = (x, y, s, col) => { g.fillStyle = col; g.beginPath(); g.ellipse(x, y, 9 * s, 11 * s, 0, 0, TAU); g.fill(); [-8, -3, 2, 7].forEach((dx, i) => { g.fillRect(x + dx * s - 2 * s, y - 24 * s + (i % 3) * 2 * s, 4 * s, 14 * s); }); g.fillRect(x + 9 * s, y - 6 * s, 9 * s, 4 * s); };
    hand(30, 50, 1.1, '#a3401e'); hand(52, 90, 0.9, '#7a2e14');
    // 動物（長毛象、鹿）
    g.strokeStyle = '#5a2412'; g.fillStyle = '#8a3216'; g.lineWidth = 4; g.lineCap = 'round';
    g.beginPath(); g.ellipse(130, 70, 34, 22, 0, 0, TAU); g.fill();
    g.beginPath(); g.arc(165, 62, 12, 0, TAU); g.fill();
    g.beginPath(); g.moveTo(172, 70); g.quadraticCurveTo(182, 95, 174, 108); g.stroke();
    [106, 120, 140, 152].forEach((x) => { g.beginPath(); g.moveTo(x, 85); g.lineTo(x, 104); g.stroke(); });
    g.beginPath(); g.ellipse(212, 92, 18, 9, 0, 0, TAU); g.fill();
    g.beginPath(); g.moveTo(226, 86); g.lineTo(236, 70); g.moveTo(236, 70); g.lineTo(230, 60); g.moveTo(236, 70); g.lineTo(244, 62); g.stroke();
    [202, 208, 216, 222].forEach((x) => { g.beginPath(); g.moveTo(x, 98); g.lineTo(x, 112); g.stroke(); });
    // 小人
    g.beginPath(); g.arc(200, 34, 5, 0, TAU); g.moveTo(200, 39); g.lineTo(200, 54); g.moveTo(192, 46); g.lineTo(212, 40); g.moveTo(200, 54); g.lineTo(194, 64); g.moveTo(200, 54); g.lineTo(206, 64); g.stroke();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; return t;
  });
}
function puffTexture() {
  return cached('puff', () => {
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
    const r = g.createRadialGradient(32, 32, 4, 32, 32, 30); r.addColorStop(0, 'rgba(255,255,255,0.95)'); r.addColorStop(0.6, 'rgba(240,240,250,0.6)'); r.addColorStop(1, 'rgba(240,240,250,0)');
    g.fillStyle = r; g.fillRect(0, 0, 64, 64); return c;
  });
}
function noteTexture() {
  return cached('note', () => {
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
    g.font = '700 48px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 6; g.strokeStyle = '#ffffff'; g.strokeText('♪', 32, 34); g.fillStyle = '#7a6cff'; g.fillText('♪', 32, 34); return c;
  });
}
function chalkTexture() {
  return cached('chalk', () => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 148; const g = c.getContext('2d');
    g.fillStyle = '#2f6a54'; g.fillRect(0, 0, 256, 148);
    g.fillStyle = '#ffffff'; g.font = '700 46px serif'; g.textAlign = 'center'; g.fillText('E = mc²', 128, 70);
    g.font = '24px serif'; g.fillStyle = '#ffe9a8'; g.fillText('F = ma   🍎↓', 128, 118); return c;
  });
}
function diskTexture() {
  return cached('bhdisk', () => {
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    const r = g.createRadialGradient(64, 64, 28, 64, 64, 64);
    r.addColorStop(0, 'rgba(255,240,180,1)'); r.addColorStop(0.5, 'rgba(255,150,90,0.8)'); r.addColorStop(1, 'rgba(190,120,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, 128, 128);
    g.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 8; i++) { g.beginPath(); g.arc(64, 64, 34 + i * 4, i, i + 1.2); g.lineWidth = 2; g.stroke(); }
    return c;
  });
}
function galaxyTexture() {
  return cached('galaxy', () => {
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    for (let i = 0; i < 900; i++) {
      const arm = i % 2, d = Math.random() * 58, a = d * 0.09 + arm * Math.PI + (Math.random() - 0.5) * 0.6;
      g.fillStyle = `hsla(${260 + Math.random() * 60}, 90%, ${70 + Math.random() * 25}%, ${0.6 * (1 - d / 64)})`;
      g.fillRect(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, 2, 2);
    }
    const r = g.createRadialGradient(64, 64, 0, 64, 64, 18); r.addColorStop(0, 'rgba(255,250,230,1)'); r.addColorStop(1, 'rgba(255,240,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, 128, 128); return c;
  });
}

// ---------- 每座島加碼的 3D 物件（在原本的東西蓋好之後才放） ----------
function penguin(k, x, z, s = 1) {
  const p = k.at(x, z, k.rand(0, TAU), s);
  p(k.S.capsule, 0x2c3048, 0, 0.75, 0, 0.7, 0.8, 0.6);
  p(k.S.ball, 0xffffff, 0, 0.7, 0.2, 0.26, 0.42, 0.14);
  p(k.S.ball, 0x2c3048, 0, 1.35, 0, 0.3);
  p(k.S.cone, 0xffa83c, 0, 1.33, 0.32, 0.07, 0.22, 0.07, 0, Math.PI / 2);
  p(k.S.ball, 0xffffff, 0.12, 1.42, 0.22, 0.06); p(k.S.ball, 0xffffff, -0.12, 1.42, 0.22, 0.06);
  p(k.S.box, 0xffa83c, 0.12, 0.05, 0.12, 0.16, 0.06, 0.24); p(k.S.box, 0xffa83c, -0.12, 0.05, 0.12, 0.16, 0.06, 0.24);
  p(k.S.box, 0x2c3048, 0.36, 0.8, 0, 0.08, 0.5, 0.22, 0, 0, 0.3); p(k.S.box, 0x2c3048, -0.36, 0.8, 0, 0.08, 0.5, 0.22, 0, 0, -0.3);
  k.block(x, z, 0.5);
}
function heron(k, x, z) {
  const p = k.at(x, z, k.rand(0, TAU));
  p(k.S.cyl6, 0xe0a050, 0.08, 0.7, 0, 0.03, 1.4, 0.03); p(k.S.cyl6, 0xe0a050, -0.08, 0.7, 0, 0.03, 1.4, 0.03);
  p(k.S.ball, 0xffffff, 0, 1.55, 0, 0.32, 0.26, 0.5, 0, 0.3);
  p(k.S.capsule, 0xffffff, 0, 2.0, 0.3, 0.1, 0.6, 0.1, 0, -0.35);
  p(k.S.ball, 0xffffff, 0, 2.42, 0.45, 0.13);
  p(k.S.cone, 0xffc23c, 0, 2.4, 0.72, 0.04, 0.35, 0.04, 0, Math.PI / 2);
  k.block(x, z, 0.4);
}
function aurora(k) {
  // 冰雪島頭上的極光：薄薄的緞帶，顏色從薄荷綠到粉紅，慢慢飄
  const mat = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 } },
    vertexShader: /* glsl */ `uniform float time; varying vec2 vUv; void main() { vUv = uv; vec3 p = position; p.z += sin(p.x * 0.25 + time * 0.6) * 2.0; p.y += sin(p.x * 0.4 + time) * 0.5 * uv.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
    fragmentShader: /* glsl */ `uniform float time; varying vec2 vUv; void main() { float a = smoothstep(0.0, 0.35, vUv.y) * (1.0 - smoothstep(0.55, 1.0, vUv.y)); a *= 0.55 + 0.45 * sin(vUv.x * 24.0 + time * 1.5); vec3 c = mix(vec3(0.45, 1.0, 0.75), vec3(1.0, 0.55, 0.85), vUv.y); gl_FragColor = vec4(c, a * 0.75); }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
  });
  [0, 1].forEach((i) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(k.R * 1.5, 4, 40, 1), mat);
    m.position.set(-k.R * 0.35 + i * 2, 12 + i * 2, -k.R * 0.4 + i * 2); m.rotation.y = Math.PI / 4 + 0.3 - i * 0.6; m.userData.free = true;
    k.add(m);
  });
  k.ticks.push((t) => { mat.uniforms.time.value = t; });
}
function carousel(k, x, z) {
  k.part(k.S.cyl, 0xffe6f0, x, 0.15, z, 2.4, 0.3, 2.4);
  k.part(k.S.cyl6, 0xffc25a, x, 1.6, z, 0.15, 3, 0.15);
  k.block(x, z, 2.6);
  const top = new THREE.Group(); top.position.set(x, 0, z);
  const roof = k.mesh(k.S.cone, M(0xff7aa8), 0, 3.5, 0, 2.7, 1.2, 2.7); top.add(roof);
  top.add(k.mesh(k.S.cyl, M(0xffffff), 0, 2.85, 0, 2.6, 0.2, 2.6));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU, cx = Math.cos(a) * 1.8, cz = Math.sin(a) * 1.8;
    top.add(k.mesh(k.S.cyl6, M(0xffd25a), cx, 1.5, cz, 0.05, 2.7, 0.05));
    const horse = new THREE.Group(); horse.position.set(cx, 1.2, cz); horse.rotation.y = -a;
    const c = PALETTE.roof[i % 6];
    horse.add(k.mesh(k.S.capsule, M(c), 0, 0, 0, 0.35, 0.7, 0.35), k.mesh(k.S.ball, M(c), 0.0, 0.25, 0.45, 0.22));
    horse.children[0].rotation.x = Math.PI / 2;
    horse.userData.ph = i;
    top.add(horse);
  }
  k.add(top, (t) => { top.rotation.y = t * 0.5; top.children.forEach((h) => { if (h.userData.ph != null) h.position.y = 1.2 + Math.sin(t * 2 + h.userData.ph) * 0.25; }); });
}
function turbine(k, x, z) {
  k.part(k.S.cyl, 0xffffff, x, 3, z, 0.18, 6, 0.18);
  k.block(x, z, 0.6);
  const hub = new THREE.Group(); hub.position.set(x, 6, z); hub.rotation.y = k.rand(0, TAU);
  hub.add(k.mesh(k.S.capsule, M(0xffffff), 0, 0, 0, 0.35, 0.6, 0.35));
  hub.children[0].rotation.x = Math.PI / 2;
  const rot = new THREE.Group(); rot.position.z = 0.5; hub.add(rot);
  for (let i = 0; i < 3; i++) { const b = k.mesh(new THREE.BoxGeometry(0.22, 2.8, 0.05).translate(0, 1.4, 0), M(0xf6f8ff)); b.rotation.z = (i / 3) * TAU; rot.add(b); }
  k.add(hub, (t) => { rot.rotation.z = t * 1.6; });
}
function neuron(k, x, z) {
  const p = k.at(x, z, k.rand(0, TAU));
  p(k.S.blob, 0xb98cff, 0, 1.2, 0, 0.6);
  p(k.S.cyl6, 0xd6b8ff, 0, 0.5, 0, 0.12, 1.2, 0.12);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU, tilt = 0.9;
    p(k.S.cyl6, 0xd6b8ff, Math.cos(a) * 0.55, 1.6, Math.sin(a) * 0.55, 0.07, 1.2, 0.07, -a, 0, -tilt);
    p(k.S.ball, 0xffc8f0, Math.cos(a) * 1.05, 2.0, Math.sin(a) * 1.05, 0.16);
  }
  p(k.S.ball, 0xfff2a8, 0, 1.2, 0.55, 0.15);
  k.block(x, z, 1.1);
}
function lattice(k, x, z) {
  // 晶體結構：3×3×3 的原子用小棒子連起來
  const p = k.at(x, z, k.rand(0, TAU), 0.9);
  const g = 1.0, y0 = 0.6;
  for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) for (let c = 0; c < 3; c++) {
    const px = (a - 1) * g, py = y0 + b * g, pz = (c - 1) * g;
    p(k.S.ball, (a + b + c) % 2 ? 0x7ab8ff : 0xff7a9a, px, py, pz, 0.22);
    if (a < 2) p(k.S.cyl6, 0xdfe6f2, px + g / 2, py, pz, 0.05, g, 0.05, 0, 0, Math.PI / 2);
    if (b < 2) p(k.S.cyl6, 0xdfe6f2, px, py + g / 2, pz, 0.05, g, 0.05);
    if (c < 2) p(k.S.cyl6, 0xdfe6f2, px, py, pz + g / 2, 0.05, g, 0.05, 0, Math.PI / 2);
  }
  k.block(x, z, 1.6);
}
function molecules(k) {
  // 飄在空中的水分子和二氧化碳分子
  [[0xff5c5c, 0xffffff], [0x444a66, 0xff5c5c], [0xff5c5c, 0xffffff]].forEach(([center, side], i) => {
    const g = new THREE.Group();
    g.add(k.mesh(k.S.ball, M(center, { flat: false }), 0, 0, 0, 0.5));
    const ang = i === 1 ? Math.PI : 1.82;
    [ang / 2, -ang / 2].forEach((a) => g.add(k.mesh(k.S.ball, M(side, { flat: false }), Math.sin(a) * 0.7, Math.cos(a) * 0.7, 0, 0.32)));
    const cx = Math.cos(i * 2.1) * k.R * 0.45, cz = Math.sin(i * 2.1) * k.R * 0.45;
    g.userData.free = true;
    k.add(g, (t) => { g.position.set(cx, 7 + i * 1.2 + Math.sin(t * 0.8 + i) * 0.6, cz); g.rotation.set(t * 0.4 + i, t * 0.6, 0); });
  });
}
function coaster(k, x, z) {
  // 雲霄飛車的大迴圈：軌道是一個直立的圓，小車一直繞
  const ry = k.rand(0, TAU), R = 2.6, cy = R + 0.6;
  const p = k.at(x, z, ry);
  p(new THREE.TorusGeometry(R, 0.12, 6, 48), 0xff5c7a, 0, cy, 0.25);
  p(new THREE.TorusGeometry(R, 0.12, 6, 48), 0xff5c7a, 0, cy, -0.25);
  for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; p(k.S.box, 0xffffff, Math.cos(a) * R, cy + Math.sin(a) * R, 0, 0.14, 0.14, 0.6, 0, 0, a); }
  [-1, 1].forEach((sd) => { p(k.S.box, 0xb8c2d6, sd * 1.8, cy * 0.5, 0, 0.2, cy, 0.2, 0, 0, sd * 0.35); });
  p(k.S.box, 0xff5c7a, R + 2, 0.6, 0, 4, 0.12, 0.6); p(k.S.box, 0xff5c7a, -R - 2, 0.6, 0, 4, 0.12, 0.6);
  k.block(x, z, 3.2);
  const gy = k.ground(x, z), c = Math.cos(ry), s = Math.sin(ry);
  const cart = k.mesh(k.S.box, M(0xffd25a), 0, 0, 0, 0.7, 0.45, 0.6);
  cart.userData.free = true;
  k.add(cart, (t) => {
    const a = -Math.PI / 2 + ((t * 0.5) % 1) * TAU;
    const lx = Math.cos(a) * R, ly = cy + Math.sin(a) * R;
    cart.position.set(x + lx * c, gy + ly, z - lx * s);
    cart.rotation.set(0, ry, a + Math.PI / 2, 'YXZ');
  });
}
function cradle(k, x, z) {
  const ry = k.rand(0, TAU), p = k.at(x, z, ry);
  p(k.S.box, 0x8a96b0, 0, 0.1, 0, 2.4, 0.2, 1.2);
  [-1, 1].forEach((sx) => [-1, 1].forEach((sz) => p(k.S.cyl6, 0x8a96b0, sx * 1.1, 1.2, sz * 0.5, 0.05, 2.2, 0.05)));
  p(k.S.box, 0x8a96b0, 0, 2.3, 0.5, 2.3, 0.08, 0.08); p(k.S.box, 0x8a96b0, 0, 2.3, -0.5, 2.3, 0.08, 0.08);
  k.block(x, z, 1.4);
  const gy = k.ground(x, z), c = Math.cos(ry), sn = Math.sin(ry);
  const balls = [-2, -1, 0, 1, 2].map((i) => {
    const g = new THREE.Group(); g.position.set(x + i * 0.4 * c, gy + 2.3, z - i * 0.4 * sn); g.rotation.y = ry; g.userData.free = true;
    g.add(k.mesh(k.S.cyl6, M(0xdfe6f2), 0, -0.6, 0, 0.015, 1.2, 0.015), k.mesh(k.S.ball, M(0xd8dee8, { metal: 0.5, rough: 0.25, flat: false }), 0, -1.3, 0, 0.2));
    k.add(g);
    return g;
  });
  k.ticks.push((t) => { const w = Math.sin(t * 3.2); balls[0].rotation.z = w > 0 ? 0 : w * 0.6; balls[4].rotation.z = w > 0 ? w * 0.6 : 0; });
}
function powerLine(k) {
  // 電線桿一路排過去，中間有垂下來的電線
  const a = k.rand(0, TAU), n = 4, pts = [];
  for (let i = 0; i < n; i++) {
    const t = -0.6 + (i / (n - 1)) * 1.2, x = Math.cos(a) * t * k.R + Math.sin(a) * 2, z = Math.sin(a) * t * k.R - Math.cos(a) * 2;
    if (!k.free(x, z, 0.5)) continue;
    k.part(k.S.cyl6, 0x9a6a46, x, 2.2, z, 0.1, 4.4, 0.1);
    k.part(k.S.box, 0x9a6a46, x, 4.1, z, 1.4, 0.1, 0.1, -a);
    k.block(x, z, 0.4);
    pts.push([x, k.ground(x, z) + 4.15, z]);
  }
  const verts = [];
  for (let i = 0; i < pts.length - 1; i++) for (const off of [-0.6, 0.6]) {
    const [ax, ay, az] = pts[i], [bx, by, bz] = pts[i + 1], ox = Math.cos(a) * off * 0, oz = 0;
    void ox; void oz;
    for (let j = 0; j < 10; j++) {
      const t0 = j / 10, t1 = (j + 1) / 10, sag = (u) => Math.sin(u * Math.PI) * 0.6;
      const px = (u) => ax + (bx - ax) * u - Math.sin(a) * off, pz = (u) => az + (bz - az) * u + Math.cos(a) * off;
      verts.push(px(t0), ay + (by - ay) * t0 - sag(t0), pz(t0), px(t1), ay + (by - ay) * t1 - sag(t1), pz(t1));
    }
  }
  if (verts.length) {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    const wires = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x3a3f63 }));
    wires.userData.free = true; k.add(wires);
  }
}
function stormCloud(k) {
  // 小烏雲，偶爾打一道閃電到避雷針上
  const rod = k.spot(3, k.R * 0.7, 0.8);
  if (!rod) return;
  const [x, z] = rod;
  k.part(k.S.cyl6, 0xb8c2d6, x, 2.5, z, 0.06, 5, 0.06);
  k.part(k.S.ball, 0xffd25a, x, 5.1, z, 0.18);
  const gy = k.ground(x, z);
  const cloud = new THREE.Group(); cloud.position.set(x, gy + 11, z); cloud.userData.free = true;
  [[0, 0, 1.4], [1.2, -0.2, 1.0], [-1.2, -0.1, 1.1], [0.5, 0.5, 0.9]].forEach(([cx, cy, r]) => cloud.add(k.mesh(k.S.blob, M(0x8a90b0), cx, cy, 0, r, r * 0.75, r)));
  k.add(cloud);
  const pts = [];
  for (let i = 0; i <= 6; i++) pts.push(new THREE.Vector3((i % 2 ? 0.4 : -0.4) * (i > 0 && i < 6 ? 1 : 0), 11 - (i / 6) * (11 - 5.2), 0));
  const bolt = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xfff6a0 }));
  bolt.position.set(x, gy, z); bolt.userData.free = true;
  const flash = glowSprite(0xfff6a0, 6, 1); flash.position.set(x, gy + 6, z); flash.userData.free = true;
  k.add(bolt); k.add(flash);
  k.ticks.push((t) => { const on = (t % 4) < 0.18; bolt.visible = on; flash.visible = on; cloud.position.x = x + Math.sin(t * 0.3) * 0.4; });
}
function pisa(k, x, z) {
  // 比薩斜塔（伽利略在這裡丟過球）
  const tilt = 0.14, ry = k.rand(0, TAU), p = k.at(x, z, ry);
  for (let i = 0; i < 6; i++) {
    const y = 0.6 + i * 1.15, off = Math.sin(tilt) * y;
    p(k.S.cyl, 0xfff8ec, off, y, 0, 0.95, 1.15, 0.95, 0, 0, -tilt);
    p(k.S.torus, 0xe8dcc6, off + Math.sin(tilt) * 0.55, y + 0.55, 0, 1.0, 1.0, 0.6, 0, Math.PI / 2);
  }
  p(k.S.cyl, 0xfff8ec, Math.sin(tilt) * 7.6, 7.6, 0, 0.6, 0.8, 0.6, 0, 0, -tilt);
  p(k.S.half, 0xe8a060, Math.sin(tilt) * 8.1, 8.0, 0, 0.6, 0.5, 0.6);
  k.block(x, z, 1.5);
}
function monorail(k) {
  // 高架單軌電車：繞著城市一圈
  const RR = k.R * 0.62, h = 4.6;
  k.noGround = true;
  k.part(new THREE.TorusGeometry(RR, 0.16, 6, 64), 0xdfe6f2, 0, h, 0, 1, 1, 1, 0, Math.PI / 2);
  for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU + 0.15, x = Math.cos(a) * RR, z = Math.sin(a) * RR; k.part(k.S.cyl6, 0xb8c2d6, x, h / 2, z, 0.14, h, 0.14); }
  k.noGround = false;
  const cars = [0, 1, 2].map((i) => {
    const c = new THREE.Group(); c.userData.free = true;
    c.add(k.mesh(k.S.capsule, M(i ? 0xffffff : 0x5cb8ff, { flat: false }), 0, 0.45, 0, 0.7, 1.4, 0.7), k.mesh(k.S.box, M(0x9fdcff), 0, 0.6, 0, 0.72, 0.25, 1.2));
    c.children[0].rotation.x = Math.PI / 2;
    k.add(c);
    return c;
  });
  k.ticks.push((t) => cars.forEach((c, i) => { const a = t * 0.22 - i * 0.16; c.position.set(Math.cos(a) * RR, h, Math.sin(a) * RR); c.rotation.y = -a; }));
}
function airship(k) {
  const g = new THREE.Group(); g.userData.free = true;
  const body = k.mesh(k.S.capsule, M(0xdfe6f2, { flat: false, metal: 0.2 }), 0, 0, 0, 2, 5, 2); body.rotation.x = Math.PI / 2; g.add(body);
  g.add(k.mesh(k.S.box, M(0x5c8ad8), 0, -1.2, 0, 0.7, 0.5, 1.6));
  [[0, 1], [0, -1], [1, 0], [-1, 0]].forEach(([dx, dy]) => g.add(k.mesh(k.S.box, M(0xff8a6b), dx * 0.9, dy * 0.9, -3, dx ? 1.2 : 0.08, dy ? 1.2 : 0.08, 1.2)));
  g.add(k.mesh(k.S.box, M(0xff8a6b), 0, 0, 0.2, 2.05, 0.4, 2.2));
  k.add(g, (t) => { const a = t * 0.08 + 1; g.position.set(Math.cos(a) * k.R * 1.15, 13 + Math.sin(t * 0.4) * 0.8, Math.sin(a) * k.R * 1.15); g.rotation.y = -a; });
}
function moonBase(k, x, z) {
  const ry = k.rand(0, TAU), p = k.at(x, z, ry);
  p(k.S.half, 0xffffff, -1.6, 0, 0, 1.5, 1.3, 1.5); p(k.S.half, 0xffffff, 1.8, 0, 0, 1.2, 1.0, 1.2);
  p(k.S.capsule, 0xdfe2ea, 0.1, 0.55, 0, 0.6, 1.8, 0.6, 0, 0, Math.PI / 2);
  for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU; p(k.S.box, 0x9fdcff, -1.6 + Math.cos(a) * 1.3, 0.7, Math.sin(a) * 1.3, 0.35, 0.3, 0.06, -a + Math.PI / 2); }
  p(k.S.cyl6, 0xdfe2ea, 1.8, 1.6, 0, 0.05, 1.4, 0.05); p(k.S.ball, 0xff5c5c, 1.8, 2.35, 0, 0.12);
  k.block(x, z, 3.2);
}
function astronaut(k, x, z) {
  const p = k.at(x, z, k.rand(0, TAU));
  p(k.S.box, 0xc8ccd8, 0, 0.2, 0, 1.2, 0.4, 1.2);
  p(k.S.capsule, 0xffffff, 0, 1.6, 0, 0.8, 0.9, 0.6);
  p(k.S.ball, 0xffffff, 0, 2.55, 0, 0.45);
  p(k.S.ball, 0xffc25a, 0, 2.55, 0.22, 0.36, 0.3, 0.26);
  p(k.S.box, 0xdfe2ea, 0, 1.7, -0.45, 0.6, 0.8, 0.3);
  p(k.S.cyl6, 0xffffff, 0.2, 0.75, 0, 0.13, 0.9, 0.13); p(k.S.cyl6, 0xffffff, -0.2, 0.75, 0, 0.13, 0.9, 0.13);
  p(k.S.capsule, 0xffffff, 0.55, 2.2, 0, 0.22, 0.6, 0.22, 0, 0, -2.4);
  k.block(x, z, 0.8);
}
function asteroidBelt(k) {
  const n = 46, geo = new THREE.DodecahedronGeometry(1, 0), mesh = new THREE.InstancedMesh(geo, M(0xc8a888), n);
  mesh.userData.free = true; mesh.frustumCulled = false;
  const r = rng(hash(k.def.id) + 0.9), rocks = Array.from({ length: n }, () => ({ a: r() * TAU, d: k.R * (1.08 + r() * 0.18), y: 3 + (r() - 0.5) * 2, s: 0.25 + r() * 0.5, sp: 0.05 + r() * 0.05, spin: r() * 3 }));
  const o = new THREE.Object3D();
  k.add(mesh, (t) => {
    rocks.forEach((q, i) => { const a = q.a + t * q.sp; o.position.set(Math.cos(a) * q.d, q.y, Math.sin(a) * q.d); o.rotation.set(t * q.spin * 0.3, t * q.spin * 0.2, 0); o.scale.setScalar(q.s); o.updateMatrix(); mesh.setMatrixAt(i, o.matrix); });
    mesh.instanceMatrix.needsUpdate = true;
  });
}
function radioDish(k, x, z) {
  const p = k.at(x, z, k.rand(0, TAU));
  p(k.S.cyl6, 0xdfe2ea, 0, 1.2, 0, 0.2, 2.4, 0.2);
  p(k.S.half, 0xffffff, 0, 2.8, 0.3, 1.6, 0.6, 1.6, 0, Math.PI * 0.62);
  p(k.S.cyl6, 0xb8c2d6, 0, 3.5, 1.1, 0.04, 1.6, 0.04, 0, -0.9);
  p(k.S.ball, 0xff8ab8, 0, 4.0, 1.7, 0.16);
  k.block(x, z, 1.6);
}
function turtle(k, W, WY) {
  const g = new THREE.Group(); g.userData.free = true;
  g.add(k.mesh(k.S.half, M(0x5fae6a), 0, 0, 0, 0.8, 0.45, 1.0), k.mesh(k.S.ball, M(0x9ad88a), 0, 0.05, 0.95, 0.28));
  const fl = [[0.7, 0.4], [-0.7, 0.4], [0.6, -0.6], [-0.6, -0.6]].map(([fx, fz]) => { const f = k.mesh(k.S.box, M(0x9ad88a), fx, 0, fz, 0.5, 0.06, 0.25); g.add(f); return f; });
  k.add(g, (t) => { const a = -t * 0.1 + 2; g.position.set(Math.cos(a) * W * 0.62, WY - 0.08, Math.sin(a) * W * 0.62); g.rotation.y = -a + Math.PI; fl.forEach((f, i) => { f.rotation.y = Math.sin(t * 3 + i) * 0.5; }); });
}
function dragonflies(k, n) {
  const wing = new THREE.PlaneGeometry(0.5, 0.12).translate(0.25, 0, 0).rotateX(-Math.PI / 2);
  for (let i = 0; i < n; i++) {
    const g = new THREE.Group(), wm = M(0xd6f2ff, { opacity: 0.7, side: THREE.DoubleSide });
    g.add(k.mesh(k.S.capsule, M([0x5cb8ff, 0xff7aa8, 0x7ad87a][i % 3]), 0, 0, 0, 0.08, 0.7, 0.08));
    g.children[0].rotation.x = Math.PI / 2;
    const ws = [0.15, -0.05].flatMap((wz) => [1, -1].map((side) => { const w = new THREE.Mesh(wing, wm); w.position.z = wz; w.scale.x = side; g.add(w); return w; }));
    const [cx, cz] = k.ponds?.[i % (k.ponds?.length || 1)] || [0, 0], ph = k.rand(0, TAU);
    g.userData.free = true;
    k.add(g, (t) => { const a = t * 0.7 + ph, x = cx + Math.cos(a) * 2 + Math.sin(t * 3 + ph) * 0.3, z = cz + Math.sin(a * 1.3) * 1.6; g.position.set(x, Math.max(k.ground(x, z), k.water ?? 0) + 0.9 + Math.sin(t * 2 + ph) * 0.2, z); g.rotation.y = -a; ws.forEach((w, j) => { w.rotation.x = Math.sin(t * 40 + j) * 0.4; }); });
  }
}
function kites(k, n) {
  for (let i = 0; i < n; i++) {
    const anchor = k.spot(2, k.R * 0.7, 0.4); if (!anchor) continue;
    const [ax, az] = anchor, gy = k.ground(ax, az), c = PALETTE.roof[(i * 2) % 6];
    const kite = new THREE.Group(); kite.userData.free = true;
    kite.add(k.mesh(k.S.octa, M(c, { side: THREE.DoubleSide }), 0, 0, 0, 0.9, 1.2, 0.08));
    for (let j = 0; j < 4; j++) kite.add(k.mesh(k.S.box, M(PALETTE.roof[(i + j) % 6]), 0, -1.4 - j * 0.45, 0, 0.3, 0.12, 0.05));
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3));
    const line = new THREE.Line(lg, new THREE.LineBasicMaterial({ color: 0x8a8fb0 })); line.userData.free = true;
    k.add(kite); k.add(line);
    k.ticks.push((t) => {
      const x = ax + 3 + Math.sin(t * 0.5 + i) * 1.2, y = gy + 8 + i + Math.sin(t * 0.9 + i) * 0.8, z = az + Math.cos(t * 0.4 + i) * 1.2;
      kite.position.set(x, y, z); kite.rotation.set(0, t * 0.2, Math.sin(t + i) * 0.3);
      lg.attributes.position.setXYZ(0, ax, gy, az); lg.attributes.position.setXYZ(1, x, y - 0.6, z); lg.attributes.position.needsUpdate = true;
    });
  }
}
function pterosaur(k) {
  const g = new THREE.Group(); g.userData.free = true;
  g.add(k.mesh(k.S.capsule, M(0xb87a5a), 0, 0, 0, 0.3, 1.2, 0.3), k.mesh(k.S.cone, M(0xb87a5a), 0, 0.15, 0.9, 0.12, 0.8, 0.12));
  g.children[0].rotation.x = Math.PI / 2; g.children[1].rotation.x = Math.PI / 2;
  const wingG = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0.3), new THREE.Vector3(2.4, 0, -0.1), new THREE.Vector3(0, 0, -0.5)]);
  const wm = M(0xd89a6a, { side: THREE.DoubleSide });
  const L = new THREE.Mesh(wingG, wm), Rw = new THREE.Mesh(wingG, wm); Rw.scale.x = -1; g.add(L, Rw);
  k.add(g, (t) => { const a = t * 0.2; g.position.set(Math.cos(a) * k.R * 0.9, 11 + Math.sin(t * 0.7) * 1.2, Math.sin(a) * k.R * 0.9); g.rotation.y = -a + Math.PI; const w = Math.sin(t * 3) * 0.5; L.rotation.z = w; Rw.rotation.z = -w; });
}

const EXTRA = {
  stoneage(k) {
    // 天上飛過的鳥，溪邊的釣魚叉架
    birds(k, [0x6a5a4a, 0x8a7a6a], 4);
    const r = k.spot(3, k.R * 0.85, 0.8);
    if (r) { const q = k.at(r[0], r[1], k.rand(0, TAU)); [-0.5, 0.5].forEach((x) => q(k.S.cyl6, 0x9a6a46, x, 0.9, 0, 0.06, 1.8, 0.06)); q(k.S.cyl6, 0x9a6a46, 0, 1.7, 0, 0.05, 1.3, 0.05, 0, 0, Math.PI / 2); [0.25, -0.25].forEach((x) => q(k.S.capsule, 0x8ab8d8, x, 1.25, 0, 0.12, 0.7, 0.08)); }
  },
  studio(k) {
    // 圓弧形的觀眾席，面向錄音室
    const cx = -6, cz = -3.5, face = Math.atan2(-cz, -cx);
    for (let row = 0; row < 3; row++) for (let i = -3; i <= 3; i++) {
      const a = face + i * 0.17, rr = 7.2 + row * 1.25, x = cx + Math.cos(a) * rr, z = cz + Math.sin(a) * rr;
      if (!k.free(x, z, 0.5)) continue;
      k.part(k.S.box, [0xff8a6b, 0xffc25a, 0x6cb8ff][row], x, 0.25 + row * 0.22, z, 1.0, 0.5 + row * 0.44, 0.55, -a + Math.PI / 2);
      k.block(x, z, 0.5, false);
    }
    // 麥克風塔發出一圈一圈的電波
    const rings = [0, 1, 2].map(() => { const m = k.mesh(k.S.thin, new THREE.MeshBasicMaterial({ color: 0xff8a5c, transparent: true, opacity: 0.6, depthWrite: false }), 6, 6.6, -4); m.rotation.x = Math.PI / 2; k.add(m); return m; });
    k.ticks.push((t) => rings.forEach((m, i) => { const u = (t * 0.35 + i / 3) % 1; m.scale.set(1 + u * 7, 1 + u * 7, 1.5); m.material.opacity = 0.6 * (1 - u); }));
    // 兩個大喇叭
    [[2.5, -6.5], [8.5, -1]].forEach(([x, z]) => { if (!k.free(x, z, 0.8)) return; const p = k.at(x, z, Math.atan2(-x, -z)); p(k.S.box, 0x3a3f63, 0, 1, 0, 1.2, 2, 1); p(k.S.cyl, 0x8a90b0, 0, 1.4, 0.51, 0.4, 0.05, 0.4, 0, Math.PI / 2); p(k.S.cyl, 0x8a90b0, 0, 0.6, 0.51, 0.25, 0.05, 0.25, 0, Math.PI / 2); k.block(x, z, 0.8); });
  },
  rainforest(k) {
    // 板根大樹：粗粗的樹幹、像翅膀一樣的板根、垂下來的藤蔓
    const t = k.spot(3, k.R * 0.75, 2.4);
    if (t) {
      const p = k.at(t[0], t[1], k.rand(0, TAU), 1.15);
      p(k.S.cyl6, 0x8a5a36, 0, 3.5, 0, 0.55, 7, 0.55);
      for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU; p(k.S.box, 0x7a4e2e, Math.cos(a) * 0.75, 0.7, Math.sin(a) * 0.75, 1.3, 1.4, 0.16, -a); }
      [[0, 7.6, 0, 2.8], [1.4, 7.1, 0.8, 1.9], [-1.3, 7.2, -0.6, 2.0], [0.3, 8.6, -0.4, 1.8]].forEach(([x, y, z, r], i) => p(k.S.lump, [0x2f9a4a, 0x3fae55, 0x268a40, 0x4cbf5a][i], x, y, z, r, r * 0.6, r));
      for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU, d = 2.2; p(k.S.cyl6, 0x4cae5a, Math.cos(a) * d, 5.6, Math.sin(a) * d, 0.04, 2.6, 0.04); p(k.S.lump, 0x5fcf6a, Math.cos(a) * d, 4.3, Math.sin(a) * d, 0.18); }
    }
    // 吊橋：跨過河谷
    if (k.lake && k.riverEnd) {
      const [lx, lz] = k.lake, [ex, ez] = k.riverEnd, mx = lx + (ex - lx) * 0.55, mz = lz + (ez - lz) * 0.55;
      const len = Math.hypot(ex - lx, ez - lz), dx = (ex - lx) / len, dz = (ez - lz) / len, nx = -dz, nz = dx;
      const A = [mx + nx * 3.2, mz + nz * 3.2], B = [mx - nx * 3.2, mz - nz * 3.2], hA = k.ground(...A), hB = k.ground(...B);
      const yaw = -Math.atan2(dz, dx);
      k.noGround = true;
      for (let i = 0; i <= 12; i++) {
        const u = i / 12, x = A[0] + (B[0] - A[0]) * u, z = A[1] + (B[1] - A[1]) * u, y = hA + (hB - hA) * u + 0.35 - Math.sin(u * Math.PI) * 0.45;
        k.part(k.S.box, 0xc8955e, x, y, z, 0.9, 0.08, 0.32, yaw);
        [1, -1].forEach((sd) => k.part(k.S.ball, 0xe8c890, x + dx * 0.5 * sd, y + 0.75, z + dz * 0.5 * sd, 0.07));
      }
      [A, B].forEach(([x, z]) => [1, -1].forEach((sd) => k.part(k.S.cyl6, 0x8a5a36, x + dx * 0.5 * sd, k.ground(x, z) + 0.7, z + dz * 0.5 * sd, 0.09, 1.4, 0.09)));
      k.noGround = false;
    }
    // 大大的龜背芋葉子
    k.scatter(6, 2, k.R * 0.85, 0.7, (x, z) => { for (let i = 0; i < 3; i++) { const a = k.rand(0, TAU); k.part(k.S.ball, k.pick([0x2f9a4a, 0x3fae55]), x + Math.cos(a) * 0.35, 0.5, z + Math.sin(a) * 0.35, 0.8, 0.05, 0.5, -a, 0.5); } k.part(k.S.cyl6, 0x3a8a3a, x, 0.25, z, 0.04, 0.5, 0.04); });
    // 樹屋
    const h = k.spot(3, k.R * 0.8, 1.8);
    if (h) {
      const p = k.at(h[0], h[1], k.rand(0, TAU));
      p(k.S.cyl6, 0x8a5a36, 0, 2.6, 0, 0.32, 5.2, 0.32);
      p(k.S.box, 0xc8955e, 0, 3.2, 0, 2.6, 0.2, 2.6);
      p(k.S.box, 0xffe6c0, 0, 3.95, 0, 1.6, 1.3, 1.4);
      p(k.S.cone4, 0x6ab84a, 0, 5.0, 0, 1.4, 0.9, 1.3, Math.PI / 4);
      p(k.S.lump, 0x3fae55, 0, 6.0, 0, 1.8, 1.2, 1.8);
      [-0.3, 0.3].forEach((dx) => p(k.S.box, 0xa8784a, dx, 1.6, 1.5, 0.06, 3.3, 0.06, 0, -0.3));
      for (let i = 0; i < 6; i++) p(k.S.box, 0xa8784a, 0, 0.4 + i * 0.5, 1.15 + i * 0.15, 0.6, 0.05, 0.06, 0, -0.3);
    }
  },
  savanna(k) {
    // 岩丘上堆著大石頭
    (k.kopjes || []).forEach(([x, z]) => { for (let i = 0; i < 3; i++) k.part(k.S.dodeca, k.pick([0xd8b890, 0xc8a07a, 0xe0c098]), x + k.rand(-1.3, 1.3), 0.4, z + k.rand(-1.3, 1.3), k.rand(0.6, 1.2), k.rand(0.5, 0.9), k.rand(0.6, 1.1), k.rand(0, TAU)); k.obst.push({ x, z, r: 2 }); });
    // 獵遊吉普車繞著草原開
    const jeep = new THREE.Group(); jeep.userData.free = true;
    jeep.add(k.mesh(k.S.box, M(0x8fb85a), 0, 0.6, 0, 1.0, 0.5, 1.8), k.mesh(k.S.box, M(0xfff2d6), 0, 1.25, -0.25, 0.98, 0.06, 1.2));
    [[0.45, 0.35], [-0.45, 0.35], [0.45, -0.35], [-0.45, -0.35]].forEach(([x, y]) => jeep.add(k.mesh(k.S.cyl6, M(0x8fb85a), x, 0.95, y - 0.25, 0.03, 0.6, 0.03)));
    [[0.5, 0.6], [-0.5, 0.6], [0.5, -0.6], [-0.5, -0.6]].forEach(([x, z]) => { const w = k.mesh(k.S.cyl, M(0x3a3f63), x, 0.3, z, 0.28, 0.2, 0.28); w.rotation.z = Math.PI / 2; jeep.add(w); });
    const tire = k.mesh(k.S.torus, M(0x3a3f63), 0, 0.75, -1.0, 0.28, 0.28, 0.4); jeep.add(tire);
    const rr = k.R * 0.62;
    k.add(jeep, (t) => { const a = t * 0.16, x = Math.cos(a) * rr, z = Math.sin(a) * rr; jeep.position.set(x, k.ground(x, z), z); jeep.rotation.y = -a; });
  },
  desert(k) {
    // 駱駝
    const c = k.spot(3, k.R * 0.75, 1.6);
    if (c) {
      const p = k.at(c[0], c[1], k.rand(0, TAU)), col = 0xd8a868;
      p(k.S.ball, col, 0, 1.9, 0, 1.25, 0.7, 0.6);
      p(k.S.ball, col, 0.4, 2.5, 0, 0.42); p(k.S.ball, col, -0.45, 2.45, 0, 0.4);
      p(k.S.capsule, col, 1.15, 2.45, 0, 0.32, 0.9, 0.32, 0, 0, -0.55);
      p(k.S.ball, col, 1.6, 3.0, 0, 0.45, 0.28, 0.3);
      [[0.75, 0.3], [0.75, -0.3], [-0.75, 0.3], [-0.75, -0.3]].forEach(([x, z]) => p(k.S.cyl6, col, x, 0.8, z, 0.12, 1.6, 0.12));
      p(k.S.ball, 0x333344, 1.85, 3.08, 0.15, 0.05); p(k.S.ball, 0x333344, 1.85, 3.08, -0.15, 0.05);
      p(k.S.box, 0xff8a6b, 0, 2.3, 0, 0.9, 0.08, 1.25);
    }
    // 紅色的天然石拱
    const a = k.spot(4, k.R * 0.82, 1.8);
    if (a) { const p = k.at(a[0], a[1], k.rand(0, TAU)); p(k.S.arch, 0xd9805a, 0, 0, 0, 2.0, 2.6, 4.5); p(k.S.dodeca, 0xc86a4a, 1.9, 0.4, 0, 0.6); p(k.S.dodeca, 0xc86a4a, -1.9, 0.4, 0, 0.6); }
    // 台地頂上的仙人掌
    if (k.mesa) { k.cactus(k.mesa[0] + 0.6, k.mesa[1] - 0.4, 0.8); k.rock(k.mesa[0] - 0.8, k.mesa[1] + 0.6, 0.6, 0xd9805a); }
  },
  dino(k) {
    // 暴龍雕像
    const r = k.spot(3, k.R * 0.78, 2.2) || k.spot(2.5, k.R * 0.85, 1.6);
    if (r) {
      const p = k.at(r[0], r[1], k.rand(0, TAU), 1.1), col = 0x6fae5a;
      p(k.S.ball, col, 0, 2.6, 0, 1.6, 1.05, 0.9, 0, 0, 0.25);
      p(k.S.box, col, 1.7, 3.6, 0, 1.3, 0.8, 0.8); p(k.S.box, col, 1.75, 3.05, 0, 1.1, 0.25, 0.7);
      for (let i = 0; i < 4; i++) p(k.S.cone, 0xffffff, 1.3 + i * 0.25, 3.2, 0.3, 0.06, 0.18, 0.06, 0, Math.PI);
      p(k.S.ball, 0xffffff, 2.0, 3.85, 0.36, 0.12); p(k.S.ball, 0x222233, 2.05, 3.86, 0.42, 0.06);
      p(k.S.cone, col, -2.3, 2.5, 0, 0.6, 3, 0.6, 0, 0, Math.PI / 2 + 0.12);
      [0.45, -0.45].forEach((z) => { p(k.S.cyl, col, 0, 1.0, z, 0.32, 2, 0.32); p(k.S.box, col, 0.3, 0.1, z, 0.9, 0.2, 0.45); p(k.S.capsule, col, 1.1, 2.4, z * 0.9, 0.15, 0.35, 0.15, 0, 0, -0.8); });
    }
    pterosaur(k);
    // 化石崖的斜面上卡著骨頭和菊石
    if (k.cliff) {
      const [cx, cz] = k.cliff;
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * TAU + k.rand(-0.2, 0.2), d = k.rand(2.2, 3.2), x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
        if (i % 3 === 2) k.part(k.S.torus, 0xf6ecd8, x, 0.1, z, 0.45, 0.45, 0.7, -a + Math.PI / 2, 0.3);
        else { k.part(k.S.capsule, 0xfff6e6, x, 0.15, z, 0.22, 0.9, 0.22, -a, 0, Math.PI / 2 - 0.4); k.part(k.S.ball, 0xfff6e6, x + Math.cos(a) * 0.45, 0.3, z + Math.sin(a) * 0.45, 0.2); }
      }
      // 崖頂的小旗子：挖掘中
      k.part(k.S.cyl6, 0x9a6a46, cx, 0.9, cz, 0.05, 1.8, 0.05);
      k.part(k.S.box, 0xff5c5c, cx + 0.35, 1.55, cz, 0.6, 0.4, 0.04);
    }
    // 三趾腳印
    const fa = k.rand(0, TAU);
    for (let i = 0; i < 8; i++) {
      const d = -k.R * 0.5 + i * 1.3, x = Math.cos(fa) * d + Math.sin(fa) * (i % 2 ? 0.5 : -0.5), z = Math.sin(fa) * d - Math.cos(fa) * (i % 2 ? 0.5 : -0.5);
      if (!k.free(x, z, 0.3)) continue;
      [-0.5, 0, 0.5].forEach((sp) => k.part(k.S.disc, 0x5a8a4a, x + Math.cos(fa + sp) * 0.25, 0.04, z + Math.sin(fa + sp) * 0.25, 0.08, 0.6, 0.25, -(fa + sp) + Math.PI / 2));
    }
  },
  volcano(k) {
    // 溫泉（冒蒸汽）
    const h = k.spot(k.cone.W * 1.25, k.R * 0.85, 1.6);
    if (h) { k.pond(h[0], h[1], 1.1, 0x7fe0e0, 0xe0d0c0); smoke(k, h[0], 0.4, h[1], 0.5); }
    // 黑曜石和發光的熔岩石
    k.scatter(4, k.cone.W * 1.2, k.R * 0.9, 0.7, (x, z) => k.crystal(x, z, k.rand(0.5, 0.8), 0x3a3048));
    k.scatter(6, k.cone.W * 1.05, k.R * 0.9, 0.5, (x, z) => k.part(k.S.dodeca, 0xff9a4a, x, 0.2, z, 0.35));
  },
  ice(k) {
    aurora(k);
    k.scatter(5, 3, k.R * 0.85, 0.6, (x, z) => penguin(k, x, z, k.rand(0.9, 1.2)));
    const a = k.spot(3, k.R * 0.82, 1.8);
    if (a) { const p = k.at(a[0], a[1], k.rand(0, TAU)); p(k.S.arch, 0xbfe9ff, 0, 0, 0, 2.0, 2.4, 4.5); p(k.S.arch, 0xffffff, 0, 0.15, 0, 2.05, 2.45, 2.2); }
  },
  ocean(k) {
    const W = k.R * 0.8, WY = 0.7;
    // 潟湖裡的小沙洲：一個有小屋，其他種椰子樹
    (k.islets || []).forEach(([x, z], i) => {
      if (i === 0) { const p = k.at(x, z, k.rand(0, TAU)); p(k.S.box, 0xc8955e, 0, 0.5, 0, 1.2, 0.9, 1.0); p(k.S.cone4, 0xe8c070, 0, 1.3, 0, 1.1, 0.8, 1.0, Math.PI / 4); }
      else k.palm(x, z, 0.85);
    });
    // 沉船：一半露出水面
    const a = k.rand(0, TAU), x = Math.cos(a) * W * 0.66, z = Math.sin(a) * W * 0.66;
    if (k.free(x, z, 1.5)) {
      const p = k.at(x, z, a + 1.2);
      p(k.S.box, 0x8a5a36, 0, 0.9, 0, 1.4, 1.1, 3.6, 0, 0.18, 0.3);
      p(k.S.cyl6, 0x9a6a46, 0.4, 2.2, 0.4, 0.08, 2.8, 0.08, 0, 0.3, -0.5);
      p(k.S.box, 0xfff4dc, 0.7, 2.6, 0.55, 0.04, 1.2, 0.9, 0, 0.3, -0.5);
      k.obst.push({ x, z, r: 1.8 });
    }
    turtle(k, W, WY);
    // 浮標
    for (let i = 0; i < 3; i++) {
      const b = new THREE.Group(); b.userData.free = true;
      b.add(k.mesh(k.S.cyl, M(i % 2 ? 0xffffff : 0xff5c5c), 0, 0.25, 0, 0.22, 0.5, 0.22), k.mesh(k.S.cone, M(0xff5c5c), 0, 0.65, 0, 0.18, 0.3, 0.18));
      const ba = i * 2.1 + 0.5, bx = Math.cos(ba) * W * 0.85, bz = Math.sin(ba) * W * 0.85;
      k.add(b, (t) => { b.position.set(bx, WY - 0.1 + Math.sin(t * 1.5 + i) * 0.08, bz); b.rotation.z = Math.sin(t + i) * 0.15; });
    }
  },
  wetland(k) {
    // 地形小水塘上的荷葉，還有一座石拱橋
    k.noGround = true;
    (k.ponds || []).forEach(([px, pz], j) => {
      for (let i = 0; i < 5; i++) { const a = k.rand(0, TAU), d = k.rand(0, 1.1); k.part(k.S.disc, 0x5fbf5a, px + Math.cos(a) * d, k.water + 0.05, pz + Math.sin(a) * d, k.rand(0.3, 0.5), 1, k.rand(0.3, 0.5)); }
      if (j === 0) { const ry = k.rand(0, TAU); k.part(new THREE.TorusGeometry(2.2, 0.3, 6, 16, Math.PI), 0xb8b0a8, px, k.water, pz, 1, 0.7, 2.5, ry); }
    });
    k.noGround = false;
    (k.ponds || []).forEach(([px, pz]) => { const a = k.rand(0, TAU); const x = px + Math.cos(a) * 2.4, z = pz + Math.sin(a) * 2.4; if (k.free(x, z, 0.4) && k.usable(x, z, 0.4)) heron(k, x, z); });
    dragonflies(k, 5);
  },
  zoo(k) {
    const c = k.spot(3.5, k.R * 0.62, 2.6);
    if (c) carousel(k, c[0], c[1]);
    // 河馬的小池塘
    const p = k.spot(4, k.R * 0.75, 1.8);
    if (p) { k.pond(p[0], p[1], 1.4); k.part(k.S.dodeca, 0xb8b0a8, p[0] + 1.4, 0.3, p[1], 0.5); }
  },
  sky(k) {
    kites(k, 3);
    k.scatter(2, 4, k.R * 0.75, 0.8, (x, z) => turbine(k, x, z));
  },
  body(k) {
    k.scatter(3, 3, k.R * 0.8, 1.2, (x, z) => neuron(k, x, z));
    // 會左看右看的大眼睛雕像
    const e = k.spot(3, k.R * 0.75, 1.2);
    if (e) {
      k.part(k.S.cyl, 0xffe6ee, e[0], 0.5, e[1], 0.7, 1, 0.7);
      const eye = new THREE.Group(); eye.position.set(e[0], 1.9, e[1]);
      eye.add(k.mesh(k.S.ball, M(0xffffff, { flat: false, rough: 0.3 }), 0, 0, 0, 0.9));
      eye.add(k.mesh(k.S.ball, M(0x5cb8ff, { flat: false }), 0, 0, 0.72, 0.42, 0.42, 0.25), k.mesh(k.S.ball, M(0x222233, { flat: false }), 0, 0, 0.86, 0.2, 0.2, 0.15));
      k.add(eye, (t) => { eye.rotation.y = Math.sin(t * 0.6) * 0.8; eye.rotation.x = Math.sin(t * 0.37) * 0.2; });
    }
  },
  atom(k) {
    const l = k.spot(4, k.R * 0.8, 1.8);
    if (l) lattice(k, l[0], l[1]);
    molecules(k);
  },
  force(k) {
    const c = k.spot(3, k.R * 0.8, 3.4);
    if (c) coaster(k, c[0], c[1]);
    const n = k.spot(3, k.R * 0.8, 1.4);
    if (n) cradle(k, n[0], n[1]);
  },
  lightning(k) {
    powerLine(k);
    k.scatter(4, 3, k.R * 0.85, 0.9, (x, z) => { const p = k.at(x, z, k.rand(0, TAU)); p(k.S.cyl6, 0xb8c2d6, 0, 0.5, 0, 0.06, 1, 0.06); p(k.S.box, 0x2c4a9a, 0, 1.05, 0, 1.4, 0.06, 0.9, 0, -0.5); p(k.S.box, 0x9fdcff, 0, 1.08, 0, 1.3, 0.02, 0.05, 0, -0.5); });
    stormCloud(k);
  },
  scientists(k) {
    const t = k.spot(4, k.R * 0.82, 1.6);
    if (t) pisa(k, t[0], t[1]);
    // 地球儀
    const g = k.spot(3, k.R * 0.8, 0.8);
    if (g) {
      k.part(k.S.cyl6, 0x9a6a46, g[0], 0.5, g[1], 0.08, 1, 0.08); k.part(k.S.torus, 0xc8963c, g[0], 1.5, g[1], 0.62, 0.62, 0.6);
      const globe = new THREE.Group(); globe.position.set(g[0], 1.5, g[1]);
      globe.add(k.mesh(k.S.ball, M(0x5cb8ff, { flat: false }), 0, 0, 0, 0.55));
      [[0.3, 0.2, 0.4], [-0.35, -0.1, 0.35], [0.1, -0.35, 0.3]].forEach(([x, y, s]) => globe.add(k.mesh(k.S.blob, M(0x6cd86a), x, y, 0.38, s, s * 0.7, 0.25)));
      k.add(globe, (tt) => { globe.rotation.y = tt * 0.5; });
    }
  },
  city(k) {
    monorail(k);
    if (k.park) for (let i = 0; i < 5; i++) { const x = k.park[0] + k.rand(-2, 2), z = k.park[1] + k.rand(-2, 2); if (k.free(x, z, 0.8)) k.tree(x, z, k.rand(0.7, 1)); }
  },
  flight(k) {
    airship(k);
    // 航廈：長長的玻璃大樓
    const ra = k.ra, d = -5.2, along = 4.5;
    const x = Math.cos(ra) * d + Math.sin(ra) * along, z = -Math.sin(ra) * d + Math.cos(ra) * along;
    if (k.free(x, z, 2)) {
      const p = k.at(x, z, ra);
      p(k.S.box, 0xf6f8ff, 0, 1.0, 0, 2.2, 2, 4.5); p(k.S.box, 0x9fdcff, 1.12, 1.2, 0, 0.05, 1.0, 4.2);
      p(k.S.cyl, 0xdfe6f2, 0, 2.1, 0, 1.2, 0.2, 2.3, 0, 0, Math.PI / 2);
      p(k.S.box, 0xdfe6f2, 1.9, 1.2, 1.2, 1.6, 0.6, 0.6);
      k.block(x, z, 2.4);
    }
  },
  moon(k) {
    const b = k.spot(3, k.R * 0.75, 3.2);
    if (b) moonBase(k, b[0], b[1]);
    const a = k.spot(3, k.R * 0.8, 0.9);
    if (a) astronaut(k, a[0], a[1]);
  },
  planets(k) { asteroidBelt(k); },
  stars(k) {
    k.scatter(3, k.R * 0.45, k.R * 0.85, 1.6, (x, z) => radioDish(k, x, z));
    k.scatter(5, 2, k.R * 0.85, 0.4, (x, z) => { k.part(k.S.cyl6, 0xb8a6f0, x, 0.8, z, 0.05, 1.6, 0.05); k.part(k.S.octa, 0xfff08a, x, 1.8, z, 0.3, 0.45, 0.3); });
  },
};

// ---------- 補細節：踏腳石小路、站牌、每種島自己的小東西 ----------
const FILL = {
  studio: (k, x, z) => (k.r() < 0.5 ? k.flowers(x, z, 4, 0.6) : k.bush(x, z, 0.6)),
  rainforest: (k, x, z) => (k.r() < 0.5 ? k.flowers(x, z, 3, 0.5, [0xff5c8a, 0xffd25a]) : k.mushroom(x, z, 0.7, 0xff8a3c)),
  savanna: (k, x, z) => (k.r() < 0.6 ? k.tuft(x, z, 1.4, 0xe0b850) : k.rock(x, z, 0.5, 0xd8b890)),
  desert: (k, x, z) => (k.r() < 0.5 ? k.cactus(x, z, 0.6) : k.rock(x, z, 0.45, 0xe8a878)),
  dino: (k, x, z) => (k.r() < 0.5 ? k.part(k.S.ball, k.pick([0xfff2dc, 0xe6f4ff]), x, 0.35, z, 0.3, 0.42, 0.3) : k.bush(x, z, 0.7, 0x4cae5a)),
  stoneage: (k, x, z) => (k.r() < 0.5 ? k.rock(x, z, k.rand(0.35, 0.6), 0xa89078) : k.tuft(x, z, 1.2, 0xb0c86a)),
  volcano: (k, x, z) => (k.r() < 0.5 ? k.rock(x, z, 0.5, 0xb8a090) : k.crystal(x, z, 0.5, k.pick([0xb98cff, 0x7cc8ff, 0xff8ab8]))),
  ice: (k, x, z) => (k.r() < 0.5 ? k.part(k.S.half, 0xffffff, x, 0, z, 0.9, 0.5, 0.9) : k.part(k.S.cone6, 0xbfe9ff, x, 0.6, z, 0.3, 1.2, 0.3, k.rand(0, 1))),
  wetland: (k, x, z) => (k.r() < 0.5 ? k.flowers(x, z, 4, 0.6) : k.mushroom(x, z, 0.6)),
  zoo: (k, x, z) => (k.r() < 0.5 ? k.flowers(x, z, 3, 0.5) : k.bush(x, z, 0.6)),
  sky: (k, x, z) => { k.part(k.S.blob, 0xffffff, x, 0.35, z, 0.7, 0.5, 0.7); if (k.r() < 0.3) k.part(k.S.cone, 0xffd25a, x, 1.2, z, 0.25, 0.5, 0.25, 0, Math.PI); },
  body: (k, x, z) => (k.r() < 0.5 ? k.part(k.S.torus, 0xff6a7a, x, 0.2, z, 0.4, 0.4, 0.55, 0, Math.PI / 2) : k.bush(x, z, 0.6, k.pick([0xff9ab8, 0xffb6ca]))),
  atom: (k, x, z) => (k.r() < 0.5 ? k.crystal(x, z, 0.5, k.pick([0x7cc8ff, 0xff8ab8, 0x9ae8b8])) : k.part(k.S.ball, k.pick([0xff7a7a, 0x7ab8ff, 0x5fdcc0]), x, 0.35, z, 0.35)),
  force: (k, x, z) => (k.r() < 0.5 ? k.part(k.S.ball, k.pick([0xff5c7a, 0x5cb8ff, 0xffd25a]), x, 0.4, z, 0.4) : k.part(k.S.torus, 0xb8c2d6, x, 0.6, z, 0.35, 0.35, 0.9, 0, Math.PI / 2)),
  lightning: (k, x, z) => (k.r() < 0.5 ? k.crystal(x, z, 0.55, 0xfff08a) : k.part(k.S.ball, 0xfff2a0, x, 0.35, z, 0.3)),
  scientists: (k, x, z) => (k.r() < 0.5 ? k.flowers(x, z, 3, 0.5) : [0xff8a6b, 0x6cb8ff, 0x5fcfa0].forEach((c, i) => k.part(k.S.box, c, x, 0.12 + i * 0.22, z, 0.8 - i * 0.05, 0.2, 0.55, i * 0.3))),
  city: (k, x, z) => (k.r() < 0.5 ? k.bush(x, z, 0.5) : k.part(k.S.cyl, 0xff5c5c, x, 0.35, z, 0.18, 0.7, 0.18)),
  flight: (k, x, z) => (k.r() < 0.5 ? k.part(k.S.cone, 0xff8a3c, x, 0.35, z, 0.25, 0.7, 0.25) : k.part(k.S.cyl, 0x5c8ad8, x, 0.45, z, 0.35, 0.9, 0.35)),
  moon: (k, x, z) => k.rock(x, z, k.rand(0.3, 0.6), k.pick([0xd2d6e2, 0xc2c6d4])),
  planets: (k, x, z) => { k.part(k.S.cyl6, 0xe8d8c0, x, 0.6, z, 0.05, 1.2, 0.05); k.part(k.S.ball, k.pick([0xff7a5c, 0x5cb8ff, 0xf6d89a, 0x9ae8f0]), x, 1.3, z, 0.3); },
  stars: (k, x, z) => (k.r() < 0.5 ? k.crystal(x, z, 0.55, k.pick([0xb98cff, 0x8cb8ff, 0xff9ad8])) : k.part(k.S.octa, 0xfff08a, x, 0.5, z, 0.3, 0.5, 0.3)),
};
function details(k, def, biome, pad) {
  const R = k.R;
  if (def.biome !== 'ocean' && def.biome !== 'sky') {
    // 從停機坪彎彎地走到島中間的踏腳石
    const stone = def.biome === 'ice' || def.biome === 'moon' ? 0xdfe6f2 : 0xf6ecd8;
    const n = Math.round(Math.hypot(pad.x, pad.z) / 1.3);
    for (let i = 1; i < n - 1; i++) {
      const t = i / n, wig = Math.sin(t * Math.PI) * 2.2;
      const x = pad.x * (1 - t) - (pad.z / Math.hypot(pad.x, pad.z)) * wig, z = pad.z * (1 - t) + (pad.x / Math.hypot(pad.x, pad.z)) * wig;
      k.part(k.S.disc, stone, x, 0.08, z, 0.45, 0.6, 0.38, k.rand(0, TAU));
    }
  }
  // 每種島自己的小東西，補在空地上（小小的，不擋路）
  const fill = FILL[def.biome];
  if (fill) for (let i = 0; i < Math.round(R * 1.1); i++) { const p = k.spot(2, R * 0.9, 0.5, 12); if (p) fill(k, p[0], p[1]); }
  // 停機坪旁邊的站牌，寫著島的名字
  const sa = pad.a + 0.55, sx = Math.cos(sa) * Math.hypot(pad.x, pad.z), sz = Math.sin(sa) * Math.hypot(pad.x, pad.z);
  k.part(k.S.box, 0x9a6a46, sx, 1.1 + pad.lift, sz, 0.18, 2.2, 0.18);
  const tex = signTexture(def.emoji, def.name);
  const w = 1.2 * (tex.image.width / tex.image.height);
  const board = new THREE.Mesh(new THREE.PlaneGeometry(w, 1.2), new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide }));
  board.position.set(sx, 2.5 + pad.lift, sz);
  board.rotation.y = Math.atan2(sx, sz);
  k.add(board);
}

/**
 * 蓋一座島。回傳 { group, ticks, walk: 可以走的點, walkY, swim, pad: 火箭停的位置 }。
 * group 的原點是島心、地面高度 0。
 */
export function buildIsland(def, R) {
  const k = new Kit(def, R);
  const biome = BIOMES[def.biome] || BIOMES.studio;
  // 火箭停機坪：在島的邊邊，先佔好位置
  const sea = def.biome === 'ocean'; // 深海島中間是水，停機坪放在沙岸上
  const padA = (hash(def.id) * 7) % TAU, padD = R * (sea ? 0.9 : 0.72), padY = sea ? 0.85 : 0;
  const pad = { x: Math.cos(padA) * padD, z: Math.sin(padA) * padD, y: padY, a: padA };
  // 地形先決定，停機坪那塊整平，之後放的東西都站在地形上
  const special = TERRAIN[def.biome]?.(k);
  const padG = Math.max(0, Math.min(1.5, k.ground(pad.x, pad.z)));
  k.flat(pad.x, pad.z, 3, padG, 2);
  k.block(pad.x, pad.z, 2.6, false);
  pad.y = padY + padG; pad.lift = padY;
  const base = def.biome === 'sky' ? cloudBase(k) : baseRock(k, biome);
  (BUILD[def.biome] || BUILD.studio)(k);
  EXTRA[def.biome]?.(k);
  details(k, def, biome, pad);
  // 停機坪本體
  k.part(k.S.cyl, 0xdfe4ef, pad.x, 0.15 + padY / 2, pad.z, 2.3, 0.3 + padY, 2.3);
  k.part(k.S.torus, 0xffc25a, pad.x, 0.32 + padY, pad.z, 1.7, 1.7, 0.6, 0, Math.PI / 2);
  k.part(k.S.box, 0xb8c2d6, pad.x + Math.cos(padA) * 2.5, 2 + padY, pad.z + Math.sin(padA) * 2.5, 0.25, 4, 0.25);
  k.part(k.S.box, 0xb8c2d6, pad.x + Math.cos(padA) * 1.9, 3.6 + padY, pad.z + Math.sin(padA) * 1.9, 1.2, 0.2, 0.2, -padA);
  k.solid.push(terrainMesh(k, biome, special));
  if (k.water != null) {
    // 地形低下去的地方（湖、河、水塘）放一片水
    const w = new THREE.Mesh(new THREE.CircleGeometry(R * 0.84, 48).rotateX(-Math.PI / 2), M(k.waterColor ?? PALETTE.water, { opacity: 0.82, rough: 0.25, flat: false }));
    w.position.y = k.water; w.userData.free = true; w.renderOrder = 1;
    k.add(w);
  }
  const group = new THREE.Group();
  const all = [...base, ...k.solid];
  group.add(mergeStatic(all, { roughness: 0.85 }));
  all.forEach((m) => { if (m.userData.own) m.geometry.dispose(); });
  group.add(k.live);
  // 居民可以走的點：在空地上撒一些點，居民在附近的點之間散步
  const walk = [];
  for (let i = 0; i < 400 && walk.length < 70; i++) {
    const a = k.r() * TAU, d = Math.sqrt(k.r()) * k.walkR;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (k.swim ? k.ground(x, z) < k.walkY - 0.35 : k.free(x, z, 0.9) && k.usable(x, z, 0.6, 0.6)) walk.push([x, z]);
  }
  if (walk.length < 6) for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; walk.push([Math.cos(a) * k.walkR * 0.9, Math.sin(a) * k.walkR * 0.9]); }
  return { group, live: k.live, ticks: k.ticks, walk, walkY: k.walkY, swim: !!k.swim, pad, depth: R * 1.2 + 1.5,
    ground: (x, z) => k.ground(x, z),
    // 居民走過去的路上能不能走（不穿過房子、不走進湖裡）
    canWalk: (x, z) => (Math.hypot(x, z) < k.walkR + 1) && (k.swim ? k.ground(x, z) < k.walkY - 0.25 : k.free(x, z, 0.4) && k.usable(x, z, 0.5, 0.8)) };
}
