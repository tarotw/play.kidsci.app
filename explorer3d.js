// 宇宙好好聽：3D 探索畫面（Three.js r170，跟 lab.kidsci.app/solar-system 同一套技術）。
// 介面跟 explorer.js（2D 版）一樣；沒有 WebGL 的裝置由 app.js 改用 2D 版。
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { buildScene, iconFor, Sound, hash, rng, THEMES } from './explorer.js';
import { SOFT, TAU, NOISE, pointsMaterial, makePoints, fresnelMaterial, flowMaterial, textureCache, cached, glowTexture, EMOJI_FONT, labelTexture, ring, glowSprite, mergeStatic } from './kit3d.js';
import { createChannelField } from './channels3d.js';
import * as fx from './fx3d.js';
import * as heroes from './heroes3d.js';

const S = 0.1; // 2D 版面單位 → 3D 單位
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// ---------- 各格的主視覺 ----------
function makeStarCluster() {
  const g = new THREE.Group();
  const r = rng(0.21);
  g.add(makePoints(700, (i, c) => {
    const a = r() * TAU, d = 8 + Math.pow(r(), 0.6) * 70, h = (r() - 0.5) * 30;
    c.setHSL(0.55 + r() * 0.2, 0.8, 0.7);
    if (r() < 0.15) c.setHSL(0.08, 0.9, 0.65);
    return { pos: [Math.cos(a) * d, h + 6, Math.sin(a) * d], size: 1 + r() * 3 };
  }, { scale: 400, gain: 0.5 }));
  [0xbfd8ff, 0xffe0a0, 0xff9a7a, 0xa0c0ff, 0xffffff, 0xffd0ff].forEach((c, i) => {
    const s = glowSprite(c, 8 + r() * 8, 0.7);
    s.position.set((r() - 0.5) * 70, 6 + (r() - 0.5) * 16, (r() - 0.5) * 60);
    g.add(s);
  });
  g.userData.tick = (t) => { g.rotation.y = t * 0.02; };
  return g;
}
function makeGalaxy() {
  const g = new THREE.Group();
  const r = rng(0.63);
  const count = matchMedia('(max-width: 700px)').matches ? 16000 : 30000;
  const core = new THREE.Color(0.95, 0.82, 0.66), arm = new THREE.Color(0.6, 0.66, 0.95), pink = new THREE.Color(0.95, 0.66, 0.85);
  g.add(makePoints(count, (i, c) => {
    const armI = i % 3, t = Math.pow(r(), 0.7);
    const d = t * 90;
    const a = t * 7.5 + armI * (TAU / 3);
    const spread = (1 - t * 0.6) * 9 * (r() - 0.5);
    c.copy(core).lerp(r() < 0.1 ? pink : arm, Math.min(1, t * 1.4));
    return { pos: [Math.cos(a) * d + spread, (r() - 0.5) * (4 - t * 3), Math.sin(a) * d + spread], size: 1 + r() * 2.5 };
  }, { scale: 380, gain: 0.24 }));
  g.add(glowSprite(0xf5dcb8, 30, 0.6), glowSprite(0xe6c0f0, 90, 0.12));
  g.userData.tick = (t) => { g.rotation.y = -t * 0.03; };
  return g;
}
function makeCosmicWeb() {
  const g = new THREE.Group();
  const r = rng(0.91);
  const nodes = Array.from({ length: 60 }, () => new THREE.Vector3((r() - 0.5) * 220, (r() - 0.5) * 60, (r() - 0.5) * 180));
  const seg = [];
  nodes.forEach((a, i) => nodes.slice(i + 1).forEach((b) => { if (a.distanceTo(b) < 55) seg.push(a.x, a.y, a.z, b.x, b.y, b.z); }));
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.Float32BufferAttribute(seg, 3));
  g.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0xb8a8e8, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending })));
  g.add(makePoints(5000, (i, c) => {
    const n = nodes[i % nodes.length];
    const spread = 2 + Math.pow(r(), 3) * 14;
    c.setHSL(0.75 + r() * 0.15, 0.8, 0.7);
    return { pos: [n.x + (r() - 0.5) * spread, n.y + (r() - 0.5) * spread, n.z + (r() - 0.5) * spread], size: 1 + r() * 3 };
  }, { scale: 500, gain: 0.4 }));
  g.add(glowSprite(0xf0e6ff, 24, 0.5));
  g.userData.tick = (t) => { g.rotation.y = t * 0.015; };
  return g;
}
function makeTimeRiver(sc) {
  const g = new THREE.Group();
  if (sc.groups.length < 2) return g;
  const pts = sc.groups.map((z, i) => new THREE.Vector3(z.x * S, Math.sin(i * 1.7) * 1.5, z.y * S));
  const curve = new THREE.CatmullRomCurve3(pts);
  const mat = flowMaterial(0xffa640, 0.5, 26);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 200, 0.9, 12, false), mat));
  g.userData.tick = (t) => { mat.uniforms.time.value = t; };
  return g;
}
function makeLanes(sc) {
  const g = new THREE.Group();
  const mats = [];
  sc.groups.forEach((z) => {
    const end = new THREE.Vector3(z.x * S, 0.6, z.y * S);
    const mid = end.clone().multiplyScalar(0.5).add(new THREE.Vector3(-end.z * 0.25, 8, end.x * 0.25));
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 4, 0), mid, end);
    const mat = flowMaterial(z.color || '#ffffff', 0.7, 12);
    mats.push(mat);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 80, 0.5, 10, false), mat));
  });
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(3, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.95, 0.93, 1.0), wireframe: true, transparent: true, opacity: 0.7 }));
  core.position.y = 4;
  g.add(core, glowSprite(0xcfeee8, 20, 0.6));
  g.children[g.children.length - 1].position.y = 4;
  g.userData.tick = (t) => { mats.forEach((m) => { m.uniforms.time.value = t; }); core.rotation.set(t * 0.3, t * 0.4, 0); };
  return g;
}
// 生物格：每一區是一座浮空島
const BIOMES = {
  台灣特有種: { top: 0x3f9d4a, deco: 'trees', tint: 0x2c7a3a },
  珊瑚礁: { top: 0x3fc6e0, deco: 'coral', water: true },
  海洋與深海: { top: 0x1f6fb8, deco: 'waves', water: true },
  雨林: { top: 0x2f8a3a, deco: 'trees' },
  莽原: { top: 0xc8b04a, deco: 'acacia' },
  沙漠: { top: 0xe0b878, deco: 'cactus' },
  極地與高山: { top: 0xeaf4ff, deco: 'ice' },
  天空: { top: 0x9fd8ff, deco: 'clouds', high: true },
  淡水與濕地: { top: 0x4aa88a, deco: 'reeds', water: true },
  植物園: { top: 0x5cbf4a, deco: 'flowers' },
  動物大觀園: { top: 0x6fbf5a, deco: 'mixed' },
  也會經過這裡: { top: 0x8aa0c8, deco: 'mixed' },
};
let islandShapes = null;
function islandParts() {
  if (!islandShapes) {
    islandShapes = {
      cone7: new THREE.ConeGeometry(1, 1, 7), cone5: new THREE.ConeGeometry(1, 1, 5),
      trunk: new THREE.CylinderGeometry(0.12, 0.18, 1, 6), crown: new THREE.CylinderGeometry(1, 0.71, 1, 8),
      cactus: new THREE.CapsuleGeometry(0.35, 1.6, 4, 8), coral: new THREE.TorusKnotGeometry(0.4, 0.15, 40, 6),
      reed: new THREE.CylinderGeometry(0.05, 0.08, 1.8, 4), flower: new THREE.SphereGeometry(0.35, 8, 6),
      cloud: new THREE.SphereGeometry(1, 12, 8), wave: new THREE.TorusGeometry(0.8, 0.12, 6, 18, Math.PI),
    };
  }
  return islandShapes;
}
function makeIsland(z, radius) {
  const b = BIOMES[z.name] || BIOMES.動物大觀園;
  const g = new THREE.Group();
  const rock = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 0.55, 3.2, 9, 1), new THREE.MeshStandardMaterial({ color: 0x6b5236, flatShading: true, roughness: 1 }));
  rock.position.y = -1.6;
  const under = new THREE.Mesh(new THREE.ConeGeometry(radius * 0.55, radius * 0.9, 9), new THREE.MeshStandardMaterial({ color: 0x4a3826, flatShading: true }));
  under.rotation.x = Math.PI; under.position.y = -3.2 - radius * 0.45;
  const top = new THREE.Mesh(new THREE.CylinderGeometry(radius * 1.02, radius * 1.02, 0.5, 9), new THREE.MeshStandardMaterial({ color: b.top, flatShading: true, roughness: 0.9 }));
  top.position.y = 0.1;
  const solid = [rock, under, top]; // 不透明的部分最後合成一個網格
  if (b.water) {
    const water = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.8, radius * 0.8, 0.2, 24), new THREE.MeshStandardMaterial({ color: 0x46c8ff, emissive: 0x0a4a7a, transparent: true, opacity: 0.85, roughness: 0.1, metalness: 0.2 }));
    water.position.y = 0.42;
    g.add(water, fx.makeWaterfall(radius * 0.99, hash(z.name) * TAU, 13));
  }
  const r = rng(hash(z.name));
  const edge = () => { const a = r() * TAU, d = radius * (0.78 + r() * 0.2); return [Math.cos(a) * d, Math.sin(a) * d]; };
  const U = islandParts();
  // 裝飾只拿來合併，不會直接畫出來：共用基本形狀，用縮放變出大小
  const add = (geo, color, x, zz, y, sx = 1, sy = sx, sz = sx, emissive = null, rotY = 0) => {
    const m = new THREE.Mesh(geo, { color: new THREE.Color(color), emissive: emissive == null ? null : new THREE.Color(emissive) });
    m.userData.shared = true;
    m.position.set(x, y, zz);
    m.scale.set(sx, sy, sz);
    m.rotation.y = rotY;
    solid.push(m);
  };
  const n = Math.round(6 + radius * 0.6);
  for (let i = 0; i < n; i++) {
    const [x, zz] = edge();
    switch (b.deco) {
      case 'trees': case 'mixed': {
        const h = 2 + r() * 2.5, w = 0.9 + r() * 0.5;
        add(U.cone7, b.tint || (r() > 0.5 ? 0x2e9a44 : 0x1f7a36), x, zz, 0.35 + h / 2, w, h, w);
        break;
      }
      case 'acacia':
        add(U.trunk, 0x6b4a2a, x, zz, 1.3, 1, 2, 1);
        add(U.crown, 0x5a8a2a, x, zz, 2.4, 1.4, 0.4, 1.4);
        break;
      case 'cactus': add(U.cactus, 0x3f9a4a, x, zz, 1.4, 1, 1 + r() * 0.5, 1); break;
      case 'ice': {
        const h = 1.5 + r() * 3, w = 0.6 + r() * 0.4;
        add(U.cone5, 0xdff4ff, x, zz, 0.35 + h / 2, w, h, w, 0x204060);
        break;
      }
      case 'coral': add(U.coral, [0xff7aa8, 0xffb15a, 0xb47aff][i % 3], x, zz, 0.9, 1, 1, 1, 0x401020, r() * TAU); break;
      case 'reeds': add(U.reed, 0x8aa84a, x, zz, 1.2); break;
      case 'flowers': add(U.flower, [0xff6fa0, 0xffe05a, 0xffffff, 0xb07aff][i % 4], x, zz, 0.7, 1, 1, 1, 0x302010); break;
      case 'clouds': add(U.cloud, 0xffffff, x * 1.1, zz * 1.1, -2 - r() * 2, 1 + r(), undefined, undefined, 0x405060); break;
      case 'waves': add(U.wave, 0xbff0ff, x, zz, 0.6, 1, 1, 1, 0x206080, r() * TAU); break;
      default: break;
    }
  }
  g.add(mergeStatic(solid));
  g.userData.baseY = b.high ? 7 : 0;
  g.userData.topY = b.water ? 0.6 : 0.4;
  return g;
}

function makeOcean() {
  const geo = new THREE.PlaneGeometry(2400, 2400, 90, 90);
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x0a4a6a, emissive: 0x03202f, roughness: 0.62, metalness: 0.15, flatShading: true, transparent: true, opacity: 0.92 }));
  mesh.position.y = -14;
  const uTime = { value: 0 };
  mesh.material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uTime;
    shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\ntransformed.y += sin(position.x * 0.02 + uTime) * 1.6 + cos(position.z * 0.017 + uTime * 0.8) * 1.6;');
  };
  mesh.material.customProgramCacheKey = () => 'ocean-waves';
  mesh.userData.tick = (t) => { uTime.value = t; };
  return mesh;
}

function makeCity(z, radius) {
  const g = new THREE.Group();
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 0.4, 6), new THREE.MeshStandardMaterial({ color: 0x1c2240, emissive: 0x05070f }));
  const glowRing = ring(radius, 0xf3c29a, 0.45, 0.1);
  glowRing.position.y = 0.25;
  g.add(glowRing);
  const solid = [pad];
  const edgePos = [];
  const r = rng(hash(z.name));
  const edgeMat = new THREE.LineBasicMaterial({ color: r() > 0.5 ? 0xa8dcd2 : 0xf3c29a, transparent: true, opacity: 0.55 });
  const n = Math.round(6 + radius * 0.5);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + r() * 0.3, d = radius * (0.75 + r() * 0.2);
    const h = 2 + r() * 9, w = 0.8 + r() * 1.2;
    const box = new THREE.BoxGeometry(w, h, w);
    const b = new THREE.Mesh(box, new THREE.MeshStandardMaterial({ color: 0x161a34, emissive: 0x080a18 }));
    b.position.set(Math.cos(a) * d, h / 2, Math.sin(a) * d);
    const edges = new THREE.EdgesGeometry(box);
    edges.translate(b.position.x, b.position.y, b.position.z);
    edgePos.push(...edges.attributes.position.array);
    edges.dispose();
    solid.push(b);
  }
  g.add(mergeStatic(solid, { roughness: 0.6 }));
  const lines = new THREE.BufferGeometry();
  lines.setAttribute('position', new THREE.Float32BufferAttribute(edgePos, 3));
  g.add(new THREE.LineSegments(lines, edgeMat));
  g.userData.topY = 0.3;
  return g;
}

// ---------- 耳機號 ----------
function makeShip() {
  const g = new THREE.Group();
  const orange = new THREE.MeshStandardMaterial({ color: 0xf0b07a, emissive: 0x4a2a14, metalness: 0.2, roughness: 0.45 });
  const blue = new THREE.MeshStandardMaterial({ color: 0x4a5f8a, emissive: 0x141c30, metalness: 0.25, roughness: 0.5 });
  const band = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.2, 12, 40, Math.PI), orange);
  band.position.y = 0.2;
  g.add(band);
  [-1, 1].forEach((side) => {
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.55, 24), blue);
    cup.rotation.z = Math.PI / 2;
    cup.position.set(side * 1.3, 0, 0);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.08, 8, 24), new THREE.MeshStandardMaterial({ color: 0xa8e0d6, emissive: 0xa8e0d6, emissiveIntensity: 0.4, roughness: 0.4 }));
    rim.rotation.y = Math.PI / 2;
    rim.position.set(side * 1.6, 0, 0);
    g.add(cup, rim);
  });
  const glow = glowSprite(0xf5c29a, 7, 0.35);
  g.add(glow);
  const loader = new THREE.TextureLoader();
  const riders = {};
  [['captain', -0.62], ['curious', 0.62]].forEach(([who, x]) => {
    const tex = loader.load(`assets/avatar-${who}.png`);
    tex.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, toneMapped: false }));
    s.scale.set(1.15, 1.15, 1);
    s.position.set(x, 0.95, 0.25);
    s.userData.baseY = 0.95;
    g.add(s);
    riders[who] = s;
  });
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.8, 16, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.68, 0.45), transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false }));
  flame.rotation.x = -Math.PI / 2;
  flame.position.set(0, -0.1, -1.3);
  g.add(flame);
  g.userData = { riders, flame };
  g.scale.setScalar(1.6);
  return g;
}

// ---------- 主程式 ----------
export function createExplorer({ canvas, world, episodes, getStamps, onPick, onReady = () => {} }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene3 = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 6000);
  scene3.add(camera);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.screenSpacePanning = false;
  controls.maxPolarAngle = 1.32;
  controls.minDistance = 6;
  controls.maxDistance = 420;
  controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
  controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE };
  controls.zoomToCursor = true;
  const fixedQuality = new URLSearchParams(location.search).has('hq');
  const debug = new URLSearchParams(location.search).has('debug'); // ?debug：角落顯示每秒格數與繪圖次數
  const stats = { fps: 0, frameMs: 0, worstMs: 0, buildMs: 0, errors: 0 };

  // 光暈後製只在桌機開：手機上柔光效果不明顯，卻要多畫好幾層全螢幕、多編 9 個 shader。
  // 不開的時候直接畫到螢幕，還能用上瀏覽器的抗鋸齒。?bloom 可以在手機上強制打開。
  const coarse = matchMedia('(pointer: coarse)').matches;
  let useBloom = !coarse || new URLSearchParams(location.search).has('bloom');
  let composer = null;
  let bloom = null;
  function ensureComposer() {
    if (composer || !useBloom) return;
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene3, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.3, 0.9, 0.9);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
  }
  ensureComposer();

  const hemi = new THREE.HemisphereLight(0xbfdcff, 0x1a1020, 0.9);
  const sunLight = new THREE.DirectionalLight(0xffffff, 1.6);
  sunLight.position.set(60, 90, 40);
  const centerLight = new THREE.PointLight(0xffd0a0, 2, 0, 0);
  centerLight.position.set(0, 10, 0);
  scene3.add(hemi, sunLight, centerLight);

  // 星空穹頂與遠方星雲（所有格共用）
  const r0 = rng(0.5);
  const stars = makePoints(matchMedia('(max-width: 700px)').matches ? 3500 : 7000, (i, c) => {
    const u = r0() * 2 - 1, a = r0() * TAU, d = 900 + r0() * 900;
    const s = Math.sqrt(1 - u * u);
    c.setHSL(0.55 + r0() * 0.15, 0.4, 0.85);
    return { pos: [Math.cos(a) * s * d, u * d, Math.sin(a) * s * d], size: 2 + r0() * 4 };
  }, { scale: 900 });
  scene3.add(stars);
  const sky3 = fx.createSky(renderer);
  scene3.fog = new THREE.FogExp2(0x262c52, 0.0011);
  const effects = fx.createEffects(scene3);

  // 曲速穿越的光線（掛在鏡頭上）
  const warpGeo = new THREE.BufferGeometry();
  const wr = rng(0.73), wpos = [];
  for (let i = 0; i < 500; i++) {
    const a = wr() * TAU, d = 2 + wr() * 30, z = -5 - wr() * 120;
    wpos.push(Math.cos(a) * d, Math.sin(a) * d, z, Math.cos(a) * d, Math.sin(a) * d, z - 6);
  }
  warpGeo.setAttribute('position', new THREE.Float32BufferAttribute(wpos, 3));
  const warpLines = new THREE.LineSegments(warpGeo, new THREE.LineBasicMaterial({ color: 0xe8e0ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  warpLines.frustumCulled = false;
  camera.add(warpLines);

  let debugBox = null;
  if (debug) {
    debugBox = document.createElement('pre');
    debugBox.className = 'debug3d';
    document.body.appendChild(debugBox);
    renderer.info.autoReset = false;
    window.__universe3d = { renderer, scene: scene3, camera, stats, get layout() { return layout; }, spots: () => spots };
  }

  // 第一次進 3D：告訴小朋友怎麼操作
  try {
    if (!localStorage.getItem('kidsci-universe-hint3d')) {
      const hint = document.createElement('p');
      hint.className = 'hint3d';
      hint.textContent = matchMedia('(pointer: coarse)').matches ? '👆 一指拖曳移動　✌️ 兩指縮放、轉動\n點發光的頻道就出發' : '🖱️ 拖曳移動　右鍵轉動　滾輪縮放\n點發光的頻道就出發';
      document.body.appendChild(hint);
      const bye = () => { hint.classList.add('bye'); setTimeout(() => hint.remove(), 600); localStorage.setItem('kidsci-universe-hint3d', '1'); };
      setTimeout(bye, 7000);
      canvas.addEventListener('pointerdown', bye, { once: true });
    }
  } catch { /* 沒有儲存也沒關係 */ }

  const flash = document.createElement('div');
  flash.className = 'warp-flash';
  document.body.appendChild(flash);
  const tip = document.createElement('div');
  tip.className = 'tip3d';
  tip.hidden = true;
  document.body.appendChild(tip);

  const ship = makeShip();
  scene3.add(ship);
  const trail = makePoints(70, () => ({ pos: [0, -999, 0], size: 3, phase: 0 }), { scale: 500 });
  trail.material.uniforms.time.value = 0;
  trail.geometry.attributes.color.array.fill(1);
  for (let i = 0; i < 70; i++) trail.geometry.attributes.color.array.set([0.95, 0.72, 0.55], i * 3);
  scene3.add(trail);
  let trailIndex = 0;

  const sound = new Sound();
  let layout = null;
  let worldGroup = null;
  let spots = []; // { e, icon, holder, local, size, world, eff… }，畫面由 field 一次畫完
  let field = null;
  let current = null; // 現在顯示中的那一格（prepare 的結果）
  let ticks = [];
  let labels = []; // 區名，固定螢幕大小
  let flight = null;
  let warp = null;
  let camAnim = null;
  let hover = null;
  let stampKey = '';
  let time = 0;
  let last = performance.now();
  let running = true;
  let rafId = 0;
  let talking = null; // 正在說話的主角，會在耳機號上跳
  let lastTouch = 0; // 上次有人動手的時間；放著不動會慢慢自轉
  let pixelRatio = Math.min(coarse ? 1.5 : 1.75, window.devicePixelRatio || 1);
  const perf = { sum: 0, n: 0, step: 0 }; // 太慢就自動降畫質

  function themeColor(i, theme = layout.theme) { return new THREE.Color().setHSL(((THEMES[theme].hue[i % 3]) % 360) / 360, 0.8, 0.6); }

  function disposeGroup(g) {
    g.traverse((o) => {
      if (o.userData.shared) return;
      o.geometry?.dispose();
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      mats.forEach((m) => { if (m.map && ![...textureCache.values()].includes(m.map)) m.map.dispose(); m.dispose(); });
    });
  }
  function disposeBundle(B) {
    disposeGroup(B.group);
    B.field.dispose();
  }

  function marksFor(e, st) {
    const m = (st.ear.includes(e.code) ? '👂' : '') + (st.hand.includes(e.code) ? '✋' : '');
    return m || ((st.seen || []).includes(e.code) ? 'seen' : '');
  }

  /** 在背景把下一格整個準備好（還不顯示），換格時才不會一邊飛一邊卡。 */
  function prepare(view) {
    const t0 = performance.now();
    const L = buildScene(view, world, episodes);
    const theme = L.theme;
    const group = new THREE.Group();
    const bTicks = [], bSpots = [], bLabels = [];

    const decoMakers = { l07: heroes.heroSolarSystem, l06: heroes.heroEarthMoon, l05: heroes.heroEarthCore, l08: makeStarCluster, l09: makeGalaxy, l10: makeCosmicWeb, l01: heroes.heroAtom, l02: heroes.heroCell, era: makeTimeRiver, lane: makeLanes, studio: heroes.heroStudio };
    const b0 = L.bounds;
    const reach = Math.max(-b0.minX, b0.maxX, -b0.minY, b0.maxY) * S;
    if (decoMakers[theme]) group.add(decoMakers[theme](L));
    if (theme === 'l04') group.add(fx.makeTraffic(reach));
    if (theme === 'l03') group.add(makeOcean(), fx.makeBirds(reach));
    group.add(fx.makeMotes(reach, themeColor(0, theme)));
    if (theme === 'l04') {
      const grid = new THREE.GridHelper(600, 120, 0x3a4680, 0x2a3060);
      grid.material.transparent = true; grid.material.opacity = 0.22;
      grid.position.y = -0.3;
      group.add(grid);
    }

    const tDeco = performance.now();
    const stampsNow = getStamps();
    let tIsl = 0, tLab = 0;
    L.groups.forEach((z, gi) => {
      const tz = performance.now();
      const radius = z.r * S;
      const center = new THREE.Vector3(z.x * S, 0, z.y * S);
      let topY = 0.4, holder = null;
      if (theme === 'l03') {
        holder = makeIsland(z, radius * 0.95);
        topY = holder.userData.topY;
        center.y = holder.userData.baseY;
      } else if (theme === 'l04') {
        holder = makeCity(z, radius * 0.95);
        topY = holder.userData.topY;
      } else {
        holder = new THREE.Group();
        holder.add(fx.holoPad(z.color ? new THREE.Color(z.color) : themeColor(gi, theme), radius));
      }
      holder.position.copy(center);
      const bob = hash(z.name) * TAU;
      if (theme === 'l03') bTicks.push((t) => { holder.position.y = center.y + (reduceMotion ? 0 : Math.sin(t * 0.6 + bob) * 0.5); });
      group.add(holder);

      tIsl += performance.now() - tz;
      const tl = performance.now();
      const labelColor = z.color || `hsl(${z.hue},80%,60%)`;
      const lt = labelTexture(`${z.name} · ${z.items.length}`, labelColor);
      const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: lt, transparent: true, depthWrite: false, toneMapped: false, sizeAttenuation: false }));
      label.userData.aspect = lt.image.width / lt.image.height;
      bLabels.push(label);
      label.position.set(0, theme === 'l04' ? 14 : 10, -radius * 0.7);
      holder.add(label);
      tLab += performance.now() - tl;

      z.items.forEach((e) => {
        const s = L.spots.find((p) => p.e === e && p.group === z);
        if (!s) return;
        const size = e.state === 'unreleased' ? 3.4 : e.state === 'subscriber' ? 6 : 5.4;
        const local = new THREE.Vector3((s.x - z.x) * S, topY + size * 0.75 + 0.3, (s.y - z.y) * S);
        bSpots.push({ e, icon: s.icon, holder, local, size, topY, phase: hash(e.code) * TAU, marks: marksFor(e, stampsNow) });
      });
    });
    const tZones = performance.now();
    const field = createChannelField(bSpots);
    const tField = performance.now();
    group.add(field.group);
    bSpots.forEach((sp) => { sp.world.copy(sp.holder.position).add(sp.local); });
    group.traverse((o) => {
      if (o.userData.tick) bTicks.push(o.userData.tick);
      if (o.userData.face) bTicks.push(() => o.userData.face(camera.position)); // 主角轉向鏡頭
    });
    renderer.initTexture(field.texture); // 先把徽章圖集送進顯示卡
    if (debug) stats.prep = `主角 ${Math.round(tDeco - t0)} · 區域 ${Math.round(tZones - tDeco)}（平台 ${Math.round(tIsl)}、名牌 ${Math.round(tLab)}）· 頻道圖集 ${Math.round(tField - tZones)} · 其他 ${Math.round(performance.now() - tField)}ms`;
    return { view, layout: L, group, ticks: bTicks, spots: bSpots, labels: bLabels, field, buildMs: Math.round(performance.now() - t0) };
  }

  /** 換上準備好的那一格：天空、燈光、霧一起換。 */
  function commit(B) {
    if (worldGroup) { scene3.remove(worldGroup); disposeBundle(current); }
    current = B;
    ({ layout, ticks, spots, labels, field } = B);
    flight = null; // 正在飛往上一格的頻道就取消
    worldGroup = B.group;
    const tc0 = performance.now();
    const theme = layout.theme;
    const sky = THEMES[theme].sky;
    const base = new THREE.Color(sky[0]).lerp(new THREE.Color(sky[1]), theme === 'l03' ? 0.8 : 0.45).lerp(new THREE.Color(0x262c52), theme === 'l03' ? 0.15 : 0.45);
    const neb = [0, 1, 2].map((i) => new THREE.Color().setHSL((THEMES[theme].hue[i] % 360) / 360, 0.6, 0.62).multiplyScalar(i === 2 ? 0.3 : 0.4)); // 粉彩星雲
    const horizon = new THREE.Color().setHSL((THEMES[theme].hue[0] % 360) / 360, 0.5, 0.62).lerp(new THREE.Color(0xf3c9a8), 0.5).multiplyScalar(0.35);
    sky3.bake({ base, colors: neb, horizon, seed: hash(theme) * 40, bright: theme === 'l03' ? 1.05 : 0.8 });
    scene3.background = sky3.texture;
    scene3.fog = new THREE.FogExp2(base, theme === 'l03' ? 0.0018 : 0.0011); // 一層薄霧，遠方柔柔的
    centerLight.position.set(0, theme === 'l07' ? 0 : 10, 0);
    centerLight.intensity = theme === 'l07' ? 3.2 : 2;
    hemi.intensity = ['l03', 'l04', 'l02', 'l01', 'studio'].includes(theme) ? 1.1 : 0.45;
    scene3.add(worldGroup);
    if (debug) stats.commit = `換上 ${Math.round(performance.now() - tc0)}ms`;
    justCommitted = true;
    stats.buildMs = B.buildMs;
    sizeLabels();
    stampKey = '';
    hover = null;
    tip.hidden = true;
  }

  let pending = null; // 準備好、還沒換上的那一格
  let justCommitted = false;
  /** 先在背景把 shader 編好（瀏覽器支援就平行編譯），最多等 2.5 秒。 */
  const parallelCompile = renderer.extensions.has('KHR_parallel_shader_compile');
  function compileBundle(B) {
    const job = parallelCompile ? renderer.compileAsync(B.group, camera, scene3) : new Promise((r) => setTimeout(() => { renderer.compile(B.group, camera, scene3); r(); }, 0));
    return Promise.race([job.catch(() => {}), new Promise((r) => setTimeout(r, 2500))]);
  }

  function spotWorldPos(spot, out = new THREE.Vector3()) {
    return out.copy(spot.world);
  }

  // ---------- 鏡頭 ----------
  const HERO_THEMES = ['l01', 'l02', 'l05', 'l06', 'l07', 'l08', 'l09', 'l10'];
  function fitTarget() {
    const b = layout.bounds;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    const aspect = w / Math.max(1, h);
    let target, dist;
    let dir = new THREE.Vector3(0, 0, 1); // 鏡頭從哪個方向看過來（水平）
    if (w < 700 && layout.groups.length > 1) {
      // 手機：拉近到一區；有中央主角的格，鏡頭從這一區外側往中心看，前面是頻道、後面是主角
      const live = (g) => g.items.filter((e) => e.state !== 'unreleased').length;
      const hero = HERO_THEMES.includes(layout.theme);
      const score = (g) => live(g) / (hero ? 1 + Math.hypot(g.x, g.y) * S * 0.015 : 1);
      const g = layout.groups.reduce((a, c) => (score(c) > score(a) ? c : a));
      const gc = new THREE.Vector3(g.x * S, theme3dLift(), g.y * S);
      dist = (g.r * S * 2.3) / Math.min(1, aspect * 1.4);
      if (hero && gc.lengthSq() > 1) {
        dir = gc.clone().setY(0).normalize();
        target = gc.clone().lerp(new THREE.Vector3(0, gc.y, 0), 0.35);
        dist *= 1.2;
      } else target = gc;
    } else {
      target = new THREE.Vector3((b.minX + b.maxX) / 2 * S, theme3dLift(), (b.minY + b.maxY) / 2 * S);
      const R = Math.max(b.maxX - b.minX, (b.maxY - b.minY) * 1.25) / 2 * S;
      dist = (R / Math.tan((55 * Math.PI) / 360)) * (aspect < 1 ? 1.4 / aspect : 0.92) * (layout.theme === 'l03' ? 0.78 : 1); // 生物格很大，先拉近一點
      if (layout.groups.length === 1 && aspect >= 1) { dist *= 1.6; target.z -= 5; } // 錄音室：把後面的麥克風也拍進來
    }
    dist = Math.max(18, Math.min(380, dist));
    const pos = target.clone().addScaledVector(dir, dist * 0.74).add(new THREE.Vector3(0, dist * 0.68, 0));
    return { target, pos };
  }
  function theme3dLift() { return layout.theme === 'l03' ? 1 : 0; }

  function animateCamera(to, dur = 1.1) {
    camAnim = { fromPos: camera.position.clone(), fromTarget: controls.target.clone(), toPos: to.pos, toTarget: to.target, t: 0, dur };
  }

  // 耳機號停在畫面前方，不會被中間的太陽、銀河蓋住
  function placeShip() {
    const { target, pos } = fitTarget();
    const toCam = pos.clone().sub(target).setY(0).normalize();
    const right = new THREE.Vector3(toCam.z, 0, -toCam.x);
    const room = canvas.clientWidth < 700 ? 5 : Math.min(heroes.roomOf(layout).inner, 30);
    ship.position.copy(target).addScaledVector(toCam, room * 0.75).addScaledVector(right, -room * 0.55);
    ship.position.y = target.y + 5;
    ship.rotation.set(0, 0, 0);
  }

  // ---------- 互動 ----------
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function pick(clientX, clientY) {
    return field ? field.pick(clientX, clientY, camera, canvas.getBoundingClientRect()) : null;
  }
  let down = null;
  canvas.addEventListener('pointerdown', (ev) => { sound.wake(); down = { x: ev.clientX, y: ev.clientY, t: performance.now() }; });
  canvas.addEventListener('pointerup', (ev) => {
    if (!down) return;
    const moved = Math.hypot(ev.clientX - down.x, ev.clientY - down.y);
    down = null;
    if (moved > 8) return;
    lastTouch = time;
    const s = pick(ev.clientX, ev.clientY);
    if (s) fly(s);
    else ripple(ev.clientX, ev.clientY);
  });
  canvas.addEventListener('pointermove', (ev) => {
    if (ev.pointerType !== 'mouse' || down) return;
    const s = pick(ev.clientX, ev.clientY);
    if (s !== hover) {
      hover = s;
      if (s) sound.blip();
      canvas.style.cursor = s ? 'pointer' : 'grab';
    }
    if (s) {
      tip.hidden = false;
      tip.textContent = `${s.e.code} 台｜${s.e.state === 'unreleased' ? '神秘訊號・' : ''}${s.e.title}`;
      tip.style.left = `${ev.clientX}px`;
      tip.style.top = `${ev.clientY - 18}px`;
    } else tip.hidden = true;
  });
  canvas.addEventListener('pointerleave', () => { tip.hidden = true; hover = null; });

  const spotColor = (e) => (e.state === 'subscriber' ? 0xf0c878 : e.state === 'unreleased' ? 0xb0aed0 : 0x9fdccb);
  function land(spot) {
    const top = spotWorldPos(spot);
    const base = top.clone();
    base.y -= spot.local.y - spot.topY;
    if (!reduceMotion) {
      effects.shockwave(base, spotColor(spot.e), spot.size * 1.6);
      effects.burst(top, spot.e.state === 'subscriber' ? [0xf6dc9c, 0xf0c27a, 0xfff4e2] : [0xb8e6dc, 0xfff4e2, 0xcfc4f0], { count: 50, speed: 7, size: 3 });
    }
    spot.pop = 1;
    setTimeout(() => onPick(spot.e.code), reduceMotion ? 0 : 380);
  }
  const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  function ripple(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.ray.intersectPlane(ground, new THREE.Vector3());
    if (hit && !reduceMotion) { effects.shockwave(hit, 0xffffff, 3, 0.6); sound.blip(); }
  }

  function fly(spot) {
    sound.pick();
    tip.hidden = true;
    const to = spotWorldPos(spot).add(new THREE.Vector3(0, spot.size * 0.95, 0)); // 停在頻道正上方，不擋住徽章
    const from = ship.position.clone();
    const d = from.distanceTo(to);
    const mid = from.clone().lerp(to, 0.5).add(new THREE.Vector3(0, d * 0.3 + 4, 0));
    flight = { spot, curve: new THREE.QuadraticBezierCurve3(from, mid, to), t: 0, dur: reduceMotion ? 0.01 : Math.min(1.8, Math.max(0.7, d / 45)) };
    const target = spotWorldPos(spot);
    const offset = camera.position.clone().sub(controls.target);
    const want = Math.min(offset.length(), 48);
    offset.setLength(want);
    animateCamera({ target, pos: target.clone().add(offset) }, flight.dur + 0.2);
  }

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return; // 清單模式時畫布藏起來，等它再出現才調整
    const pr = pixelRatio;
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);
    if (composer) { composer.setPixelRatio(pr); composer.setSize(w, h); }
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
    sizeLabels();
  }
  function sizeLabels() {
    const lh = 30 / Math.max(1, canvas.clientHeight) * 2 * Math.tan((55 * Math.PI) / 360);
    labels.forEach((l) => l.scale.set(lh * l.userData.aspect, lh, 1));
  }

  // ---------- 主迴圈 ----------
  const tmp = new THREE.Vector3();
  function adapt(raw) {
    if (fixedQuality || perf.step >= 2 || warp || document.querySelector('dialog[open]')) return; // 頻道卡打開時是故意放慢，不算
    perf.sum += raw; perf.n += 1;
    if (perf.n < 90) return;
    const avg = perf.sum / perf.n;
    perf.sum = 0; perf.n = 0;
    if (avg < 1 / 30) return;
    perf.step += 1;
    if (perf.step === 1 && pixelRatio > 1) { pixelRatio = 1; resize(); }
    else { perf.step = 2; useBloom = false; }
  }

  // 拖太遠會迷路：鏡頭中心不能離開這一格
  function clampTarget() {
    if (!layout) return;
    const b = layout.bounds, m = 0;
    const cx = Math.min(b.maxX * S + m, Math.max(b.minX * S - m, controls.target.x));
    const cz = Math.min(b.maxY * S + m, Math.max(b.minY * S - m, controls.target.z));
    const dx = cx - controls.target.x, dz = cz - controls.target.z;
    if (dx || dz) { controls.target.x += dx; controls.target.z += dz; camera.position.x += dx; camera.position.z += dz; }
  }

  // 主迴圈：先排好下一格，這一格就算出錯也不會整個畫面停住
  let lastErr = '';
  let lastRender = 0;
  let meter = { n: 0, since: performance.now(), worst: 0 };
  function frame(now) {
    if (!running) return;
    rafId = requestAnimationFrame(frame);
    // 清單模式或實驗全螢幕時不畫；頻道卡打開時降到每秒 10 格，把力氣留給實驗與播放
    if (!canvas.clientWidth || document.querySelector('dialog.labsheet[open]')) { last = now; return; }
    if (document.querySelector('dialog[open]') && now - lastRender < 100) return;
    lastRender = now;
    const t0 = performance.now();
    try { step(now); } catch (err) {
      stats.errors += 1;
      if (String(err) !== lastErr) { lastErr = String(err); console.error('3D 畫面出錯', err); }
    }
    const ms = performance.now() - t0;
    meter.n += 1; meter.worst = Math.max(meter.worst, ms);
    if (now - meter.since > 1000) {
      stats.fps = Math.round((meter.n * 1000) / (now - meter.since));
      stats.frameMs = Math.round(ms * 10) / 10; stats.worstMs = Math.round(meter.worst);
      meter = { n: 0, since: now, worst: 0 };
      if (debugBox) {
        const info = renderer.info;
        debugBox.textContent = `${stats.fps} fps · JS ${stats.frameMs}ms（最慢 ${stats.worstMs}）· 繪圖 ${info.render.calls} 次 · ${Math.round(info.render.triangles / 1000)}k 三角形 · 程式 ${info.programs.length} · 貼圖 ${info.memory.textures} · 建場景 ${stats.buildMs}ms · 畫質 ${perf.step} · 錯誤 ${stats.errors}\n${stats.parts || ''}\n建場景：${stats.prep || ''}`;
      }
    }
  }
  function step(now) {
    const raw = (now - last) / 1000;
    const dt = Math.min(0.05, raw);
    last = now;
    adapt(raw);
    time += dt;
    stars.material.uniforms.time.value = time;
    const tA = performance.now();
    ticks.forEach((f) => f(reduceMotion ? time * 0.3 : time, dt));
    const tB = performance.now();

    // 頻道：上下漂浮、金色閃爍、拿到星章就換貼圖
    const st = getStamps();
    const key = `${st.ear.length}:${st.hand.length}:${(st.seen || []).length}`;
    const refresh = key !== stampKey;
    stampKey = key;
    const pxk = (2 * Math.tan((camera.fov * Math.PI) / 360)) / Math.max(1, canvas.clientHeight);
    const minBadgePx = canvas.clientWidth < 700 ? 34 : 40;
    if (field) field.update(time, camera, { hover, pxk, minPx: minBadgePx, reduceMotion, dt });
    if (field && refresh) {
      spots.forEach((s) => {
        const m = marksFor(s.e, st);
        if (m !== s.marks) field.setMarks(s, m);
      });
    }

    const tC = performance.now();
    // 耳機號
    if (flight) {
      flight.t = Math.min(1, flight.t + dt / flight.dur);
      const p = flight.curve.getPoint(ease(flight.t));
      tmp.copy(flight.curve.getTangent(Math.min(0.999, ease(flight.t))));
      ship.position.copy(p);
      ship.rotation.y = Math.atan2(tmp.x, tmp.z);
      ship.rotation.z = -tmp.x * 0.3;
      if (flight.t >= 1) { const done = flight; flight = null; land(done.spot); }
    } else {
      ship.position.y += Math.sin(time * 2.2) * 0.004;
      ship.rotation.z *= 0.95;
    }
    if (flight || Math.random() < 0.4) {
      const pos = trail.geometry.attributes.position.array;
      pos.set([ship.position.x + (Math.random() - 0.5) * 0.4, ship.position.y - 0.6, ship.position.z + (Math.random() - 0.5) * 0.4], trailIndex * 3);
      trailIndex = (trailIndex + 1) % 70;
      trail.geometry.attributes.position.needsUpdate = true;
    }
    const tsize = trail.geometry.attributes.size.array;
    for (let i = 0; i < 70; i++) {
      const age = (trailIndex - i + 70) % 70;
      tsize[i] = Math.max(0, 5 - age * 0.09);
    }
    trail.geometry.attributes.size.needsUpdate = true;

    // 鏡頭動畫與曲速
    if (camAnim) {
      camAnim.t = Math.min(1, camAnim.t + dt / camAnim.dur);
      const k = ease(camAnim.t);
      camera.position.lerpVectors(camAnim.fromPos, camAnim.toPos, k);
      controls.target.lerpVectors(camAnim.fromTarget, camAnim.toTarget, k);
      if (camAnim.t >= 1) camAnim = null;
    }
    if (warp) {
      warp.t = Math.min(1, warp.t + dt / warp.dur);
      const p = warp.t;
      const k = Math.sin(p * Math.PI);
      warpLines.material.opacity = k * 0.4;
      warpLines.scale.set(1, 1, 1 + k * 6);
      camera.fov = 55 + k * 22;
      camera.updateProjectionMatrix();
      flash.style.opacity = String(Math.max(0, 1 - Math.abs(p - 0.5) * 4) * 0.45);
      if (warp.next && p >= 0.5 && !parallelCompile && !warp.ready) {
        const tq = performance.now();
        renderer.compile(warp.next.group, camera, scene3); // 不能平行編譯的裝置：趁閃光最亮時一次編完
        if (debug) stats.compile = `編譯 ${Math.round(performance.now() - tq)}ms`;
        warp.ready = true;
      }
      if (warp.waiting && p >= 0.5) warp.t = 0.5; // 下一格還在準備
      if (warp.next && p >= 0.5 && !warp.ready && now - warp.since < 3000) {
        warp.t = 0.5; // 下一格的 shader 還在編，停在光最亮的那一刻等一下，不會卡在半路
      } else if (warp.next && p >= 0.5) {
        commit(warp.next);
        pending = null;
        warp.next = null;
        const to = fitTarget();
        camera.position.copy(to.target.clone().add(to.pos.clone().sub(to.target).multiplyScalar(2.2)));
        controls.target.copy(to.target);
        placeShip();
        animateCamera(to, 0.9);
      }
      if (p >= 1) { warp = null; warpLines.material.opacity = 0; camera.fov = 55; camera.updateProjectionMatrix(); flash.style.opacity = '0'; }
    }
    effects.update(dt);
    const { riders, flame } = ship.userData;
    Object.entries(riders).forEach(([who, r]) => {
      const k = who === talking ? Math.abs(Math.sin(time * 9)) * 0.28 : Math.sin(time * 2 + (who === 'captain' ? 0 : 1.5)) * 0.04;
      r.position.y = r.userData.baseY + k;
    });
    flame.scale.set(1, (flight ? 1.6 : 0.6) * (0.85 + Math.random() * 0.3), 1);
    ship.scale.setScalar(Math.min(4, Math.max(1.6, camera.position.distanceTo(ship.position) * 0.03)));
    controls.autoRotate = !reduceMotion && !flight && !warp && !camAnim && time - lastTouch > 12;
    controls.update();
    clampTarget();
    const tD = performance.now();
    if (debug) renderer.info.reset();
    const tR = performance.now();
    if (useBloom && composer) composer.render(dt);
    else renderer.render(scene3, camera);
    if (debug && justCommitted) { stats.first = `換格後第一格 ${Math.round(performance.now() - tR)}ms`; justCommitted = false; }
    if (debug) stats.parts = `動畫 ${(tB - tA).toFixed(1)} · 頻道 ${(tC - tB).toFixed(1)} · 其他 ${(tD - tC).toFixed(1)} · 繪製 ${(performance.now() - tD).toFixed(1)}ms`;
  }

  // 畫布大小一變就跟著調整（轉手機、切回地圖）；舊瀏覽器沒有 ResizeObserver 就看視窗大小
  if (typeof ResizeObserver === 'function') new ResizeObserver(resize).observe(canvas);
  else window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => {
    running = !document.hidden;
    cancelAnimationFrame(rafId);
    if (running) { last = performance.now(); perf.sum = 0; perf.n = 0; rafId = requestAnimationFrame(frame); }
  });
  controls.autoRotateSpeed = 0.35;
  controls.addEventListener('start', () => { camAnim = null; lastTouch = time; }); // 小朋友自己動手時，自動鏡頭讓開
  resize();
  rafId = requestAnimationFrame(frame);

  function dolly(factor) {
    const offset = camera.position.clone().sub(controls.target);
    const len = Math.max(controls.minDistance, Math.min(controls.maxDistance, offset.length() * factor));
    animateCamera({ target: controls.target.clone(), pos: controls.target.clone().add(offset.setLength(len)) }, 0.35);
  }

  return {
    show(view) {
      if (pending) { disposeBundle(pending); pending = null; } // 連按旋鈕：還沒換上的那一格直接丟掉
      if (!layout || reduceMotion) {
        const B = prepare(view);
        pending = B;
        const ready = compileBundle(B);
        const first = !layout;
        ready.then(() => {
          if (pending !== B) return;
          pending = null;
          commit(B);
          onReady();
          const to = fitTarget();
          controls.target.copy(to.target);
          placeShip();
          if (first && !reduceMotion) {
            const off = to.pos.clone().sub(to.target).applyAxisAngle(new THREE.Vector3(0, 1, 0), -1.1).multiplyScalar(3.2);
            camera.position.copy(to.target).add(off).add(new THREE.Vector3(0, 60, 0));
            animateCamera(to, 2.6);
          } else { camAnim = null; camera.position.copy(to.pos); }
        });
        return;
      }
      // 先讓曲速動畫和音效馬上開始，下一格在下一個空檔才準備：按下去立刻有反應
      sound.tune();
      const w = { t: 0, dur: 1.1, next: null, waiting: true, ready: false, since: performance.now() };
      warp = w;
      setTimeout(() => {
        if (warp !== w) return; // 已經又轉到別格
        const B = prepare(view);
        pending = B;
        w.next = B;
        w.waiting = false;
        if (parallelCompile) compileBundle(B).then(() => { if (warp === w) w.ready = true; });
      }, 50);
    },
    zoom(delta) { dolly(delta > 0 ? 0.7 : 1.4); },
    home() { if (layout) animateCamera(fitTarget(), 0.9); },
    pan(dx, dy) {
      const fwd = controls.target.clone().sub(camera.position).setY(0).normalize();
      const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0));
      const k = camera.position.distanceTo(controls.target) * 0.01;
      const move = right.multiplyScalar(dx * k).add(fwd.multiplyScalar(-dy * k));
      animateCamera({ target: controls.target.clone().add(move), pos: camera.position.clone().add(move) }, 0.3);
    },
    celebrate() {
      sound.chime();
      if (reduceMotion) return;
      effects.burst(ship.position, [0xf6a8b8, 0xf6dc9c, 0xa8dcd6, 0xbfe6a8, 0xc8bcf0, 0xfff4e2], { count: 160, speed: 12, gravity: 10, dur: 1.8, size: 5 });
      effects.shockwave(ship.position.clone().setY(ship.position.y - 1), 0xf6dc9c, 14, 1);
    },
    sound,
    progress(view) {
      const sc = layout && layout.view === view ? layout : buildScene(view, world, episodes);
      const seen = new Set(getStamps().seen || []);
      return { seen: sc.spots.filter((s) => seen.has(s.e.code)).length, total: sc.spots.length };
    },
    flyTo(code) {
      const spot = spots.find((s) => s.e.code === code);
      if (spot) fly(spot);
    },
    suggest() {
      const seen = new Set(getStamps().seen || []);
      let best = null, bestD = Infinity;
      spots.forEach((s) => {
        if (seen.has(s.e.code) || s.e.state === 'unreleased') return;
        const d = spotWorldPos(s).distanceTo(controls.target);
        if (d < bestD) { best = s; bestD = d; }
      });
      return best ? best.e : null;
    },
    spotsInView() { return spots.map((s) => s.e); },
    talk(who) { talking = who; },
    is3d: true,
  };
}

export { iconFor };
