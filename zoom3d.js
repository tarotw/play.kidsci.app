// 宇宙好好聽・一路放大縮小：同一個宇宙，鑽進去看更小，退出來看更大。
// 每一層是一個世界；每個「東西」是一個主題（裡面有幾集）；door 是通往下一層的入口。
// 操作只有：拖曳轉著看、兩指／滾輪放大縮小（一直放大就鑽進去、一直縮小就退出來）、點東西聽故事。
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TAU, glowSprite, makePoints, fresnelMaterial, mergeStatic, EMOJI_FONT, cached } from './kit3d.js';
import { createSky, createEffects, makeMotes, makeBirds } from './fx3d.js';
import { planetMaterial, sunSurface, ringMaterial, heroCell, heroAtom } from './heroes3d.js';
import { Sound, rng } from './explorer.js';

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = matchMedia('(pointer: coarse)').matches;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fakeRoom = (inner) => ({ groups: [{ x: inner * 10 + 100, y: 0, r: 100 }], bounds: { minX: -1, maxX: 1, minY: -1, maxY: 1 } });

// ---------- 東西的名牌：大大的表情符號＋名字 ----------
function stickerTexture(t, { done, vip, door, doorTo }) {
  return cached(`zoom:${t.id}:${done}:${vip}:${door}:${doorTo}`, () => {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 320;
    const g = c.getContext('2d');
    const glow = g.createRadialGradient(128, 112, 40, 128, 112, 118);
    const rgb = door ? '255,236,190' : vip ? '240,200,120' : '159,220,203';
    glow.addColorStop(0, `rgba(${rgb},0.55)`); glow.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = glow; g.fillRect(0, 0, 256, 240);
    g.beginPath(); g.arc(128, 112, 74, 0, TAU);
    g.fillStyle = 'rgba(255,250,240,0.92)'; g.fill();
    g.lineWidth = door ? 10 : 7; g.strokeStyle = door ? '#f6d48a' : vip ? '#d9a74f' : '#7fc4b4';
    if (door) g.setLineDash([16, 10]);
    g.stroke();
    g.setLineDash([]);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `96px ${EMOJI_FONT}`; g.fillStyle = '#000';
    g.fillText(t.emoji, 128, 118);
    if (done) { g.beginPath(); g.arc(196, 52, 22, 0, TAU); g.fillStyle = '#8fd8bf'; g.fill(); g.strokeStyle = '#1f4a3c'; g.lineWidth = 6; g.beginPath(); g.moveTo(185, 52); g.lineTo(194, 61); g.lineTo(208, 43); g.stroke(); }
    const label = door ? `🔍 鑽進去・${doorTo}` : t.name;
    g.font = '800 38px "Noto Sans TC","PingFang TC",sans-serif';
    const w = Math.min(254, g.measureText(label).width + 36);
    g.fillStyle = door ? 'rgba(80,60,30,0.92)' : 'rgba(24,28,56,0.9)';
    g.beginPath(); g.roundRect(128 - w / 2, 236, w, 64, 32); g.fill();
    g.fillStyle = door ? '#ffe9b8' : '#f7efe0';
    g.fillText(label, 128, 270, 238);
    return c;
  });
}

// ---------- 各層的世界 ----------
// 每個建造函式回傳：group、anchors（東西 id → 會動的位置）、doorId、鏡頭設定、天空。
function planet(kind, r, opts) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 40, 28), planetMaterial(kind, opts));
  return m;
}
function orbitLine(d, opacity = 0.18) {
  const m = new THREE.Mesh(new THREE.RingGeometry(d - 0.05, d + 0.05, 160), new THREE.MeshBasicMaterial({ color: 0xffd8b0, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide }));
  m.rotation.x = -Math.PI / 2;
  return m;
}

const BUILD = {
  solar() {
    const g = new THREE.Group();
    const sun = sunSurface(5);
    g.add(sun.mesh, glowSprite(0xf5c08a, 26, 0.6), glowSprite(0xf09a70, 60, 0.2));
    const light = new THREE.PointLight(0xfff0dd, 3.2, 0, 0);
    g.add(light);
    const spec = [
      { id: 'venus', d: 10, r: 0.9, kind: 'rock', c1: 0xf0d8a0, c2: 0xc89a50, s: 1.0 },
      { id: 'earth', d: 14.5, r: 1.1, kind: 'earth', s: 0.8 },
      { id: 'mars', d: 19, r: 0.8, kind: 'rock', c1: 0xd8703a, c2: 0x8a3a20, s: 0.65 },
      { id: 'jupiter', d: 27, r: 2.6, kind: 'gas', c1: 0xe8d0b0, c2: 0xb07848, c3: 0xffffff, spot: 1, s: 0.4 },
      { id: 'saturn', d: 34, r: 2.1, kind: 'gas', c1: 0xf0e0b0, c2: 0xc8a868, c3: 0xfff0d0, s: 0.32, ring: true },
      { id: 'uranus', d: 41, r: 1.5, kind: 'ice', c1: 0x9ae8f0, c2: 0x6ac0d8, s: 0.25 },
      { id: 'neptune', d: 47, r: 1.45, kind: 'ice', c1: 0x4a70f0, c2: 0x2a40b0, s: 0.2 },
    ];
    const anchors = { sun: { obj: sun.mesh, lift: 7.5 } };
    const bodies = spec.map((p, i) => {
      const m = planet(p.kind, p.r, { ...p, seed: i * 3.1 });
      if (p.ring) {
        const ring = new THREE.Mesh(new THREE.RingGeometry(p.r * 1.3, p.r * 2.3, 80), ringMaterial(p.r * 1.3, p.r * 2.3, [0xc8b080, 0xf0e8d0]));
        ring.rotation.x = Math.PI / 2.4;
        m.add(ring);
      }
      g.add(m, orbitLine(p.d));
      anchors[p.id] = { obj: m, lift: p.r + 2.6 };
      return { m, p, a: i * 1.9 + 0.6 };
    });
    // 彗星：一顆冰球拖著長長的尾巴
    const comet = new THREE.Group();
    comet.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.7, 1), new THREE.MeshStandardMaterial({ color: 0xdff4ff, emissive: 0x335566 })));
    const tail = makePoints(160, (i, c) => { c.setRGB(0.7, 0.85, 1); const k = i / 160; return { pos: [k * 9, (Math.random() - 0.5) * k * 1.4, (Math.random() - 0.5) * k * 1.4], size: 2.4 * (1 - k) + 0.4 }; }, { scale: 400, gain: 0.8 });
    comet.add(tail);
    g.add(comet);
    anchors.comet = { obj: comet, lift: 3 };
    const mats = [sun.mat, ...bodies.map((b) => b.m.material)];
    return {
      group: g, anchors, doorId: 'earth',
      cam: { target: new THREE.Vector3(0, 0, 0), dist: 66, min: 16, max: 92, pitch: 0.55 },
      sky: { base: 0x161a36, colors: [0x6a5aa8, 0x3a6aa0, 0x8a5a7a], horizon: 0x3a2a3a, bright: 0.8 },
      hemi: 0.35,
      tick(t) {
        mats.forEach((m) => { if (m.uniforms?.time) m.uniforms.time.value = t; });
        sun.mesh.rotation.y = t * 0.05;
        bodies.forEach(({ m, p, a }) => { const ang = a + t * p.s * 0.06; m.position.set(Math.cos(ang) * p.d, 0, Math.sin(ang) * p.d); m.rotation.y = t * 0.4; });
        const ca = t * 0.04 + 2;
        comet.position.set(Math.cos(ca) * 38, 6 + Math.sin(ca) * 4, Math.sin(ca) * 24);
        comet.lookAt(0, 0, 0); comet.rotateY(Math.PI / 2);
        tail.material.uniforms.time.value = t;
      },
    };
  },

  earth() {
    const g = new THREE.Group();
    const R = 8;
    const light = [1, 0.35, 0.55];
    const earthMat = planetMaterial('earth', { light, rim: 0x6ab8ff });
    const earth = new THREE.Mesh(new THREE.SphereGeometry(R, 72, 48), earthMat);
    const atmo = new THREE.Mesh(new THREE.SphereGeometry(R * 1.07, 48, 32), fresnelMaterial(0x7ac0ff, 2.4, 1.6));
    g.add(earth, atmo);
    // 地表上的東西：緯度、經度（台灣在正前方）
    const onSurface = (lat, lon, h = 0.2) => {
      const la = (lat * Math.PI) / 180, lo = ((lon - 121) * Math.PI) / 180;
      return new THREE.Vector3(Math.sin(lo) * Math.cos(la), Math.sin(la), Math.cos(lo) * Math.cos(la)).multiplyScalar(R + h);
    };
    const pin = (lat, lon, color) => {
      const p = new THREE.Group();
      const pos = onSurface(lat, lon);
      p.position.copy(pos);
      p.lookAt(pos.clone().multiplyScalar(2));
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.2, 8), new THREE.MeshStandardMaterial({ color: 0xffffff }));
      stick.rotation.x = Math.PI / 2; stick.position.z = 0.6;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 12), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.4 }));
      head.position.z = 1.25;
      p.add(stick, head);
      earth.add(p);
      return head;
    };
    const anchors = {
      home: { obj: pin(23.5, 121, 0xf6a8b8), lift: 1.6 },
      volcano: { obj: pin(-12, 88, 0xf0a070), lift: 1.6 },
      typhoon: { obj: pin(8, 158, 0x9fd0f0), lift: 1.6 },
      tilt: { obj: pin(66, 128, 0xdfe8ff), lift: 1.6 },
    };
    earth.rotation.x = 0.25; // 讓台灣朝向鏡頭、北極稍微看得到
    const moonMat = planetMaterial('rock', { c1: 0xd8d8d8, c2: 0x8a8a8a, seed: 5, light, rim: 0xffffff });
    const moon = new THREE.Mesh(new THREE.SphereGeometry(2.1, 40, 28), moonMat);
    g.add(moon, orbitLine(21, 0.14));
    anchors.moon = { obj: moon, lift: 4.2 };
    // 登月火箭
    const rocket = new THREE.Group();
    const white = new THREE.MeshStandardMaterial({ color: 0xf4f0ea, roughness: 0.5 });
    const red = new THREE.MeshStandardMaterial({ color: 0xe88a8a, roughness: 0.5 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 2.6, 16), white);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1, 16), red); nose.position.y = 1.8;
    const fins = new THREE.Mesh(new THREE.ConeGeometry(0.9, 0.8, 4), red); fins.position.y = -1.3;
    rocket.add(body, nose, fins, glowSprite(0xf5c29a, 2.4, 0.6));
    rocket.children[3].position.y = -2;
    rocket.position.set(-15, 2, 4); rocket.rotation.z = -0.7;
    g.add(rocket);
    anchors.rocket = { obj: rocket, lift: 3 };
    // 人造衛星
    const sats = [0, 1, 2].map((i) => {
      const s = new THREE.Group();
      s.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.7), new THREE.MeshStandardMaterial({ color: 0xd8d8e0, metalness: 0.6, roughness: 0.4 })));
      [-1, 1].forEach((k) => { const w = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.45), new THREE.MeshStandardMaterial({ color: 0x5a7ad0, emissive: 0x1a2a50, side: THREE.DoubleSide })); w.position.x = k * 0.95; s.add(w); });
      g.add(s);
      return { s, d: 11.5 + i * 0.8, sp: 0.25 - i * 0.05, off: i * 2.1, tilt: 0.5 - i * 0.4 };
    });
    anchors.satellite = { obj: sats[0].s, lift: 2.2 };
    return {
      group: g, anchors, doorId: 'home', thingSize: 3.4,
      cam: { target: new THREE.Vector3(0, 0, 0), dist: 40, min: 13, max: 66, pitch: 0.25 },
      sky: { base: 0x141a36, colors: [0x4a6ab0, 0x6a5aa8, 0x3a8a9a], horizon: 0x2a2a4a, bright: 0.75 },
      hemi: 0.5,
      tick(t) {
        earthMat.uniforms.time.value = t;
        const ma = t * 0.05 + 2.4;
        moon.position.set(Math.cos(ma) * 21, 2, Math.sin(ma) * 21);
        moon.rotation.y = -ma;
        sats.forEach((x) => { const a = t * x.sp + x.off; x.s.position.set(Math.cos(a) * x.d, Math.sin(a) * x.d * x.tilt, Math.sin(a) * x.d); x.s.rotation.y = -a; });
        rocket.position.y = 2 + Math.sin(t * 0.8) * 0.3;
      },
    };
  },

  you() {
    const g = new THREE.Group();
    const solid = [];
    const r = rng(0.37);
    const add = (geo, color, x, y, z, sx = 1, sy = sx, sz = sx) => { const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color })); m.position.set(x, y, z); m.scale.set(sx, sy, sz); solid.push(m); };
    add(new THREE.CylinderGeometry(28, 26, 2, 48), 0x86c46e, 0, -1, 0);
    add(new THREE.CylinderGeometry(26, 18, 5, 48), 0x9a7a58, 0, -4.5, 0);
    const cone = new THREE.ConeGeometry(1, 1, 8), trunk = new THREE.CylinderGeometry(0.25, 0.35, 1, 6), ball = new THREE.SphereGeometry(1, 10, 8);
    for (let i = 0; i < 22; i++) { // 外圈一圈樹
      const a = (i / 22) * TAU + r() * 0.2, d = 22 + r() * 4, h = 4 + r() * 3;
      add(trunk, 0x7a5a3a, Math.cos(a) * d, 0.8, Math.sin(a) * d, 1, 1.6, 1);
      add(cone, r() > 0.5 ? 0x5aa860 : 0x4a9858, Math.cos(a) * d, 1.6 + h / 2, Math.sin(a) * d, 1.8 + r(), h, 1.8 + r());
    }
    for (let i = 0; i < 40; i++) { // 小花
      const a = r() * TAU, d = 4 + r() * 17;
      add(ball, [0xf6a8b8, 0xf6dc9c, 0xffffff, 0xc8bcf0][i % 4], Math.cos(a) * d, 0.25, Math.sin(a) * d, 0.3);
    }
    g.add(mergeStatic(solid));
    // 天上的雲
    const clouds = new THREE.Group();
    const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x8090a8, roughness: 1, transparent: true, opacity: 0.92 });
    for (let i = 0; i < 6; i++) {
      const c = new THREE.Group();
      for (let k = 0; k < 4; k++) { const b = new THREE.Mesh(ball, cloudMat); b.position.set(k * 1.6 - 2.4, Math.sin(k) * 0.5, (k % 2) * 0.8); b.scale.setScalar(1.4 + (k % 2) * 0.6); c.add(b); }
      const a = (i / 6) * TAU; c.position.set(Math.cos(a) * 30, 16 + (i % 3) * 3, Math.sin(a) * 30);
      clouds.add(c);
    }
    g.add(clouds, makeBirds(24));
    const spot = (x, y, z) => { const o = new THREE.Object3D(); o.position.set(x, y, z); g.add(o); return o; };
    const ring = [['kangaroo', 0.3], ['giraffe', 1.25], ['panda', 2.2], ['elephant', 3.2], ['bat', 4.3], ['bird', 5.3]];
    const anchors = { kid: { obj: spot(0, 3.4, 0), lift: 0 } };
    ring.forEach(([id, a]) => {
      const d = id === 'elephant' || id === 'giraffe' ? 15 : 12;
      const y = id === 'bird' ? 9 : id === 'bat' ? 7 : id === 'giraffe' ? 5 : id === 'elephant' ? 4.5 : 3;
      anchors[id] = { obj: spot(Math.cos(a) * d, y, Math.sin(a) * d), lift: 0 };
    });
    return {
      group: g, anchors, doorId: 'kid',
      cam: { target: new THREE.Vector3(0, 2.5, 0), dist: 40, min: 9, max: 64, pitch: 0.42 },
      sky: { base: 0x8fbce0, colors: [0xffffff, 0xf6dcc8, 0xc8d8f0], horizon: 0xf6d0b0, bright: 1.05 },
      fog: 0x9fc4e0, hemi: 1.2, day: true,
      tick(t) { clouds.rotation.y = t * 0.01; },
    };
  },

  skin() {
    const g = new THREE.Group();
    const solid = [];
    const box = new THREE.BoxGeometry(1, 1, 1), cyl = new THREE.CylinderGeometry(1, 1, 1, 16), ball = new THREE.SphereGeometry(1, 12, 10), ridge = new THREE.TorusGeometry(1, 0.06, 6, 40, Math.PI);
    const add = (geo, color, x, y, z, sx, sy, sz, rx = 0, rz = 0) => { const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color })); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.set(rx, 0, rz); solid.push(m); };
    // 一塊切開的皮膚：表皮、真皮、肌肉、骨頭
    add(box, 0xf3cdb2, 0, -0.75, 0, 30, 1.5, 22);
    add(box, 0xeaa8a6, 0, -4, 0, 30, 5, 22);
    add(box, 0xd27078, 0, -9, 0, 30, 5, 22);
    for (let i = 0; i < 7; i++) add(cyl, 0xe08890, 0, -7.2 - i * 0.6, 11.05, 0.3, 30, 0.12, 0, Math.PI / 2); // 肌肉纖維
    add(cyl, 0xf2ead8, 0, -13.5, 0, 3.2, 30, 3.2, 0, Math.PI / 2); // 骨頭
    for (let i = 0; i < 8; i++) add(ridge, 0xe0b49a, 2, 0.05, -4, 2 + i * 0.9, 1, 2 + i * 0.9, -Math.PI / 2); // 指紋的紋路
    const r = rng(0.52);
    for (let i = 0; i < 14; i++) add(cyl, 0x5a4030, -12 + r() * 24, 1.8, -9 + r() * 18, 0.08, 3.6, 0.08, (r() - 0.5) * 0.5, (r() - 0.5) * 0.5); // 汗毛
    for (let i = 0; i < 18; i++) add(ball, 0xf6c0c4, -13 + r() * 26, -2.6 - r() * 2.8, 10.9, 0.55, 0.55, 0.2); // 切面上的小細胞
    g.add(mergeStatic(solid, { flat: false, roughness: 0.75 }));
    // 血管
    const vessel = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(-15, -5, 6), new THREE.Vector3(-5, -4, 2), new THREE.Vector3(5, -5.2, -3), new THREE.Vector3(15, -4.4, -6)]), 60, 0.45, 10), new THREE.MeshStandardMaterial({ color: 0xc8505a, emissive: 0x401018 }));
    g.add(vessel);
    // 鑽進去的那個細胞
    const cell = new THREE.Mesh(new THREE.SphereGeometry(1.3, 32, 24), new THREE.MeshStandardMaterial({ color: 0xf6c8e0, emissive: 0xa06080, emissiveIntensity: 0.5 }));
    cell.position.set(0, -3.6, 11.6);
    g.add(cell, glowSprite(0xf6c8e0, 7, 0.8));
    g.children[g.children.length - 1].position.copy(cell.position);
    const spot = (x, y, z) => { const o = new THREE.Object3D(); o.position.set(x, y, z); g.add(o); return o; };
    const anchors = {
      cell: { obj: cell, lift: 3.2 },
      print: { obj: spot(2, 3.6, -4), lift: 0 },
      shield: { obj: spot(-9, 3.4, 4), lift: 0 },
      muscle: { obj: spot(-9, -9, 12.5), lift: 0 },
      bone: { obj: spot(9, -13.5, 12.5), lift: 0 },
    };
    return {
      group: g, anchors, doorId: 'cell',
      cam: { target: new THREE.Vector3(0, -5, 4), dist: 44, min: 9, max: 66, pitch: 0.38 },
      sky: { base: 0x3a2a40, colors: [0xa05a7a, 0x6a4a8a, 0xc08a7a], horizon: 0x5a3a4a, bright: 0.8 },
      hemi: 1.0,
      tick() {},
    };
  },

  cell() {
    const g = new THREE.Group();
    const hero = heroCell(fakeRoom(28)); // 細胞半徑 20
    const R = 20;
    hero.position.y = -R * 0.55;
    g.add(hero);
    const spot = (x, y, z) => { const o = new THREE.Object3D(); o.position.set(x, y, z); g.add(o); return o; };
    // 水熊蟲：圓滾滾的小身體加八隻腳
    const bear = new THREE.Group();
    const skin = new THREE.MeshStandardMaterial({ color: 0xe8d8c0, roughness: 0.8 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(1.4, 3, 8, 16), skin); body.rotation.z = Math.PI / 2;
    bear.add(body);
    for (let i = 0; i < 4; i++) [-1, 1].forEach((k) => { const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 0.6, 4, 8), skin); leg.position.set(-1.8 + i * 1.2, -1.3, k * 0.8); bear.add(leg); });
    bear.position.set(-25, -3, 10);
    g.add(bear);
    const anchors = {
      core: { obj: spot(0, 7.5, 0), lift: 0 },
      factory: { obj: spot(11, 3, 9), lift: 0 },
      brain: { obj: spot(27, 6, -10), lift: 0 },
      tardigrade: { obj: bear, lift: 3.6 },
    };
    return {
      group: g, anchors, doorId: 'core',
      cam: { target: new THREE.Vector3(0, 0, 0), dist: 62, min: 14, max: 92, pitch: 0.3 },
      sky: { base: 0x2a1630, colors: [0xa05a8a, 0x5a4a9a, 0xc07a9a], horizon: 0x4a2a40, bright: 0.85 },
      hemi: 1.0,
      tick(t) { bear.rotation.y = Math.sin(t * 0.5) * 0.4; bear.position.y = -3 + Math.sin(t * 0.9) * 0.8; },
    };
  },

  atom() {
    const g = new THREE.Group();
    const hero = heroAtom(fakeRoom(22)); // 電子軌道半徑 18
    hero.position.y = -18 * 0.45;
    g.add(hero);
    const spot = (x, y, z) => { const o = new THREE.Object3D(); o.position.set(x, y, z); g.add(o); return o; };
    const ring = ['table', 'matter', 'firework', 'gem', 'nuclear', 'material'];
    const anchors = { atom: { obj: spot(0, 6, 0), lift: 0 } };
    ring.forEach((id, i) => { const a = (i / ring.length) * TAU + 0.4; anchors[id] = { obj: spot(Math.cos(a) * 30, (i % 2) * 5 - 1, Math.sin(a) * 30), lift: 0 }; });
    return {
      group: g, anchors, doorId: null,
      cam: { target: new THREE.Vector3(0, 0, 0), dist: 68, min: 24, max: 96, pitch: 0.35 },
      sky: { base: 0x1a1430, colors: [0x7a5ab0, 0x4a6ab0, 0x9a5a9a], horizon: 0x3a2a4a, bright: 0.8 },
      hemi: 1.0,
      tick() {},
    };
  },
};

// ---------- 引擎 ----------
export function createZoomWorld({ canvas, layers, byCode, getStamps, onThing, onLayer, onReady = () => {}, onEdge = () => {} }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x262c52, 0.004);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 5000);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.enableZoom = false; // 放大縮小自己處理：一直放大要能鑽進去
  controls.rotateSpeed = 0.7;
  controls.minPolarAngle = 0.25;
  controls.maxPolarAngle = 1.45;
  controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: null, RIGHT: THREE.MOUSE.ROTATE };
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: -1 };
  controls.autoRotateSpeed = 0.3;

  const hemi = new THREE.HemisphereLight(0xdfeaff, 0x302030, 0.8);
  const sunLight = new THREE.DirectionalLight(0xfff4e8, 1.6);
  sunLight.position.set(40, 60, 30);
  scene.add(hemi, sunLight);
  const sky = createSky(renderer);
  const effects = createEffects(scene);
  const sound = new Sound();

  const r0 = rng(0.5);
  const stars = makePoints(coarse ? 2500 : 5000, (i, c) => {
    const u = r0() * 2 - 1, a = r0() * TAU, d = 700 + r0() * 700, s = Math.sqrt(1 - u * u);
    c.setHSL(0.6 + r0() * 0.1, 0.3, 0.85);
    return { pos: [Math.cos(a) * s * d, u * d, Math.sin(a) * s * d], size: 2 + r0() * 3 };
  }, { scale: 800 });
  scene.add(stars);

  const flash = document.createElement('div');
  flash.className = 'zoom-flash';
  document.body.appendChild(flash);

  const order = layers.map((l) => l.id);
  let cur = null; // { def, world, things[], index }
  let dist = 40, push = 0, pushHold = 0;
  let move = null; // 鑽進去／退出來的動畫
  let queue = []; // 電梯一次跳好幾層
  let time = 0, last = performance.now(), lastTouch = 0;
  let pixelRatio = Math.min(coarse ? 1.5 : 1.75, window.devicePixelRatio || 1);

  // 直式手機畫面比較窄：鏡頭依比例拉遠，左右的東西才不會被切掉
  function camOf(w) {
    const aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight);
    const f = aspect < 1 ? clamp(1.05 / aspect, 1, 2.1) : 1;
    return { ...w.cam, dist: w.cam.dist * f, max: w.cam.max * f };
  }
  function seenAll(t) {
    const st = getStamps();
    return t.codes.length > 0 && t.codes.every((c) => st.seen.includes(c));
  }
  function isVip(t) { return t.codes.length > 0 && t.codes.every((c) => byCode.get(c)?.state === 'subscriber'); }
  function childName(def) {
    const i = order.indexOf(def.id);
    return layers[i + 1]?.name || '';
  }

  function makeSticker(t, def) {
    const door = !!t.door;
    const opts = { done: seenAll(t), vip: isVip(t), door, doorTo: door ? childName(def) : '' };
    const mat = new THREE.SpriteMaterial({ map: stickerTexture(t, opts), transparent: true, depthWrite: false, toneMapped: false });
    const s = new THREE.Sprite(mat);
    s.renderOrder = 4;
    s.userData.opts = opts;
    return s;
  }

  function build(def) {
    const world = BUILD[def.id]();
    const things = def.things.map((t) => {
      const a = world.anchors[t.id];
      const sprite = makeSticker(t, def);
      world.group.add(sprite);
      const base = world.thingSize || 6;
      return { def: t, anchor: a, sprite, pos: new THREE.Vector3(), size: t.door ? base * 1.15 : base, pop: 0 };
    });
    return { def, world, things, index: order.indexOf(def.id) };
  }

  function dispose(L) {
    scene.remove(L.world.group);
    L.world.group.traverse((o) => {
      if (o.userData.shared || o.isSprite && o.material.map) { o.material?.dispose?.(); return; }
      o.geometry?.dispose();
      (Array.isArray(o.material) ? o.material : o.material ? [o.material] : []).forEach((m) => m.dispose());
    });
  }

  function enter(def, from) {
    if (cur) dispose(cur);
    cur = build(def);
    const w = cur.world;
    scene.add(w.group);
    sky.bake({ base: w.sky.base, colors: w.sky.colors, horizon: w.sky.horizon, seed: def.id.length * 7.3, bright: w.sky.bright });
    scene.background = sky.texture;
    scene.fog.color.set(w.fog ?? w.sky.base);
    scene.fog.density = w.day ? 0.006 : 0.004;
    stars.visible = !w.day;
    hemi.intensity = w.hemi;
    renderer.compile(scene, camera);
    w.tick(time); // 先跑一次，行星、月亮才在正確的位置
    // 鏡頭：從哪裡來就從哪裡開始。從大的一層鑽進來＝從遠處飛近；從小的一層退出來＝從入口附近往後拉
    const c = camOf(w);
    const dir = new THREE.Vector3(0, Math.sin(c.pitch), Math.cos(c.pitch));
    controls.target.copy(c.target);
    if (from === 'outer') { dist = c.max * 1.25; }
    else if (from === 'inner') {
      const door = cur.things.find((t) => t.def.door);
      if (door) { updateThings(); controls.target.copy(door.pos); }
      dist = c.min * 1.1;
    } else dist = c.dist;
    camera.position.copy(controls.target).addScaledVector(dir, dist);
    settle = { dist: c.dist, target: c.target.clone(), t: 0, dur: from ? 1.4 : 0 };
    push = 0;
    onLayer(def, from);
  }
  let settle = null;

  // ---------- 東西的位置與名牌 ----------
  const tmp = new THREE.Vector3();
  function updateThings() {
    if (!cur) return;
    const pxk = (2 * Math.tan((camera.fov * Math.PI) / 360)) / Math.max(1, canvas.clientHeight);
    cur.things.forEach((t) => {
      t.anchor.obj.getWorldPosition(t.pos);
      t.pos.y += t.anchor.lift;
      t.pop = Math.max(0, t.pop - 0.03);
      const d = camera.position.distanceTo(t.pos);
      const minPx = coarse ? 68 : 84; // 名牌在螢幕上至少這麼大，小手才點得到
      const size = Math.max(t.size, minPx * pxk * d) * (t.def.door ? 1.12 : 1) * (1 + Math.sin(t.pop * Math.PI) * 0.25);
      t.sprite.position.copy(t.pos);
      t.sprite.scale.set(size, size * (320 / 256), 1);
      t.screenR = (size / 2) / Math.max(1e-6, pxk * d);
    });
  }
  function refreshMarks() {
    if (!cur) return;
    cur.things.forEach((t) => {
      const opts = { ...t.sprite.userData.opts, done: seenAll(t.def) };
      if (opts.done !== t.sprite.userData.opts.done) {
        t.sprite.userData.opts = opts;
        t.sprite.material.map = stickerTexture(t.def, opts);
      }
    });
  }

  // ---------- 點選 ----------
  function pick(x, y) {
    if (!cur) return null;
    const rect = canvas.getBoundingClientRect();
    let best = null, bestD = Infinity;
    cur.things.forEach((t) => {
      tmp.copy(t.pos).project(camera);
      if (tmp.z > 1) return;
      const px = rect.left + ((tmp.x + 1) / 2) * rect.width, py = rect.top + ((1 - tmp.y) / 2) * rect.height;
      const dd = Math.hypot(x - px, y - py);
      if (dd < Math.max(36, t.screenR * 0.8) && dd < bestD) { best = t; bestD = dd; }
    });
    return best;
  }
  const pointers = new Map();
  let downAt = null, pinch = null;
  canvas.addEventListener('pointerdown', (ev) => {
    sound.wake();
    lastTouch = time;
    pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (pointers.size === 1) downAt = { x: ev.clientX, y: ev.clientY };
    if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); downAt = null; }
  });
  canvas.addEventListener('pointermove', (ev) => {
    if (!pointers.has(ev.pointerId)) {
      if (ev.pointerType === 'mouse') canvas.style.cursor = pick(ev.clientX, ev.clientY) ? 'pointer' : 'grab';
      return;
    }
    pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (pointers.size === 2 && pinch) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      zoomBy(pinch / d);
      pinch = d;
    }
  });
  const up = (ev) => {
    pointers.delete(ev.pointerId);
    if (pointers.size < 2) pinch = null;
    if (downAt && pointers.size === 0 && Math.hypot(ev.clientX - downAt.x, ev.clientY - downAt.y) < 10) {
      const t = pick(ev.clientX, ev.clientY);
      if (t) tap(t);
    }
    if (pointers.size === 0) downAt = null;
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', (ev) => { pointers.delete(ev.pointerId); pinch = null; downAt = null; });
  canvas.addEventListener('wheel', (ev) => { ev.preventDefault(); lastTouch = time; zoomBy(Math.exp(ev.deltaY * (ev.ctrlKey ? 0.01 : 0.0015))); }, { passive: false });

  function tap(t) {
    sound.pick();
    t.pop = 1;
    effects.shockwave(t.pos.clone().setY(t.pos.y - 2), t.def.door ? 0xf6dc9c : 0x9fdccb, 4, 0.6);
    if (t.def.door && !t.def.codes.length) { dive(); return; }
    onThing(t.def, { door: !!t.def.door, childName: childName(cur.def) });
  }

  // 放大縮小：到了最近還繼續放大＝鑽進去；到了最遠還繼續縮小＝退出來
  function zoomBy(factor) {
    if (!cur || move) return;
    settle = null;
    const c = camOf(cur.world);
    const next = dist * factor;
    if (next < c.min) {
      dist = c.min;
      push += (c.min / next - 1) * 2.2;
      pushHold = 0.5;
      if (push >= 1) { if (cur.world.doorId) dive(); else { push = 0; onEdge('inner'); } }
    } else if (next > c.max) {
      dist = c.max;
      push -= (next / c.max - 1) * 2.2;
      pushHold = 0.5;
      if (push <= -1) { if (cur.index > 0) surface(); else { push = 0; onEdge('outer'); } }
    } else { dist = next; push *= 0.5; }
  }

  function dive() {
    if (!cur) return;
    if (move) { if (queue.length < 3) queue.push('in'); return; } // 動畫還沒跑完又按：排隊，跑完接著走
    if (!cur.world.doorId || cur.index >= order.length - 1) { onEdge('inner'); return; }
    const door = cur.things.find((t) => t.def.door);
    sound.tune();
    move = { dir: 'in', t: 0, dur: reduceMotion ? 0.01 : 1.0, fromDist: dist, fromTarget: controls.target.clone(), toTarget: door.pos.clone(), swapped: false };
  }
  function surface() {
    if (!cur) return;
    if (move) { if (queue.length < 3) queue.push('out'); return; }
    if (cur.index <= 0) { onEdge('outer'); return; }
    sound.tune();
    move = { dir: 'out', t: 0, dur: reduceMotion ? 0.01 : 1.0, fromDist: dist, fromTarget: controls.target.clone(), toTarget: controls.target.clone(), swapped: false };
  }
  function goTo(id) {
    if (!cur) return;
    const target = order.indexOf(id);
    const from = move ? cur.index + (move.swapped ? 0 : move.dir === 'in' ? 1 : -1) : cur.index; // 正在移動時，從目的地算起
    if (target < 0 || target === from) { queue = []; return; }
    const steps = target - from;
    queue = Array.from({ length: Math.abs(steps) }, () => (steps > 0 ? 'in' : 'out'));
    if (!move) runQueue();
  }
  function runQueue() {
    const next = queue.shift();
    if (next === 'in') dive(); else if (next === 'out') surface();
    if (move && queue.length) move.dur *= 0.6; // 電梯一次跳好幾層，走快一點
  }

  // ---------- 主迴圈 ----------
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  if (typeof ResizeObserver === 'function') new ResizeObserver(resize).observe(canvas);
  else window.addEventListener('resize', resize);
  resize();

  const perf = { sum: 0, n: 0, done: false };
  let lastErr = '';
  function frame(now) {
    requestAnimationFrame(frame);
    if (document.hidden || !canvas.clientWidth || document.querySelector('dialog.labsheet[open]')) { last = now; return; }
    try { step(now); } catch (err) { if (String(err) !== lastErr) { lastErr = String(err); console.error('放大縮小畫面出錯', err); } }
  }
  function step(now) {
    const raw = (now - last) / 1000;
    const dt = Math.min(0.05, raw);
    last = now;
    time += dt;
    if (!perf.done && !move && !document.querySelector('dialog[open]')) { // 太慢就降解析度
      perf.sum += raw; perf.n += 1;
      if (perf.n >= 90) { if (perf.sum / perf.n > 1 / 30 && pixelRatio > 1) { pixelRatio = 1; resize(); } perf.done = true; }
    }
    stars.material.uniforms.time.value = time;
    if (cur) cur.world.tick(reduceMotion ? time * 0.3 : time);

    let c = cur ? camOf(cur.world) : null;
    if (move) {
      move.t = Math.min(1, move.t + dt / move.dur);
      const k = ease(move.t);
      if (!move.swapped) {
        const p = Math.min(1, move.t * 2);
        if (move.dir === 'in') { dist = move.fromDist * (1 - ease(p) * 0.9); controls.target.lerpVectors(move.fromTarget, move.toTarget, ease(p)); }
        else dist = move.fromDist * (1 + ease(p) * 2.5);
        flash.style.opacity = String(ease(p) * 0.85);
        if (move.t >= 0.5) {
          const nextDef = layers[cur.index + (move.dir === 'in' ? 1 : -1)];
          enter(nextDef, move.dir === 'in' ? 'outer' : 'inner');
          move.swapped = true;
          c = camOf(cur.world);
        }
      } else {
        flash.style.opacity = String(Math.max(0, 1 - (move.t - 0.5) * 2) * 0.85);
        if (move.t >= 1) { move = null; flash.style.opacity = '0'; if (queue.length) runQueue(); }
      }
    }
    if (move && !move.swapped) { /* 前半段：飛向入口或往後拉 */ } else if (settle && c) {
      settle.t = Math.min(1, settle.t + dt / Math.max(0.01, settle.dur));
      const k = 1 - Math.pow(1 - settle.t, 3);
      dist += (settle.dist - dist) * Math.min(1, k * 0.12 + 0.02);
      controls.target.lerp(settle.target, Math.min(1, k * 0.1 + 0.02));
      if (settle.t >= 1 && Math.abs(dist - settle.dist) < 0.05) settle = null;
    } else if (c) {
      // 放大時鏡頭慢慢移向入口：一路放大自然就會鑽進那個東西
      const door = cur.things.find((t) => t.def.door);
      const k = clamp((c.dist - dist) / (c.dist - c.min), 0, 1);
      const toward = door ? c.target.clone().lerp(door.pos, Math.pow(k, 1.3)) : c.target;
      controls.target.lerp(toward, 0.12);
      if (pushHold > 0) pushHold -= dt; else push *= 0.9;
    }
    // 鏡頭距離
    const off = camera.position.clone().sub(controls.target);
    if (off.lengthSq() < 1e-6) off.set(0, 0.5, 1);
    off.setLength(dist);
    camera.position.copy(controls.target).add(off);
    controls.autoRotate = !reduceMotion && !move && time - lastTouch > 10 && !window.__zoomDebug?.still;
    controls.update();
    updateThings();
    // 入口的提示圈：繼續放大時越來越亮
    if (cur) {
      const door = cur.things.find((t) => t.def.door);
      if (door) door.sprite.material.opacity = 0.85 + 0.15 * Math.sin(time * 3);
      pushRing.visible = push > 0.05 && !!door;
      if (door && pushRing.visible) { pushRing.position.copy(door.pos); pushRing.scale.setScalar(door.sprite.scale.x * (0.6 + push * 0.5)); pushRing.material.opacity = Math.min(1, push) * 0.8; pushRing.quaternion.copy(camera.quaternion); }
    }
    effects.update(dt);
    renderer.render(scene, camera);
  }
  const pushRing = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.5, 64), new THREE.MeshBasicMaterial({ color: 0xffe9b8, transparent: true, opacity: 0, depthTest: false, side: THREE.DoubleSide }));
  pushRing.renderOrder = 6;
  scene.add(pushRing);

  requestAnimationFrame(frame);
  if (new URLSearchParams(location.search).has('debug') || navigator.webdriver) {
    // 測試用：東西在螢幕上的位置
    window.__zoomDebug = {
      still: navigator.webdriver, // 自動測試時不要自轉，位置才不會一直變
      where(id) {
        const t = cur?.things.find((x) => x.def.id === id);
        if (!t) return null;
        const v = t.pos.clone().project(camera), rect = canvas.getBoundingClientRect();
        return { x: rect.left + ((v.x + 1) / 2) * rect.width, y: rect.top + ((1 - v.y) / 2) * rect.height };
      },
    };
  }

  return {
    start(id) {
      const def = layers.find((l) => l.id === id) || layers[0];
      enter(def, null);
      onReady();
    },
    dive, surface, goTo, refreshMarks, sound,
    current: () => cur?.def,
    celebrate(pos) { sound.chime(); if (!reduceMotion && cur) effects.burst(pos || controls.target.clone(), [0xf6a8b8, 0xf6dc9c, 0xa8dcd6, 0xbfe6a8, 0xc8bcf0], { count: 120, speed: 10, size: 5 }); },
  };
}
