// 宇宙好好聽 3D 特效：星雲天空、全像平台、頻道光柱、落地衝擊波、各格的小生命。
import * as THREE from 'three';
import { TAU, NOISE, makePoints, glowSprite } from './kit3d.js';
import { rng } from './explorer.js';

const UV_VERT = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const additive = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending };
const hdr = (color, k) => new THREE.Color(color).multiplyScalar(k);

// ---------- 星雲天空：每換一格烤一次進立方體貼圖，之後不再花算力 ----------
export function createSky(renderer) {
  const target = new THREE.WebGLCubeRenderTarget(512, { type: THREE.HalfFloatType });
  const cam = new THREE.CubeCamera(0.1, 100, target);
  const scene = new THREE.Scene();
  const uniforms = {
    base: { value: new THREE.Color() }, c1: { value: new THREE.Color() }, c2: { value: new THREE.Color() }, c3: { value: new THREE.Color() },
    seed: { value: 0 }, bright: { value: 1 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `varying vec3 vDir; void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: NOISE + /* glsl */ `
      uniform vec3 base; uniform vec3 c1; uniform vec3 c2; uniform vec3 c3; uniform float seed; uniform float bright; varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        vec3 q = d * 1.6 + seed;
        vec3 w = vec3(fbm(q + 1.7), fbm(q + 9.2), fbm(q + 4.4));
        float n = fbm(q * 1.4 + w * 1.8);
        float m = fbm(q * 3.1 - w);
        float band = exp(-pow(d.y * 2.4 + 0.35 * sin(d.x * 2.0 + seed), 2.0));
        vec3 col = base;
        col += c1 * smoothstep(0.42, 0.85, n) * (0.35 + 0.65 * band) * 0.75;
        col += c2 * smoothstep(0.5, 0.9, m) * 0.55 * band;
        col += c3 * pow(smoothstep(0.5, 0.95, n * m * 1.8), 2.0) * 0.9;
        col *= 1.0 - smoothstep(0.55, 0.75, fbm(q * 6.0)) * 0.4 * band;
        gl_FragColor = vec4(col * bright, 1.0);
      }`,
    side: THREE.BackSide,
    depthWrite: false,
  });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(10, 64, 32), mat));
  return {
    texture: target.texture,
    bake({ base, colors, seed, bright = 1 }) {
      uniforms.base.value.set(base);
      [uniforms.c1, uniforms.c2, uniforms.c3].forEach((u, i) => u.value.set(colors[i]));
      uniforms.seed.value = seed;
      uniforms.bright.value = bright;
      cam.update(renderer, scene);
    },
  };
}

// ---------- 一圈光柱：平台的側光、頻道的光柱共用 ----------
function beamMaterial(color, strength = 0.55) {
  return new THREE.ShaderMaterial({
    uniforms: { color: { value: new THREE.Color(color) }, time: { value: 0 }, strength: { value: strength } },
    vertexShader: UV_VERT,
    fragmentShader: /* glsl */ `uniform vec3 color; uniform float time; uniform float strength; varying vec2 vUv;
      void main() {
        float fade = pow(1.0 - vUv.y, 1.6);
        float shimmer = 0.7 + 0.3 * sin(vUv.y * 26.0 - time * 4.0);
        float a = fade * shimmer * strength;
        gl_FragColor = vec4(color * a * 1.6, a);
      }`,
    ...additive,
    side: THREE.DoubleSide,
  });
}

// ---------- 全像平台：每一區站在一塊會發光、有波紋的圓台上 ----------
export function holoPad(color, radius) {
  const g = new THREE.Group();
  const c = new THREE.Color(color);
  const mat = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, color: { value: c }, radius: { value: radius } },
    vertexShader: UV_VERT,
    fragmentShader: /* glsl */ `uniform float time; uniform vec3 color; uniform float radius; varying vec2 vUv;
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        if (r > 1.0) discard;
        float wave = fract(r * 4.0 - time * 0.3);
        float rings = (1.0 - smoothstep(0.0, 0.05, wave)) * (1.0 - r * 0.5);
        vec2 cell = fract(p * radius * 0.45) - 0.5;
        float dots = 1.0 - smoothstep(0.04, 0.09, length(cell));
        float edge = smoothstep(0.88, 1.0, r);
        float a = 0.05 + rings * 0.22 + dots * 0.14 * (1.0 - r) + edge * 0.4;
        gl_FragColor = vec4(color * a * 1.5, a);
      }`,
    ...additive,
    side: THREE.DoubleSide,
  });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(1, 72), mat);
  disc.rotation.x = -Math.PI / 2;
  disc.scale.setScalar(radius);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.16, 8, 120), new THREE.MeshBasicMaterial({ color: hdr(c, 1.35) }));
  rim.rotation.x = Math.PI / 2;
  const skirtMat = beamMaterial(c, 0.35);
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.82, radius, 3.2, 72, 1, true), skirtMat);
  skirt.position.y = -1.6;
  skirt.rotation.x = Math.PI; // 光從平台邊往下淡出
  g.add(disc, rim, skirt);
  g.userData.tick = (t) => { mat.uniforms.time.value = t; skirtMat.uniforms.time.value = t; };
  return g;
}

// ---------- 頻道光柱與底座：同一種狀態共用材質 ----------
export function beaconKit() {
  const colors = { public: 0x6fe8ff, subscriber: 0xffc040, seen: 0x7dffc4 };
  const beams = Object.fromEntries(Object.entries(colors).map(([k, c]) => [k, beamMaterial(c, 0.6)]));
  const halos = Object.fromEntries(Object.entries(colors).map(([k, c]) => [k, new THREE.MeshBasicMaterial({ color: hdr(c, 1.3), ...additive, opacity: 0.8, side: THREE.DoubleSide })]));
  const beamGeo = new THREE.CylinderGeometry(1, 1, 1, 16, 1, true);
  beamGeo.translate(0, 0.5, 0);
  const haloGeo = new THREE.RingGeometry(0.75, 1, 48);
  haloGeo.rotateX(-Math.PI / 2);
  const orbitGeo = new THREE.TorusGeometry(1, 0.045, 6, 64);
  const orbitMat = new THREE.MeshBasicMaterial({ color: hdr(0xffd060, 2.2) });
  const sparkGeo = new THREE.OctahedronGeometry(0.22);
  return {
    kindOf: (state, seen) => (seen ? 'seen' : state === 'subscriber' ? 'subscriber' : 'public'),
    make(kind, height, size, subscriber) {
      const g = new THREE.Group();
      const beam = new THREE.Mesh(beamGeo, beams[kind]);
      beam.scale.set(size * 0.16, height, size * 0.16);
      const halo = new THREE.Mesh(haloGeo, halos[kind]);
      halo.scale.setScalar(size * 0.5);
      halo.position.y = 0.05;
      g.add(beam, halo);
      let orbit = null;
      if (subscriber) {
        orbit = new THREE.Group();
        const ringMesh = new THREE.Mesh(orbitGeo, orbitMat);
        ringMesh.scale.setScalar(size * 0.62);
        const spark = new THREE.Mesh(sparkGeo, orbitMat);
        spark.position.x = size * 0.62;
        orbit.add(ringMesh, spark);
        orbit.position.y = height;
        g.add(orbit);
      }
      g.traverse((o) => { o.userData.shared = true; }); // 幾何與材質共用，換格時不要丟掉
      return { group: g, beam, halo, orbit };
    },
    setKind(parts, kind) { parts.beam.material = beams[kind]; parts.halo.material = halos[kind]; },
    tick(t) { Object.values(beams).forEach((m) => { m.uniforms.time.value = t; }); },
  };
}

// ---------- 一次性特效：衝擊波、彩色碎片 ----------
export function createEffects(scene) {
  const live = [];
  const ringGeo = new THREE.RingGeometry(0.86, 1, 64);
  ringGeo.rotateX(-Math.PI / 2);
  return {
    shockwave(pos, color, size = 8, dur = 0.8) {
      const mat = new THREE.MeshBasicMaterial({ color: hdr(color, 1.8), ...additive, opacity: 1, side: THREE.DoubleSide });
      const m = new THREE.Mesh(ringGeo, mat);
      m.position.copy(pos);
      scene.add(m);
      let t = 0;
      live.push((dt) => {
        t += dt / dur;
        m.scale.setScalar(0.5 + t * size);
        mat.opacity = Math.max(0, 1 - t);
        if (t < 1) return true;
        scene.remove(m); mat.dispose();
        return false;
      });
    },
    burst(pos, palette, { count = 60, speed = 9, gravity = 9, dur = 1.2, size = 4 } = {}) {
      const r = Math.random;
      const vel = [];
      const pts = makePoints(count, (i, c) => {
        const a = r() * TAU, u = r() * 2 - 1, s = Math.sqrt(1 - u * u), v = speed * (0.4 + r() * 0.6);
        vel.push(Math.cos(a) * s * v, Math.abs(u) * v + speed * 0.35, Math.sin(a) * s * v);
        c.set(palette[i % palette.length]);
        return { pos: [pos.x, pos.y, pos.z], size: size * (0.5 + r()) };
      }, { scale: 500, gain: 1.6 });
      pts.frustumCulled = false;
      scene.add(pts);
      const p = pts.geometry.attributes.position;
      let t = 0;
      live.push((dt) => {
        t += dt;
        for (let i = 0; i < count; i++) {
          vel[i * 3 + 1] -= gravity * dt;
          p.array[i * 3] += vel[i * 3] * dt; p.array[i * 3 + 1] += vel[i * 3 + 1] * dt; p.array[i * 3 + 2] += vel[i * 3 + 2] * dt;
        }
        p.needsUpdate = true;
        pts.material.uniforms.gain.value = 1.6 * Math.max(0, 1 - t / dur);
        pts.material.uniforms.time.value = t * 6;
        if (t < dur) return true;
        scene.remove(pts); pts.geometry.dispose(); pts.material.dispose();
        return false;
      });
    },
    update(dt) { for (let i = live.length - 1; i >= 0; i--) if (!live[i](dt)) live.splice(i, 1); },
  };
}

// ---------- 各格的小生命 ----------
function stripeTexture(colors, seed) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  const r = rng(seed);
  let y = 0;
  while (y < 128) {
    const h = 4 + r() * 14;
    g.fillStyle = colors[Math.floor(r() * colors.length)];
    g.fillRect(0, y, 256, h + 1);
    y += h;
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** 太陽系：八大行星繞著太陽轉；內行星在平台內側，外行星在平台外側。 */
export function makePlanets(sc) {
  const g = new THREE.Group();
  const reach = Math.max(30, ...sc.groups.map((z) => (Math.hypot(z.x, z.y) + z.r) * 0.1));
  const inner = Math.max(11, Math.min(...sc.groups.map((z) => (Math.hypot(z.x, z.y) - z.r) * 0.1)) - 2);
  const spec = [
    { r: 0.5, d: inner * 0.42, c: 0xb0a090, s: 1.6 },
    { r: 0.9, d: inner * 0.58, c: 0xe8c890, s: 1.2 },
    { r: 1.0, d: inner * 0.76, c: 0x3a7fd8, s: 1.0, earth: true },
    { r: 0.7, d: inner * 0.94, c: 0xd0603a, s: 0.8 },
    { r: 3.2, d: reach + 9, tex: ['#d8b890', '#b08060', '#e8d8c0', '#a06848'], s: 0.45 },
    { r: 2.7, d: reach + 19, tex: ['#e8d8a8', '#c8b080', '#f0e8c8'], s: 0.35, ring: true },
    { r: 1.8, d: reach + 28, c: 0x8fd8e8, s: 0.26 },
    { r: 1.7, d: reach + 36, c: 0x4a6ae8, s: 0.2 },
  ];
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xffc890, ...additive, opacity: 0.16, side: THREE.DoubleSide });
  const bodies = spec.map((p, i) => {
    const mat = new THREE.MeshStandardMaterial({ color: p.c ?? 0xffffff, map: p.tex ? stripeTexture(p.tex, i + 0.3) : null, roughness: 0.85, emissive: p.c ?? 0x664433, emissiveIntensity: 0.12 });
    const m = new THREE.Mesh(new THREE.SphereGeometry(p.r, 40, 24), mat);
    if (p.ring) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(p.r * 1.35, p.r * 2.3, 64), new THREE.MeshStandardMaterial({ color: 0xe8d8a8, transparent: true, opacity: 0.75, side: THREE.DoubleSide, roughness: 1 }));
      ring.rotation.x = Math.PI / 2.3;
      m.add(ring);
    }
    if (p.earth) {
      const moon = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), new THREE.MeshStandardMaterial({ color: 0xcccccc }));
      moon.position.x = 1.8;
      m.add(moon);
    }
    const orbit = new THREE.Mesh(new THREE.RingGeometry(p.d - 0.06, p.d + 0.06, 160), lineMat);
    orbit.rotation.x = -Math.PI / 2;
    g.add(m, orbit);
    return { m, p, a: i * 2.1 };
  });
  g.userData.tick = (t) => bodies.forEach(({ m, p, a }) => {
    const ang = a + t * p.s * 0.12;
    m.position.set(Math.cos(ang) * p.d, 0, Math.sin(ang) * p.d);
    m.rotation.y = t * 0.5;
  });
  return g;
}

/** 地月：幾顆人造衛星繞著地球。 */
export function makeSatellites() {
  const g = new THREE.Group();
  const body = new THREE.MeshStandardMaterial({ color: 0xd8d8e0, metalness: 0.8, roughness: 0.3 });
  const panel = new THREE.MeshStandardMaterial({ color: 0x2050c0, emissive: 0x0a2a80, metalness: 0.5, roughness: 0.4, side: THREE.DoubleSide });
  const sats = [0, 1, 2].map((i) => {
    const s = new THREE.Group();
    s.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.7), body));
    [-1, 1].forEach((k) => { const w = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.5), panel); w.position.x = k * 1; s.add(w); });
    const light = glowSprite(0xff5050, 0.8, 0.9);
    light.position.y = 0.4;
    s.add(light);
    const pivot = new THREE.Group();
    pivot.rotation.set(0.4 + i * 0.5, i * 1.7, 0.2 * i);
    pivot.add(s);
    g.add(pivot);
    return { s, light, d: 8.5 + i * 1.6, speed: 0.5 - i * 0.1, off: i * 2 };
  });
  g.userData.tick = (t) => sats.forEach((x) => {
    x.s.position.set(Math.cos(t * x.speed + x.off) * x.d, 0, Math.sin(t * x.speed + x.off) * x.d);
    x.s.rotation.y = -(t * x.speed + x.off);
    x.light.material.opacity = Math.sin(t * 5 + x.off) > 0.6 ? 1 : 0.15;
  });
  return g;
}

/** 在 GPU 上繞圈跑的光點：城市的車流、飄在空中的光塵。 */
function orbiters(count, place, { scale = 400, gain = 1 } = {}) {
  const orbit = new Float32Array(count * 4), col = new Float32Array(count * 3), size = new Float32Array(count);
  const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const p = place(i, c);
    orbit.set([p.r, p.y, p.a, p.speed], i * 4);
    col.set([c.r, c.g, c.b], i * 3);
    size[i] = p.size;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  geo.setAttribute('orbit', new THREE.BufferAttribute(orbit, 4));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('size', new THREE.BufferAttribute(size, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, scale: { value: scale }, gain: { value: gain } },
    vertexShader: /* glsl */ `attribute vec4 orbit; attribute vec3 color; attribute float size;
      uniform float time; uniform float scale; varying vec3 vColor;
      void main() {
        float a = orbit.z + time * orbit.w;
        vec3 p = vec3(cos(a) * orbit.x, orbit.y + sin(time * 0.7 + orbit.z * 3.0) * 0.6, sin(a) * orbit.x);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp(size * scale / -mv.z, 1.0, 9.0); // 太靠近鏡頭也不會變成大光球
        vColor = color;
      }`,
    fragmentShader: /* glsl */ `uniform float gain; varying vec3 vColor;
      void main() { float d = length(gl_PointCoord - 0.5); float a = 1.0 - smoothstep(0.0, 0.5, d); gl_FragColor = vec4(vColor * gain, a); }`,
    ...additive,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.userData.tick = (t) => { mat.uniforms.time.value = t; };
  return pts;
}

export function makeTraffic(reach) {
  const r = rng(0.37);
  return orbiters(320, (i, c) => {
    c.set(i % 3 === 0 ? 0x7cf2ff : i % 3 === 1 ? 0xffa040 : 0xffffff);
    const lane = Math.floor(r() * 7);
    return { r: 8 + lane * (reach / 7), y: 3 + (lane % 3) * 3.5, a: r() * TAU, speed: (r() > 0.5 ? 1 : -1) * (0.25 + r() * 0.2) / (1 + lane * 0.4), size: 1.4 + r() };
  }, { gain: 1.6 });
}

/** 光塵：每一格都有，讓畫面有前後層次。 */
export function makeMotes(reach, color) {
  const r = rng(0.58);
  const base = new THREE.Color(color);
  return orbiters(420, (i, c) => {
    c.copy(base).offsetHSL((r() - 0.5) * 0.1, 0, (r() - 0.5) * 0.2);
    return { r: r() * reach * 1.1, y: 1 + r() * 22, a: r() * TAU, speed: (r() - 0.5) * 0.04, size: 0.6 + r() * 1.4 };
  }, { gain: 0.9 });
}

/** 有水的浮空島：邊緣流下來的瀑布。 */
export function makeWaterfall(radius, angle, drop = 14) {
  const count = 140;
  const geo = new THREE.BufferGeometry();
  const seed = new Float32Array(count * 3);
  const r = rng(angle);
  for (let i = 0; i < count; i++) seed.set([(r() - 0.5) * 1.6, r(), 0.6 + r() * 0.8], i * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  geo.setAttribute('seed', new THREE.BufferAttribute(seed, 3));
  const mat = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, drop: { value: drop } },
    vertexShader: /* glsl */ `attribute vec3 seed; uniform float time; uniform float drop; varying float vA;
      void main() {
        float f = fract(time * 0.35 * seed.z + seed.y);
        vec3 p = vec3(seed.x, -f * f * drop, f * 1.2);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = max(1.0, (1.5 + f * 3.0) * 300.0 / -mv.z);
        vA = (1.0 - f) * 0.8;
      }`,
    fragmentShader: /* glsl */ `varying float vA;
      void main() { float d = length(gl_PointCoord - 0.5); float a = (1.0 - smoothstep(0.0, 0.5, d)) * vA; gl_FragColor = vec4(vec3(0.75, 0.95, 1.2) * a, a); }`,
    ...additive,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.position.set(Math.cos(angle) * radius, 0.4, Math.sin(angle) * radius);
  pts.rotation.y = -angle + Math.PI / 2;
  pts.userData.tick = (t) => { mat.uniforms.time.value = t; };
  return pts;
}

/** 生物格：一群會拍翅膀的鳥在島群上空盤旋。 */
export function makeBirds(reach) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x334455, side: THREE.DoubleSide });
  const wingGeo = new THREE.PlaneGeometry(0.9, 0.35);
  wingGeo.translate(0.45, 0, 0);
  wingGeo.rotateX(-Math.PI / 2);
  const r = rng(0.81);
  const birds = Array.from({ length: 14 }, (_, i) => {
    const b = new THREE.Group();
    const L = new THREE.Mesh(wingGeo, mat), R = new THREE.Mesh(wingGeo, mat);
    R.scale.x = -1;
    b.add(L, R);
    g.add(b);
    return { b, L, R, d: reach * (0.35 + r() * 0.5), y: 13 + r() * 6, off: (i / 14) * 1.2 + (i % 2) * 0.1, flap: 7 + r() * 3 };
  });
  g.userData.tick = (t) => birds.forEach((x) => {
    const a = t * 0.12 + x.off;
    x.b.position.set(Math.cos(a) * x.d, x.y + Math.sin(t + x.off * 5) * 0.6, Math.sin(a) * x.d);
    x.b.rotation.y = -a;
    const w = Math.sin(t * x.flap) * 0.7;
    x.L.rotation.z = w; x.R.rotation.z = -w;
  });
  return g;
}
