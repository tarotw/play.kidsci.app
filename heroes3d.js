// 宇宙好好聽：每一格正中間的「主角」3D 模型。大小依照那一格中間留下的空間決定。
import * as THREE from 'three';
import { TAU, NOISE, fresnelMaterial, glowSprite, makePoints, labelTexture, cached } from './kit3d.js';
import { rng } from './explorer.js';

const S = 0.1;
const additive = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending };

/** 中間空出來的半徑（3D 單位）與整格的半徑。 */
export function roomOf(sc) {
  const inner = Math.min(...sc.groups.map((z) => Math.hypot(z.x, z.y) - z.r)) * S;
  const b = sc.bounds;
  return { inner: Math.max(8, inner), reach: Math.max(-b.minX, b.maxX, -b.minY, b.maxY) * S };
}

// ---------- 星球 shader：岩石、氣體巨行星、冰巨行星、地球 ----------
const KIND = { rock: 0, gas: 1, ice: 2, earth: 3 };
export function planetMaterial(kind, { c1 = 0x888888, c2 = 0x444444, c3 = 0xffffff, seed = 0, light = null, spot = 0, rim = 0x6ab8ff } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 }, kind: { value: KIND[kind] }, seed: { value: seed }, spot: { value: spot },
      c1: { value: new THREE.Color(c1) }, c2: { value: new THREE.Color(c2) }, c3: { value: new THREE.Color(c3) }, rimColor: { value: new THREE.Color(rim) },
      lightDir: { value: light ? new THREE.Vector3(...light).normalize() : new THREE.Vector3() }, fixedLight: { value: light ? 1 : 0 },
    },
    vertexShader: /* glsl */ `varying vec3 vP; varying vec3 vN; varying vec3 vW;
      void main() { vP = position; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: NOISE + /* glsl */ `
      uniform float time; uniform int kind; uniform float seed; uniform float spot; uniform vec3 c1; uniform vec3 c2; uniform vec3 c3; uniform vec3 rimColor;
      uniform vec3 lightDir; uniform float fixedLight; varying vec3 vP; varying vec3 vN; varying vec3 vW;
      void main() {
        vec3 p = normalize(vP);
        vec3 col; vec3 glow = vec3(0.0);
        vec3 L = fixedLight > 0.5 ? lightDir : normalize(-vW);
        float diff = max(dot(vN, L), 0.0);
        if (kind == 0) {
          float n = fbm(p * 3.0 + seed);
          float craters = smoothstep(0.62, 0.7, fbm(p * 9.0 + seed * 2.0));
          col = mix(c1, c2, n) * (0.85 + 0.3 * craters) - craters * 0.08;
        } else if (kind == 1) {
          float lat = p.y + 0.1 * fbm(p * 4.0 + vec3(time * 0.03, seed, 0.0));
          float b = sin(lat * 20.0 + fbm(p * 2.0 + seed) * 3.0) * 0.5 + 0.5;
          col = mix(c1, c2, b);
          col = mix(col, c3, smoothstep(0.6, 0.9, fbm(p * 6.0 + seed)) * 0.35);
          if (spot > 0.5) {
            vec2 q = vec2(atan(p.z, p.x) - 0.8, (p.y + 0.35) * 2.2);
            col = mix(col, vec3(0.75, 0.3, 0.18), smoothstep(0.32, 0.12, length(q)));
          }
        } else if (kind == 2) {
          float b = sin(p.y * 7.0 + fbm(p * 3.0 + seed) * 1.5) * 0.5 + 0.5;
          col = mix(c1, c2, b * 0.45);
        } else {
          float h = fbm(p * 2.4 + 7.0);
          vec3 ocean = mix(vec3(0.02, 0.14, 0.42), vec3(0.05, 0.32, 0.68), h);
          vec3 land = mix(vec3(0.13, 0.42, 0.14), vec3(0.55, 0.45, 0.25), smoothstep(0.56, 0.72, h));
          bool isLand = h > 0.52;
          col = isLand ? land : ocean;
          col = mix(col, vec3(0.95), smoothstep(0.8, 0.9, abs(p.y)));
          float cloud = smoothstep(0.55, 0.8, fbm(p * 4.0 + vec3(time * 0.01, 3.0, 0.0)));
          col = mix(col, vec3(1.0), cloud * 0.6);
          float city = isLand ? step(0.72, noise3(p * 40.0)) : 0.0;
          glow = vec3(0.9, 0.72, 0.42) * city * (1.0 - cloud) * smoothstep(0.15, 0.0, diff);
        }
        vec3 V = normalize(cameraPosition - vW);
        float fr = pow(1.0 - max(dot(vN, V), 0.0), 3.0);
        gl_FragColor = vec4(col * (0.06 + diff * 1.1) + glow + rimColor * fr * (0.15 + diff * 0.8), 1.0);
      }`,
  });
}

export function ringMaterial(inner, outer, colors) {
  return new THREE.ShaderMaterial({
    uniforms: { inner: { value: inner }, outer: { value: outer }, c1: { value: new THREE.Color(colors[0]) }, c2: { value: new THREE.Color(colors[1]) } },
    vertexShader: /* glsl */ `varying vec3 vP; varying vec3 vW; void main() { vP = position; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `uniform float inner; uniform float outer; uniform vec3 c1; uniform vec3 c2; varying vec3 vP; varying vec3 vW;
      void main() {
        float t = (length(vP.xy) - inner) / (outer - inner);
        float bands = 0.55 + 0.45 * sin(t * 60.0) * sin(t * 13.0 + 1.0);
        float gap = smoothstep(0.58, 0.6, t) * (1.0 - smoothstep(0.63, 0.65, t));
        float a = bands * (1.0 - gap) * smoothstep(0.0, 0.05, t) * (1.0 - smoothstep(0.95, 1.0, t)) * 0.85;
        gl_FragColor = vec4(mix(c1, c2, t) * 0.9, a);
      }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
  });
}

export function sunSurface(radius) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 } },
    vertexShader: /* glsl */ `varying vec3 vP; varying vec3 vN; varying vec3 vV;
      void main() { vP = position; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: NOISE + /* glsl */ `uniform float time; varying vec3 vP; varying vec3 vN; varying vec3 vV;
      void main() {
        vec3 p = normalize(vP) * 4.0;
        float cells = fbm(p * 1.6 + vec3(time * 0.12, -time * 0.08, time * 0.05));
        float spots = smoothstep(0.72, 0.8, fbm(p * 0.7 + 11.0));
        vec3 c = mix(vec3(1.2, 0.62, 0.3), vec3(1.5, 1.15, 0.72), smoothstep(0.35, 0.75, cells));
        c *= 1.0 - spots * 0.6;
        float rim = pow(1.0 - max(dot(vN, vV), 0.0), 2.0);
        gl_FragColor = vec4(c * (1.0 - rim * 0.35) + rim * vec3(0.9, 0.5, 0.28), 1.0);
      }`,
  });
  return { mesh: new THREE.Mesh(new THREE.SphereGeometry(radius, 72, 48), mat), mat };
}

// ---------- 07 太陽系 ----------
export function heroSolarSystem(sc) {
  const { inner, reach } = roomOf(sc);
  const g = new THREE.Group();
  const R = Math.min(6, inner * 0.42);
  const sun = sunSurface(R);
  const corona = new THREE.Mesh(new THREE.SphereGeometry(R * 1.18, 48, 32), fresnelMaterial(0xf5b07a, 1.6, 1.6));
  g.add(sun.mesh, corona, glowSprite(0xf5c08a, R * 5, 0.6), glowSprite(0xf09a70, R * 12, 0.18));
  // 日珥：太陽表面跳起來的火焰拱
  const flares = [0, 1, 2, 3].map((i) => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(R * 0.32, R * 0.05, 8, 32, Math.PI), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.1, 0.62, 0.36), ...additive }));
    const pivot = new THREE.Group();
    pivot.rotation.set(i * 1.3, i * 2.1, i * 0.7);
    m.position.y = R * 0.92;
    pivot.add(m);
    g.add(pivot);
    return { m, off: i * 1.7 };
  });

  const span = inner - 0.6 - (R + 1.6);
  const innerD = [0, 1, 2, 3].map((i) => R + 1.6 + (span * i) / 3);
  const outerD = [reach + 10, reach + 20, reach + 29, reach + 37];
  const spec = [
    { r: 0.38, d: innerD[0], kind: 'rock', c1: 0x9a8c80, c2: 0x5a524c, s: 1.6 },
    { r: 0.62, d: innerD[1], kind: 'rock', c1: 0xf0d8a0, c2: 0xc89a50, s: 1.2, rim: 0xffe0a0 },
    { r: 0.66, d: innerD[2], kind: 'earth', s: 1.0, moon: true },
    { r: 0.5, d: innerD[3], kind: 'rock', c1: 0xd8703a, c2: 0x8a3a20, s: 0.8, rim: 0xff9070 },
    { r: 3.0, d: outerD[0], kind: 'gas', c1: 0xe8d0b0, c2: 0xb07848, c3: 0xffffff, s: 0.45, spot: 1, rim: 0xffd0a0 },
    { r: 2.6, d: outerD[1], kind: 'gas', c1: 0xf0e0b0, c2: 0xc8a868, c3: 0xfff0d0, s: 0.35, ring: true, rim: 0xffe0b0 },
    { r: 1.7, d: outerD[2], kind: 'ice', c1: 0x9ae8f0, c2: 0x6ac0d8, s: 0.26, tilt: 1.7, rim: 0xb0ffff },
    { r: 1.65, d: outerD[3], kind: 'ice', c1: 0x4a70f0, c2: 0x2a40b0, s: 0.2, rim: 0x80a0ff },
  ];
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xffc890, ...additive, opacity: 0.18, side: THREE.DoubleSide });
  const mats = [sun.mat];
  const bodies = spec.map((p, i) => {
    const mat = planetMaterial(p.kind, { ...p, seed: i * 3.7 });
    mats.push(mat);
    const m = new THREE.Mesh(new THREE.SphereGeometry(p.r, 48, 32), mat);
    const holder = new THREE.Group();
    holder.rotation.z = p.tilt ? p.tilt : 0.3;
    holder.add(m);
    if (p.ring) {
      const ringMesh = new THREE.Mesh(new THREE.RingGeometry(p.r * 1.3, p.r * 2.4, 96), ringMaterial(p.r * 1.3, p.r * 2.4, [0xc8b080, 0xf0e8d0]));
      ringMesh.rotation.x = Math.PI / 2;
      holder.add(ringMesh);
    }
    if (p.moon) {
      const moon = new THREE.Mesh(new THREE.SphereGeometry(0.2, 20, 14), planetMaterial('rock', { c1: 0xcccccc, c2: 0x777777, seed: 9 }));
      mats.push(moon.material);
      holder.add(moon);
      p.moonMesh = moon;
    }
    const orbit = new THREE.Mesh(new THREE.RingGeometry(p.d - 0.05, p.d + 0.05, 180), lineMat);
    orbit.rotation.x = -Math.PI / 2;
    g.add(holder, orbit);
    return { holder, m, p, a: i * 2.1 };
  });
  // 小行星帶：在平台和木星之間
  const r = rng(0.29);
  const belt = makePoints(1400, (i, c) => {
    const a = r() * TAU, d = reach + 3 + r() * 4;
    c.setHSL(0.08, 0.25, 0.45 + r() * 0.25);
    return { pos: [Math.cos(a) * d, (r() - 0.5) * 1.2, Math.sin(a) * d], size: 0.6 + r() * 1.2 };
  }, { scale: 420, gain: 0.7 });
  g.add(belt);
  g.userData.tick = (t) => {
    mats.forEach((m) => { m.uniforms.time.value = t; });
    sun.mesh.rotation.y = t * 0.04;
    corona.scale.setScalar(1 + Math.sin(t * 1.3) * 0.02);
    flares.forEach(({ m, off }) => { const k = 0.6 + 0.4 * Math.sin(t * 0.9 + off); m.scale.setScalar(k); m.material.opacity = k; });
    belt.rotation.y = t * 0.01;
    bodies.forEach(({ holder, m, p, a }) => {
      const ang = a + t * p.s * 0.12;
      holder.position.set(Math.cos(ang) * p.d, 0, Math.sin(ang) * p.d);
      m.rotation.y = t * 0.6;
      if (p.moonMesh) p.moonMesh.position.set(Math.cos(t * 1.2) * 1.2, 0, Math.sin(t * 1.2) * 1.2);
    });
  };
  return g;
}

// ---------- 06 地球與月球 ----------
export function heroEarthMoon(sc) {
  const { inner } = roomOf(sc);
  const g = new THREE.Group();
  const R = Math.min(8, inner * 0.45);
  const light = [1, 0.35, 0.6];
  const earthMat = planetMaterial('earth', { light, rim: 0x6ab8ff });
  const earth = new THREE.Mesh(new THREE.SphereGeometry(R, 72, 48), earthMat);
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(R * 1.07, 48, 32), fresnelMaterial(0x5ab8ff, 2.4, 1.6));
  const tiltG = new THREE.Group();
  tiltG.rotation.z = 0.41; // 地軸傾斜 23.5 度
  tiltG.add(earth);
  const moonD = Math.min(inner * 0.92, R * 2.4);
  const moonMat = planetMaterial('rock', { c1: 0xd8d8d8, c2: 0x8a8a8a, seed: 5, light, rim: 0xffffff });
  const moon = new THREE.Mesh(new THREE.SphereGeometry(R * 0.27, 40, 28), moonMat);
  const orbit = new THREE.Mesh(new THREE.RingGeometry(moonD - 0.06, moonD + 0.06, 160), new THREE.MeshBasicMaterial({ color: 0x9fb8ff, ...additive, opacity: 0.25, side: THREE.DoubleSide }));
  orbit.rotation.x = -Math.PI / 2;
  const sys = new THREE.Group();
  sys.position.y = R * 0.6;
  sys.add(tiltG, atmo, moon, orbit);
  g.add(sys);
  // 人造衛星與國際太空站
  const body = new THREE.MeshStandardMaterial({ color: 0xd8d8e0, metalness: 0.8, roughness: 0.3, emissive: 0x222228 });
  const panel = new THREE.MeshStandardMaterial({ color: 0x2050c0, emissive: 0x0a2a80, metalness: 0.5, roughness: 0.4, side: THREE.DoubleSide });
  const sats = [0, 1, 2].map((i) => {
    const s = new THREE.Group();
    s.add(new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.65), body));
    [-1, 1].forEach((k) => { const w = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.45), panel); w.position.x = k * 0.95; s.add(w); });
    const blink = glowSprite(0xff5050, 0.9, 0.9);
    blink.position.y = 0.4;
    s.add(blink);
    const pivot = new THREE.Group();
    pivot.rotation.set(0.4 + i * 0.5, i * 1.7, 0.2 * i);
    pivot.add(s);
    sys.add(pivot);
    return { s, blink, d: R * 1.25 + i * 0.9, speed: 0.5 - i * 0.1, off: i * 2 };
  });
  g.userData.tick = (t) => {
    earthMat.uniforms.time.value = t;
    earth.rotation.y = t * 0.1;
    const ma = t * 0.15;
    moon.position.set(Math.cos(ma) * moonD, 0, Math.sin(ma) * moonD);
    moon.rotation.y = -ma; // 月球永遠同一面朝地球
    sats.forEach((x) => {
      x.s.position.set(Math.cos(t * x.speed + x.off) * x.d, 0, Math.sin(t * x.speed + x.off) * x.d);
      x.s.rotation.y = -(t * x.speed + x.off);
      x.blink.material.opacity = Math.sin(t * 5 + x.off) > 0.6 ? 1 : 0.15;
    });
  };
  return g;
}

// ---------- 05 地球剖面 ----------
function pillTexture(text, color) {
  return cached(`pill:${text}:${color}`, () => {
    const c = document.createElement('canvas');
    const g = c.getContext('2d');
    const font = '800 44px "Noto Sans TC","PingFang TC",sans-serif';
    g.font = font;
    const w = Math.ceil(g.measureText(text).width) + 40;
    c.width = w; c.height = 72;
    g.fillStyle = 'rgba(8,12,24,0.82)'; g.strokeStyle = color; g.lineWidth = 4;
    g.beginPath(); g.roundRect(2, 2, w - 4, 68, 34); g.fill(); g.stroke();
    g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = color;
    g.fillText(text, w / 2, 38);
    return c;
  });
}
function textSprite(text, color, h = 2) {
  const tex = pillTexture(text, color);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false, toneMapped: false }));
  s.scale.set(h * (tex.image.width / tex.image.height), h, 1);
  s.renderOrder = 5;
  return s;
}
function magmaMaterial(c1, c2, speed) {
  return new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, c1: { value: c1 }, c2: { value: c2 }, speed: { value: speed } },
    vertexShader: /* glsl */ `varying vec3 vP; void main() { vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: NOISE + /* glsl */ `uniform float time; uniform vec3 c1; uniform vec3 c2; uniform float speed; varying vec3 vP;
      void main() { float n = fbm(normalize(vP) * 3.0 + vec3(0.0, time * speed, time * speed * 0.5)); gl_FragColor = vec4(mix(c1, c2, smoothstep(0.3, 0.8, n)), 1.0); }`,
    side: THREE.DoubleSide,
  });
}
export function heroEarthCore(sc) {
  const { inner } = roomOf(sc);
  const g = new THREE.Group();
  const R = Math.min(20, inner * 0.55);
  const crustMat = planetMaterial('earth', { light: [0.6, 0.6, 0.8], rim: 0x6ab8ff });
  crustMat.side = THREE.DoubleSide;
  const crust = new THREE.Mesh(new THREE.SphereGeometry(R, 72, 48, 0, Math.PI * 1.5), crustMat);
  const layers = [
    { r: 0.82, m: magmaMaterial(new THREE.Color(0.45, 0.09, 0.02), new THREE.Color(0.85, 0.28, 0.05), 0.05), name: '地函', col: '#ff8a4a' },
    { r: 0.52, m: magmaMaterial(new THREE.Color(0.75, 0.32, 0.05), new THREE.Color(0.95, 0.55, 0.12), 0.12), name: '外核', col: '#ffc04a' },
    { r: 0.27, m: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.05, 0.85, 0.45) }), name: '內核', col: '#fff2b0' },
  ];
  const spin = new THREE.Group();
  spin.add(crust);
  // 剖開的兩個切面：一圈一圈的半圓環，看得到每一層
  const bands = [{ from: 1, to: 0.82, m: new THREE.MeshBasicMaterial({ color: 0x7a5434, side: THREE.DoubleSide }) },
    ...layers.map((l, i) => ({ from: l.r, to: layers[i + 1]?.r ?? 0, m: l.m }))];
  bands.forEach((b) => { if (!b.m.side) b.m.side = THREE.DoubleSide; });
  layers[2].m.side = THREE.DoubleSide;
  [0, Math.PI * 1.5].forEach((phi) => {
    const cap = new THREE.Group();
    bands.forEach((b) => {
      const geo = b.to > 0 ? new THREE.RingGeometry(R * b.to, R * b.from, 64, 1, Math.PI / 2, Math.PI) : new THREE.CircleGeometry(R * b.from, 64, Math.PI / 2, Math.PI);
      cap.add(new THREE.Mesh(geo, b.m));
    });
    cap.rotation.y = phi; // 半圓朝 -x，轉到切口的方向
    spin.add(cap);
  });
  spin.add(new THREE.Mesh(new THREE.SphereGeometry(R * 0.27, 40, 28), layers[2].m));
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(R * 1.06, 48, 32), fresnelMaterial(0x5ab8ff, 2.5, 1.3));
  const sys = new THREE.Group();
  sys.position.y = R * 0.55;
  sys.add(spin, atmo, glowSprite(0xff8a30, R * 2.2, 0.1));
  // 每一層的名字，放在切開的缺口裡
  // 標在 phi=0 那一面上，從外到內排成一列，稍微往缺口裡浮出來
  const face = new THREE.Vector3(-1, 0, 0), out = new THREE.Vector3(0, 0, -1);
  [{ name: '地殼', col: '#9fe0ff', at: 0.91 }, { name: '地函', col: '#ffb07a', at: 0.67 }, { name: '外核', col: '#ffd27a', at: 0.4 }, { name: '內核', col: '#fff2b0', at: 0.1 }]
    .forEach((l, i) => {
      const tag = textSprite(l.name, l.col, R * 0.1);
      tag.position.copy(face).multiplyScalar(R * l.at).addScaledVector(out, R * 0.12).setY(R * (i % 2 ? -0.07 : 0.07));
      spin.add(tag);
    });
  g.add(sys);
  let facing = 0;
  g.userData.face = (cam) => { facing = Math.atan2(cam.x, cam.z); };
  g.userData.tick = (t) => {
    layers.forEach((l) => { if (l.m.uniforms) l.m.uniforms.time.value = t; });
    crustMat.uniforms.time.value = t;
    spin.rotation.y = facing + Math.PI * 0.75 + Math.sin(t * 0.15) * 0.45; // 來回轉，缺口一直朝著小朋友
  };
  return g;
}

// ---------- 01 原子 ----------
export function heroAtom(sc) {
  const { inner } = roomOf(sc);
  const g = new THREE.Group();
  const orbitR = Math.min(18, inner * 0.82);
  const sys = new THREE.Group();
  sys.position.y = orbitR * 0.45;
  g.add(sys);
  const nucleus = new THREE.Group();
  const proton = new THREE.MeshStandardMaterial({ color: 0xf0909a, emissive: 0x3a1a20, roughness: 0.5, metalness: 0.05 });
  const neutron = new THREE.MeshStandardMaterial({ color: 0x92aae6, emissive: 0x1a2440, roughness: 0.5, metalness: 0.05 });
  const ball = new THREE.SphereGeometry(1.25, 28, 20);
  const n = 24;
  for (let i = 0; i < n; i++) {
    const y = 1 - (2 * (i + 0.5)) / n, r = Math.sqrt(1 - y * y), a = i * 2.399;
    const m = new THREE.Mesh(ball, i % 2 ? proton : neutron);
    const d = 1.9 + (i % 3) * 0.35;
    m.position.set(Math.cos(a) * r * d, y * d, Math.sin(a) * r * d);
    nucleus.add(m);
  }
  sys.add(nucleus, glowSprite(0xf5d2b8, 12, 0.35));
  // 電子雲：機率雲的感覺
  const r = rng(0.44);
  const cloud = makePoints(1800, (i, c) => {
    const u = r() * 2 - 1, a = r() * TAU, d = orbitR * (0.3 + Math.pow(r(), 0.6) * 0.75), s = Math.sqrt(1 - u * u);
    c.setHSL(0.52 + r() * 0.1, 0.9, 0.6);
    return { pos: [Math.cos(a) * s * d, u * d * 0.8, Math.sin(a) * s * d], size: 0.6 + r() };
  }, { scale: 400, gain: 0.25 });
  sys.add(cloud);
  const electrons = [0, 1, 2].map((k) => {
    const orbit = new THREE.Group();
    orbit.rotation.set(Math.PI / 2 + (k - 1) * 0.95, k * 1.05, 0);
    const path = new THREE.Mesh(new THREE.TorusGeometry(orbitR, 0.09, 8, 200), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.72, 0.66, 0.95), ...additive, opacity: 0.45 }));
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.75, 20, 14), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.75, 1.0, 0.98) }));
    e.add(glowSprite(0xbfeee6, 6, 0.7));
    // 拖尾：沿著軌道跟在電子後面的光點
    const trail = makePoints(40, (i, c) => { c.setRGB(0.6, 0.85, 0.85); return { pos: [0, 0, 0], size: 2.6 * (1 - i / 40), phase: 0 }; }, { scale: 400, gain: 1 });
    trail.frustumCulled = false;
    orbit.add(path, e, trail);
    sys.add(orbit);
    return { e, trail, speed: 0.9 + k * 0.3, off: k * 2.1 };
  });
  g.userData.tick = (t) => {
    nucleus.rotation.set(t * 0.2, t * 0.35, 0);
    nucleus.children.forEach((m, i) => m.scale.setScalar(1 + Math.sin(t * 6 + i) * 0.03));
    cloud.rotation.y = t * 0.05;
    cloud.material.uniforms.time.value = t;
    electrons.forEach(({ e, trail, speed, off }) => {
      const a = t * speed + off;
      e.position.set(Math.cos(a) * orbitR, Math.sin(a) * orbitR, 0);
      const p = trail.geometry.attributes.position;
      for (let i = 0; i < 40; i++) { const b = a - i * 0.035; p.setXYZ(i, Math.cos(b) * orbitR, Math.sin(b) * orbitR, 0); }
      p.needsUpdate = true;
    });
  };
  return g;
}

// ---------- 02 細胞 ----------
export function heroCell(sc) {
  const { inner } = roomOf(sc);
  const g = new THREE.Group();
  const R = Math.min(20, inner * 0.72);
  const sys = new THREE.Group();
  sys.position.y = R * 0.55;
  g.add(sys);
  const memMat = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, color: { value: new THREE.Color(0xf0a6c4) } },
    vertexShader: NOISE + /* glsl */ `uniform float time; varying vec3 vN; varying vec3 vV;
      void main() {
        vec3 p = position + normal * (fbm(position * 0.18 + time * 0.25) - 0.5) * 1.6;
        vec4 mv = modelViewMatrix * vec4(p, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `uniform vec3 color; varying vec3 vN; varying vec3 vV;
      void main() { float f = pow(1.0 - max(dot(vN, vV), 0.0), 2.2); gl_FragColor = vec4(color * (0.08 + f * 1.0), 0.08 + f * 0.7); }`,
    ...additive,
  });
  const membrane = new THREE.Mesh(new THREE.SphereGeometry(R, 96, 64), memMat);
  const nucleusMat = planetMaterial('gas', { c1: 0xa894e2, c2: 0x7464b4, c3: 0xe0d0f4, seed: 2, light: [0.4, 1, 0.6], rim: 0xe0d0f4 });
  const nucleus = new THREE.Mesh(new THREE.SphereGeometry(R * 0.28, 48, 32), nucleusMat);
  const nucleolus = new THREE.Mesh(new THREE.SphereGeometry(R * 0.1, 24, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.98, 0.76, 1.0) }));
  nucleolus.position.set(R * 0.08, R * 0.06, R * 0.12);
  sys.add(membrane, nucleus, nucleolus);
  const r = rng(0.12);
  const inside = () => { const a = r() * TAU, b = Math.acos(r() * 2 - 1), d = R * (0.42 + r() * 0.4); return new THREE.Vector3(Math.cos(a) * Math.sin(b) * d, Math.cos(b) * d * 0.8, Math.sin(a) * Math.sin(b) * d); };
  const parts = [];
  const mito = new THREE.MeshStandardMaterial({ color: 0xf3b484, emissive: 0x3a2214, roughness: 0.55 });
  const mitoGeo = new THREE.CapsuleGeometry(R * 0.045, R * 0.14, 6, 12);
  for (let i = 0; i < 12; i++) { const m = new THREE.Mesh(mitoGeo, mito); m.position.copy(inside()); m.rotation.set(r() * 3, r() * 3, r() * 3); parts.push(m); }
  const golgi = new THREE.MeshStandardMaterial({ color: 0xa4dccb, emissive: 0x16362c, roughness: 0.5 });
  const gPos = inside();
  for (let i = 0; i < 5; i++) {
    const m = new THREE.Mesh(new THREE.TorusGeometry(R * (0.12 - i * 0.012), R * 0.012, 6, 32, Math.PI * 1.2), golgi);
    m.position.copy(gPos).add(new THREE.Vector3(0, i * R * 0.03, 0));
    m.rotation.x = Math.PI / 2;
    parts.push(m);
  }
  const er = new THREE.Mesh(new THREE.TorusKnotGeometry(R * 0.36, R * 0.014, 220, 8, 3, 7), new THREE.MeshStandardMaterial({ color: 0xa8c8ee, emissive: 0x16283a, transparent: true, opacity: 0.6 }));
  parts.push(er);
  const ribo = makePoints(500, (i, c) => { const p = inside(); c.setRGB(0.92, 0.86, 1.0); return { pos: [p.x, p.y, p.z], size: 0.5 + r() * 0.6 }; }, { scale: 360, gain: 0.8 });
  parts.push(ribo);
  parts.forEach((p) => sys.add(p));
  g.userData.tick = (t) => {
    memMat.uniforms.time.value = t;
    nucleusMat.uniforms.time.value = t;
    nucleus.rotation.y = t * 0.1;
    er.rotation.set(t * 0.03, t * 0.05, 0);
    parts.forEach((p, i) => { if (p !== er) p.rotation.y += 0.002 * (i % 5 + 1); });
    sys.rotation.y = t * 0.03;
    ribo.material.uniforms.time.value = t;
  };
  return g;
}

// ---------- 錄音室 ----------
function noteTexture(ch) {
  return cached(`note:${ch}`, () => {
    const c = document.createElement('canvas');
    c.width = c.height = 96;
    const g = c.getContext('2d');
    g.font = '700 72px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = '#ffb040'; g.shadowBlur = 14; g.fillStyle = '#ffe6b0';
    g.fillText(ch, 48, 52);
    return c;
  });
}
function onAirTexture() {
  return cached('onair', () => {
    const c = document.createElement('canvas');
    c.width = 320; c.height = 112;
    const g = c.getContext('2d');
    g.fillStyle = '#3a1c26'; g.strokeStyle = '#ee9a9a'; g.lineWidth = 8;
    g.beginPath(); g.roundRect(6, 6, 308, 100, 22); g.fill(); g.stroke();
    g.font = '900 64px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = 'rgba(238,120,120,0.6)'; g.shadowBlur = 10; g.fillStyle = '#ffe6e0';
    g.fillText('ON AIR', 160, 60);
    return c;
  });
}
export function heroStudio(sc) {
  const { reach } = roomOf(sc);
  const g = new THREE.Group();
  const back = -Math.max(14, reach * 0.8);
  const mic = new THREE.Group();
  mic.position.set(0, 0, back);
  mic.scale.setScalar(1.05);
  const metal = new THREE.MeshStandardMaterial({ color: 0x9aa8b8, metalness: 0.9, roughness: 0.25, emissive: 0x111418 });
  const head = new THREE.Mesh(new THREE.CapsuleGeometry(2.2, 3, 8, 32), new THREE.MeshStandardMaterial({ color: 0x2f4f6f, emissive: 0x0a2030, metalness: 0.6, roughness: 0.3 }));
  head.position.y = 9;
  const grill = new THREE.Mesh(new THREE.CapsuleGeometry(2.26, 3, 8, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.95, 0.78, 0.55), wireframe: true, transparent: true, opacity: 0.45 }));
  grill.position.y = 9;
  const band = new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.22, 10, 40), metal);
  band.position.y = 9; band.rotation.x = Math.PI / 2;
  const yoke = new THREE.Mesh(new THREE.TorusGeometry(3, 0.25, 10, 40, Math.PI), metal);
  yoke.position.y = 8.5; yoke.rotation.z = Math.PI;
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 6, 12), metal);
  stand.position.y = 3;
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.6, 0.5, 32), metal);
  foot.position.y = 0.25;
  mic.add(head, grill, band, yoke, stand, foot);
  const sign = new THREE.Sprite(new THREE.SpriteMaterial({ map: onAirTexture(), toneMapped: false, transparent: true }));
  sign.scale.set(9, 3.15, 1);
  sign.position.set(0, 17, back);
  const signGlow = glowSprite(0xee8a8a, 16, 0.3);
  signGlow.position.copy(sign.position);
  g.add(mic, sign, signGlow);
  // 聲波：從麥克風一圈一圈擴散出去
  const waves = [0, 1, 2, 3].map(() => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(1, 0.05, 6, 64), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.82, 0.58), ...additive, opacity: 0 }));
    m.position.set(0, 9.5, back);
    g.add(m);
    return m;
  });
  const notes = Array.from({ length: 8 }, (_, i) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: noteTexture(i % 2 ? '♫' : '♪'), toneMapped: false, transparent: true, depthWrite: false }));
    s.scale.setScalar(2.4);
    g.add(s);
    return { s, off: i / 8, x: (i % 4 - 1.5) * 4 };
  });
  g.userData.tick = (t) => {
    waves.forEach((m, i) => {
      const k = (t * 0.4 + i / 4) % 1;
      m.scale.setScalar(2.6 + k * 14);
      m.material.opacity = (1 - k) * 0.35;
    });
    notes.forEach(({ s, off, x }) => {
      const k = (t * 0.12 + off) % 1;
      s.position.set(x + Math.sin(t + off * 9) * 1.5, 5 + k * 16, back + 4);
      s.material.opacity = Math.sin(k * Math.PI);
    });
    signGlow.material.opacity = 0.25 + 0.15 * Math.sin(t * 3);
  };
  return g;
}
