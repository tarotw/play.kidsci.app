// 宇宙好好聽：3D 探索畫面（Three.js r170，跟 lab.kidsci.app/solar-system 同一套技術）。
// 介面跟 explorer.js（2D 版）一樣；沒有 WebGL 的裝置由 app.js 改用 2D 版。
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { buildScene, iconFor, Sound, hash, rng, THEMES } from './explorer.js';
import { TAU, NOISE, pointsMaterial, makePoints, fresnelMaterial, flowMaterial, textureCache, cached, glowTexture, EMOJI_FONT, badgeTexture, labelTexture, ring, glowSprite } from './kit3d.js';
import * as fx from './fx3d.js';

const S = 0.1; // 2D 版面單位 → 3D 單位
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// ---------- 各格的主視覺 ----------
function makeSun(sc) {
  const g = new THREE.Group();
  const mat = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 } },
    vertexShader: /* glsl */ `varying vec3 vP; varying vec3 vN; varying vec3 vV;
      void main() { vP = position; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: NOISE + /* glsl */ `uniform float time; varying vec3 vP; varying vec3 vN; varying vec3 vV;
      void main() {
        float n = fbm(vP * 0.55 + vec3(time * 0.15, -time * 0.1, time * 0.05));
        vec3 c = mix(vec3(1.9, 0.75, 0.12), vec3(2.6, 2.0, 0.9), smoothstep(0.35, 0.75, n));
        float rim = pow(1.0 - max(dot(vN, vV), 0.0), 2.0);
        gl_FragColor = vec4(c + rim * vec3(1.6, 0.6, 0.1), 1.0);
      }`,
  });
  const sun = new THREE.Mesh(new THREE.SphereGeometry(7, 64, 48), mat);
  g.add(sun, glowSprite(0xffa040, 36, 0.75), glowSprite(0xff6a10, 80, 0.25));
  const radii = new Set(sc.groups.map((z) => Math.round(Math.hypot(z.x, z.y) * S)));
  [...radii, 18, 26].forEach((r) => g.add(ring(r, 0xffc070, 0.16, 0.06)));
  g.userData.tick = (t) => { mat.uniforms.time.value = t; sun.rotation.y = t * 0.05; };
  return g;
}

function earthMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, sunDir: { value: new THREE.Vector3(0.7, 0.4, 0.6).normalize() } },
    vertexShader: /* glsl */ `varying vec3 vP; varying vec3 vNW;
      void main() { vP = position; vNW = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: NOISE + /* glsl */ `uniform vec3 sunDir; varying vec3 vP; varying vec3 vNW;
      void main() {
        vec3 p = normalize(vP);
        float h = fbm(p * 2.4);
        float lat = abs(p.y);
        vec3 ocean = mix(vec3(0.02, 0.18, 0.45), vec3(0.05, 0.35, 0.7), h);
        vec3 land = mix(vec3(0.15, 0.45, 0.15), vec3(0.55, 0.45, 0.25), smoothstep(0.55, 0.75, h));
        vec3 c = h > 0.52 ? land : ocean;
        c = mix(c, vec3(0.95), smoothstep(0.78, 0.9, lat));
        float cloud = smoothstep(0.55, 0.8, fbm(p * 4.0 + 3.0));
        c = mix(c, vec3(1.0), cloud * 0.55);
        float light = max(dot(vNW, sunDir), 0.0) * 0.95 + 0.12;
        gl_FragColor = vec4(c * light, 1.0);
      }`,
  });
}
function makeEarthMoon() {
  const g = new THREE.Group();
  const earth = new THREE.Mesh(new THREE.SphereGeometry(6, 64, 48), earthMaterial());
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(6.5, 48, 32), fresnelMaterial(0x5ab8ff, 2.5, 1.8));
  const moon = new THREE.Mesh(new THREE.SphereGeometry(1.6, 32, 24), new THREE.MeshStandardMaterial({ color: 0xcfd3dc, roughness: 1, flatShading: true }));
  const orbit = ring(20, 0x9fb8ff, 0.2, 0.05);
  g.add(earth, atmo, moon, orbit);
  g.userData.tick = (t) => { earth.rotation.y = t * 0.12; moon.position.set(Math.cos(t * 0.2) * 20, 1, Math.sin(t * 0.2) * 20); };
  return g;
}
function makeEarthCore() {
  const g = new THREE.Group();
  const crust = new THREE.Mesh(new THREE.SphereGeometry(13, 64, 48, 0, Math.PI * 1.5), earthMaterial());
  crust.material.side = THREE.DoubleSide;
  const mantle = new THREE.Mesh(new THREE.SphereGeometry(10.5, 48, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 0.45, 0.12) }));
  const outer = new THREE.Mesh(new THREE.SphereGeometry(6.5, 48, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.9, 0.9, 0.2) }));
  const inner = new THREE.Mesh(new THREE.SphereGeometry(3.4, 32, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 2.2, 1.2) }));
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(13.8, 48, 32), fresnelMaterial(0x5ab8ff, 2.5, 1.5));
  const spin = new THREE.Group();
  spin.add(crust, mantle, outer, inner);
  spin.position.y = 6;
  atmo.position.y = 6;
  g.add(spin, atmo, glowSprite(0xff8a30, 40, 0.5));
  g.children[2].position.y = 6;
  g.userData.tick = (t) => { spin.rotation.y = t * 0.08; };
  return g;
}
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
  const core = new THREE.Color(1.0, 0.85, 0.6), arm = new THREE.Color(0.45, 0.6, 1.0), pink = new THREE.Color(1.0, 0.5, 0.9);
  g.add(makePoints(count, (i, c) => {
    const armI = i % 3, t = Math.pow(r(), 0.7);
    const d = t * 90;
    const a = t * 7.5 + armI * (TAU / 3);
    const spread = (1 - t * 0.6) * 9 * (r() - 0.5);
    c.copy(core).lerp(r() < 0.1 ? pink : arm, Math.min(1, t * 1.4));
    return { pos: [Math.cos(a) * d + spread, (r() - 0.5) * (4 - t * 3), Math.sin(a) * d + spread], size: 1 + r() * 2.5 };
  }, { scale: 380, gain: 0.32 }));
  g.add(glowSprite(0xffe2b0, 30, 0.8), glowSprite(0xffb0ff, 90, 0.15));
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
  g.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0xb070ff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending })));
  g.add(makePoints(5000, (i, c) => {
    const n = nodes[i % nodes.length];
    const spread = 2 + Math.pow(r(), 3) * 14;
    c.setHSL(0.75 + r() * 0.15, 0.8, 0.7);
    return { pos: [n.x + (r() - 0.5) * spread, n.y + (r() - 0.5) * spread, n.z + (r() - 0.5) * spread], size: 1 + r() * 3 };
  }, { scale: 500, gain: 0.55 }));
  g.add(glowSprite(0xffffff, 24, 0.6));
  g.userData.tick = (t) => { g.rotation.y = t * 0.015; };
  return g;
}
function makeAtom() {
  const g = new THREE.Group();
  const nucleus = new THREE.Group();
  const r = rng(0.44);
  for (let i = 0; i < 14; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1.1, 24, 16), new THREE.MeshStandardMaterial({ color: i % 2 ? 0xff5a5a : 0x5a8cff, emissive: i % 2 ? 0x551010 : 0x102055, roughness: 0.4 }));
    m.position.set((r() - 0.5) * 2.6, (r() - 0.5) * 2.6, (r() - 0.5) * 2.6);
    nucleus.add(m);
  }
  nucleus.position.y = 5;
  g.add(nucleus, glowSprite(0xffd090, 16, 0.6));
  g.children[1].position.y = 5;
  const electrons = [];
  [0, 1, 2].forEach((k) => {
    const orbit = new THREE.Group();
    orbit.position.y = 5;
    orbit.rotation.set(Math.PI / 2 + (k - 1) * 0.9, k * 1.1, 0);
    const path = new THREE.Mesh(new THREE.TorusGeometry(22, 0.08, 8, 160), new THREE.MeshBasicMaterial({ color: 0xb48cff, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending }));
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.7, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 2.2, 2.6) }));
    e.add(glowSprite(0x8ff0ff, 6, 0.9));
    orbit.add(path, e);
    electrons.push({ e, speed: 0.6 + k * 0.25, off: k * 2 });
    g.add(orbit);
  });
  g.userData.tick = (t) => {
    nucleus.rotation.y = t * 0.4;
    electrons.forEach(({ e, speed, off }) => e.position.set(Math.cos(t * speed + off) * 22, Math.sin(t * speed + off) * 22, 0));
  };
  return g;
}
function makeCell() {
  const g = new THREE.Group();
  const membrane = new THREE.Mesh(new THREE.SphereGeometry(16, 64, 48), fresnelMaterial(0xff6fae, 2.2, 1.6));
  const fill = new THREE.Mesh(new THREE.SphereGeometry(15.8, 48, 32), new THREE.MeshBasicMaterial({ color: 0x3a0a22, transparent: true, opacity: 0.25, depthWrite: false }));
  const nucleus = new THREE.Mesh(new THREE.SphereGeometry(5, 48, 32), new THREE.MeshStandardMaterial({ color: 0x9a4dff, emissive: 0x301060, roughness: 0.3 }));
  g.add(fill, membrane, nucleus);
  [fill, membrane, nucleus].forEach((m) => { m.position.y = 6; });
  const r = rng(0.12);
  const bits = [];
  for (let i = 0; i < 26; i++) {
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.5, 1.4, 4, 8), new THREE.MeshStandardMaterial({ color: i % 3 ? 0xff9f6a : 0x6affc8, emissive: i % 3 ? 0x40200a : 0x0a4030 }));
    const a = r() * TAU, b = r() * Math.PI, d = 8 + r() * 6;
    m.position.set(Math.cos(a) * Math.sin(b) * d, 6 + Math.cos(b) * d, Math.sin(a) * Math.sin(b) * d);
    bits.push({ m, s: 0.3 + r() });
    g.add(m);
  }
  g.userData.tick = (t) => { membrane.scale.setScalar(1 + Math.sin(t * 1.2) * 0.015); bits.forEach(({ m, s }, i) => { m.rotation.set(t * s, t * s * 0.7, i); }); };
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
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(3, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(2, 2, 2.4), wireframe: true }));
  core.position.y = 4;
  g.add(core, glowSprite(0xaaf4ff, 24, 0.9));
  g.children.at(-1).position.y = 4;
  g.userData.tick = (t) => { mats.forEach((m) => { m.uniforms.time.value = t; }); core.rotation.set(t * 0.3, t * 0.4, 0); };
  return g;
}
function makeStudio() {
  const g = new THREE.Group();
  const mic = new THREE.Group();
  const head = new THREE.Mesh(new THREE.CapsuleGeometry(2.2, 3, 8, 24), new THREE.MeshStandardMaterial({ color: 0x2f4f6f, emissive: 0x0a2030, metalness: 0.6, roughness: 0.3 }));
  head.position.y = 9;
  const grill = new THREE.Mesh(new THREE.CapsuleGeometry(2.25, 3, 8, 24), new THREE.MeshBasicMaterial({ color: 0xf4a640, wireframe: true }));
  grill.position.y = 9;
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 6, 12), new THREE.MeshStandardMaterial({ color: 0x8899aa, metalness: 0.8, roughness: 0.3 }));
  stand.position.y = 4;
  const arc = new THREE.Mesh(new THREE.TorusGeometry(3, 0.25, 10, 40, Math.PI), new THREE.MeshStandardMaterial({ color: 0x8899aa, metalness: 0.8 }));
  arc.position.y = 8.5; arc.rotation.z = Math.PI;
  mic.add(head, grill, stand, arc);
  g.add(mic, glowSprite(0xffb060, 22, 0.3), ring(12, 0xffb060, 0.3, 0.12));
  g.children[1].position.y = 9;
  g.userData.tick = (t) => { mic.rotation.y = t * 0.3; };
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
function makeIsland(z, radius) {
  const b = BIOMES[z.name] || BIOMES.動物大觀園;
  const g = new THREE.Group();
  const rock = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 0.55, 3.2, 9, 1), new THREE.MeshStandardMaterial({ color: 0x6b5236, flatShading: true, roughness: 1 }));
  rock.position.y = -1.6;
  const under = new THREE.Mesh(new THREE.ConeGeometry(radius * 0.55, radius * 0.9, 9), new THREE.MeshStandardMaterial({ color: 0x4a3826, flatShading: true }));
  under.rotation.x = Math.PI; under.position.y = -3.2 - radius * 0.45;
  const top = new THREE.Mesh(new THREE.CylinderGeometry(radius * 1.02, radius * 1.02, 0.5, 9), new THREE.MeshStandardMaterial({ color: b.top, flatShading: true, roughness: 0.9 }));
  top.position.y = 0.1;
  g.add(rock, under, top);
  if (b.water) {
    const water = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.8, radius * 0.8, 0.2, 24), new THREE.MeshStandardMaterial({ color: 0x46c8ff, emissive: 0x0a4a7a, transparent: true, opacity: 0.85, roughness: 0.1, metalness: 0.2 }));
    water.position.y = 0.42;
    g.add(water, fx.makeWaterfall(radius * 0.99, hash(z.name) * TAU, 13));
  }
  const r = rng(hash(z.name));
  const edge = () => { const a = r() * TAU, d = radius * (0.78 + r() * 0.2); return [Math.cos(a) * d, Math.sin(a) * d]; };
  const add = (mesh, x, zz, y = 0.35) => { mesh.position.set(x, y, zz); g.add(mesh); };
  const n = Math.round(6 + radius * 0.6);
  for (let i = 0; i < n; i++) {
    const [x, zz] = edge();
    switch (b.deco) {
      case 'trees': case 'mixed': {
        const h = 2 + r() * 2.5;
        const t = new THREE.Mesh(new THREE.ConeGeometry(0.9 + r() * 0.5, h, 7), new THREE.MeshStandardMaterial({ color: b.tint || (r() > 0.5 ? 0x2e9a44 : 0x1f7a36), flatShading: true }));
        add(t, x, zz, 0.35 + h / 2);
        break;
      }
      case 'acacia': {
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 2, 6), new THREE.MeshStandardMaterial({ color: 0x6b4a2a }));
        add(trunk, x, zz, 1.3);
        const crown = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.0, 0.4, 8), new THREE.MeshStandardMaterial({ color: 0x5a8a2a, flatShading: true }));
        add(crown, x, zz, 2.4);
        break;
      }
      case 'cactus': {
        const c = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 1.6 + r(), 4, 8), new THREE.MeshStandardMaterial({ color: 0x3f9a4a, flatShading: true }));
        add(c, x, zz, 1.4);
        break;
      }
      case 'ice': {
        const h = 1.5 + r() * 3;
        const c = new THREE.Mesh(new THREE.ConeGeometry(0.6 + r() * 0.4, h, 5), new THREE.MeshStandardMaterial({ color: 0xdff4ff, emissive: 0x204060, flatShading: true }));
        add(c, x, zz, 0.35 + h / 2);
        break;
      }
      case 'coral': {
        const c = new THREE.Mesh(new THREE.TorusKnotGeometry(0.4, 0.15, 40, 6), new THREE.MeshStandardMaterial({ color: [0xff7aa8, 0xffb15a, 0xb47aff][i % 3], emissive: 0x401020 }));
        add(c, x, zz, 0.9);
        break;
      }
      case 'reeds': {
        const c = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 1.8, 4), new THREE.MeshStandardMaterial({ color: 0x8aa84a }));
        add(c, x, zz, 1.2);
        break;
      }
      case 'flowers': {
        const c = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), new THREE.MeshStandardMaterial({ color: [0xff6fa0, 0xffe05a, 0xffffff, 0xb07aff][i % 4], emissive: 0x302010 }));
        add(c, x, zz, 0.7);
        break;
      }
      case 'clouds': {
        const c = new THREE.Mesh(new THREE.SphereGeometry(1 + r(), 12, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x405060, roughness: 1 }));
        add(c, x * 1.1, zz * 1.1, -2 - r() * 2);
        break;
      }
      case 'waves': {
        const c = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.12, 6, 18, Math.PI), new THREE.MeshStandardMaterial({ color: 0xbff0ff, emissive: 0x206080 }));
        c.rotation.y = r() * TAU;
        add(c, x, zz, 0.6);
        break;
      }
      default: break;
    }
  }
  g.userData.baseY = b.high ? 7 : 0;
  g.userData.topY = b.water ? 0.6 : 0.4;
  return g;
}

function makeOcean() {
  const geo = new THREE.PlaneGeometry(2400, 2400, 90, 90);
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x0a4a6a, emissive: 0x03202f, roughness: 0.62, metalness: 0.15, flatShading: true, transparent: true, opacity: 0.92 }));
  mesh.position.y = -14;
  const base = geo.attributes.position.array.slice();
  mesh.userData.tick = (t) => {
    const p = geo.attributes.position.array;
    for (let i = 0; i < p.length; i += 3) p[i + 1] = Math.sin(base[i] * 0.02 + t) * 1.6 + Math.cos(base[i + 2] * 0.017 + t * 0.8) * 1.6;
    geo.attributes.position.needsUpdate = true;
  };
  return mesh;
}

function makeCity(z, radius) {
  const g = new THREE.Group();
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 0.4, 6), new THREE.MeshStandardMaterial({ color: 0x141a30, emissive: 0x05070f, metalness: 0.5, roughness: 0.6 }));
  g.add(pad, ring(radius, 0xff9a40, 0.6, 0.1));
  g.children[1].position.y = 0.25;
  const r = rng(hash(z.name));
  const edgeMat = new THREE.LineBasicMaterial({ color: r() > 0.5 ? 0x5ce8ff : 0xff9a40, transparent: true, opacity: 0.9 });
  const n = Math.round(6 + radius * 0.5);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + r() * 0.3, d = radius * (0.75 + r() * 0.2);
    const h = 2 + r() * 9, w = 0.8 + r() * 1.2;
    const box = new THREE.BoxGeometry(w, h, w);
    const b = new THREE.Mesh(box, new THREE.MeshStandardMaterial({ color: 0x0c1024, emissive: 0x080a18 }));
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(box), edgeMat);
    b.position.set(Math.cos(a) * d, h / 2, Math.sin(a) * d);
    e.position.copy(b.position);
    g.add(b, e);
  }
  g.userData.topY = 0.3;
  return g;
}

// ---------- 耳機號 ----------
function makeShip() {
  const g = new THREE.Group();
  const orange = new THREE.MeshStandardMaterial({ color: 0xf4a640, emissive: 0x6a3a08, metalness: 0.4, roughness: 0.35 });
  const blue = new THREE.MeshStandardMaterial({ color: 0x2f4f6f, emissive: 0x0a1a2a, metalness: 0.5, roughness: 0.4 });
  const band = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.2, 12, 40, Math.PI), orange);
  band.position.y = 0.2;
  g.add(band);
  [-1, 1].forEach((side) => {
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.55, 24), blue);
    cup.rotation.z = Math.PI / 2;
    cup.position.set(side * 1.3, 0, 0);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.08, 8, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 2.0, 2.2) }));
    rim.rotation.y = Math.PI / 2;
    rim.position.set(side * 1.6, 0, 0);
    g.add(cup, rim);
  });
  const glow = glowSprite(0xffb050, 7, 0.45);
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
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.8, 16, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.1, 0.3), transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false }));
  flame.rotation.x = -Math.PI / 2;
  flame.position.set(0, -0.1, -1.3);
  g.add(flame);
  g.userData = { riders, flame };
  g.scale.setScalar(1.6);
  return g;
}

// ---------- 主程式 ----------
export function createExplorer({ canvas, world, episodes, getStamps, onPick }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
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

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene3, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.7, 0.5, 0.82);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

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
  const beacons = fx.beaconKit();
  const effects = fx.createEffects(scene3);

  // 曲速穿越的光線（掛在鏡頭上）
  const warpGeo = new THREE.BufferGeometry();
  const wr = rng(0.73), wpos = [];
  for (let i = 0; i < 500; i++) {
    const a = wr() * TAU, d = 2 + wr() * 30, z = -5 - wr() * 120;
    wpos.push(Math.cos(a) * d, Math.sin(a) * d, z, Math.cos(a) * d, Math.sin(a) * d, z - 6);
  }
  warpGeo.setAttribute('position', new THREE.Float32BufferAttribute(wpos, 3));
  const warpLines = new THREE.LineSegments(warpGeo, new THREE.LineBasicMaterial({ color: 0xdff4ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  warpLines.frustumCulled = false;
  camera.add(warpLines);

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
  for (let i = 0; i < 70; i++) trail.geometry.attributes.color.array.set([1.0, 0.6, 0.2], i * 3);
  scene3.add(trail);
  let trailIndex = 0;

  const sound = new Sound();
  let layout = null;
  let worldGroup = null;
  let spots = []; // { e, sprite, glow, base: Vector3, phase }
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
  let pixelRatio = Math.min(1.75, window.devicePixelRatio || 1);
  const perf = { sum: 0, n: 0, step: 0 }; // 太慢就自動降畫質

  function themeColor(i) { return new THREE.Color().setHSL(((THEMES[layout.theme].hue[i % 3]) % 360) / 360, 0.8, 0.6); }

  function disposeGroup(g) {
    g.traverse((o) => {
      if (o.userData.shared) return;
      o.geometry?.dispose();
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      mats.forEach((m) => { if (m.map && ![...textureCache.values()].includes(m.map)) m.map.dispose(); m.dispose(); });
    });
  }

  function marksFor(e, st) {
    const m = (st.ear.includes(e.code) ? '👂' : '') + (st.hand.includes(e.code) ? '✋' : '');
    return m || ((st.seen || []).includes(e.code) ? 'seen' : '');
  }

  function build(view) {
    if (worldGroup) { scene3.remove(worldGroup); disposeGroup(worldGroup); }
    layout = buildScene(view, world, episodes);
    worldGroup = new THREE.Group();
    ticks = [];
    spots = [];
    labels = [];
    const theme = layout.theme;
    const sky = THEMES[theme].sky;
    const base = new THREE.Color(sky[0]).lerp(new THREE.Color(sky[1]), theme === 'l03' ? 0.8 : 0.3);
    const neb = [0, 1, 2].map((i) => new THREE.Color().setHSL((THEMES[theme].hue[i] % 360) / 360, 1, 0.5).multiplyScalar(i === 2 ? 0.35 : 0.5));
    sky3.bake({ base, colors: neb, seed: hash(theme) * 40, bright: theme === 'l03' ? 1.1 : 0.62 });
    scene3.background = sky3.texture;
    scene3.fog = ['l03', 'l04', 'l02'].includes(theme) ? new THREE.FogExp2(base, theme === 'l03' ? 0.0018 : 0.0016) : null;
    centerLight.position.set(0, theme === 'l07' ? 0 : 10, 0);
    centerLight.intensity = theme === 'l07' ? 3.2 : 2;
    hemi.intensity = ['l03', 'l04', 'l02', 'l01', 'studio'].includes(theme) ? 1.1 : 0.45;

    const decoMakers = { l07: makeSun, l06: makeEarthMoon, l05: makeEarthCore, l08: makeStarCluster, l09: makeGalaxy, l10: makeCosmicWeb, l01: makeAtom, l02: makeCell, era: makeTimeRiver, lane: makeLanes, studio: makeStudio };
    const b0 = layout.bounds;
    const reach = Math.max(-b0.minX, b0.maxX, -b0.minY, b0.maxY) * S;
    if (decoMakers[theme]) worldGroup.add(decoMakers[theme](layout));
    if (theme === 'l07') worldGroup.add(fx.makePlanets(layout));
    if (theme === 'l06') worldGroup.add(fx.makeSatellites());
    if (theme === 'l04') worldGroup.add(fx.makeTraffic(reach));
    if (theme === 'l03') worldGroup.add(makeOcean(), fx.makeBirds(reach));
    worldGroup.add(fx.makeMotes(reach, themeColor(0)));
    if (theme === 'l04') {
      const grid = new THREE.GridHelper(600, 120, 0x3a4680, 0x2a3060);
      grid.material.transparent = true; grid.material.opacity = 0.22;
      grid.position.y = -0.3;
      worldGroup.add(grid);
    }

    const stampsNow = getStamps();
    layout.groups.forEach((z, gi) => {
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
        holder.add(fx.holoPad(z.color ? new THREE.Color(z.color) : themeColor(gi), radius));
      }
      holder.position.copy(center);
      const bob = hash(z.name) * TAU;
      if (theme === 'l03') ticks.push((t) => { holder.position.y = center.y + (reduceMotion ? 0 : Math.sin(t * 0.6 + bob) * 0.5); });
      worldGroup.add(holder);

      const labelColor = z.color || `hsl(${z.hue},80%,60%)`;
      const lt = labelTexture(`${z.name} · ${z.items.length}`, labelColor);
      const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: lt, transparent: true, depthWrite: false, toneMapped: false, sizeAttenuation: false }));
      label.userData.aspect = lt.image.width / lt.image.height;
      labels.push(label);
      label.position.set(0, theme === 'l04' ? 14 : 10, -radius * 0.7);
      holder.add(label);

      z.items.forEach((e) => {
        const s = layout.spots.find((p) => p.e === e && p.group === z);
        if (!s) return;
        const soon = e.state === 'unreleased';
        const size = soon ? 3.4 : e.state === 'subscriber' ? 6 : 5.4;
        const local = new THREE.Vector3((s.x - z.x) * S, topY + size * 0.75 + 0.3, (s.y - z.y) * S);
        const marks = marksFor(e, stampsNow);
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: badgeTexture(s.icon, e.state, marks), transparent: true, opacity: soon ? 0.6 : 1, toneMapped: false, alphaTest: 0.05 }));
        sprite.scale.set(size, size, 1);
        sprite.position.copy(local);
        const glowColor = e.state === 'subscriber' ? 0xffc040 : soon ? 0x7080a0 : 0x6fe8ff;
        const glow = glowSprite(glowColor, size * 2, soon ? 0.15 : 0.32);
        glow.position.copy(local);
        holder.add(glow, sprite);
        let parts = null;
        if (!soon) {
          parts = beacons.make(beacons.kindOf(e.state, (stampsNow.seen || []).includes(e.code)), local.y - topY, size, e.state === 'subscriber');
          parts.group.position.set(local.x, topY, local.z);
          holder.add(parts.group);
        }
        const spot = { e, icon: s.icon, sprite, glow, holder, local, size, topY, parts, pop: 0, phase: hash(e.code) * TAU, marks };
        sprite.userData.spot = spot;
        spots.push(spot);
      });
    });
    worldGroup.traverse((o) => { if (o.userData.tick) ticks.push(o.userData.tick); });
    scene3.add(worldGroup);
    sizeLabels();
    stampKey = '';
    hover = null;
    tip.hidden = true;
  }

  function spotWorldPos(spot, out = new THREE.Vector3()) {
    return spot.sprite.getWorldPosition(out);
  }

  // ---------- 鏡頭 ----------
  function fitTarget() {
    const b = layout.bounds;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    const aspect = w / Math.max(1, h);
    let target, dist;
    if (w < 700 && layout.groups.length > 1) {
      const live = (g) => g.items.filter((e) => e.state !== 'unreleased').length;
      const g = layout.groups.reduce((a, c) => (live(c) > live(a) ? c : a));
      target = new THREE.Vector3(g.x * S, theme3dLift(), g.y * S);
      dist = (g.r * S * 2.3) / Math.min(1, aspect * 1.4);
    } else {
      target = new THREE.Vector3((b.minX + b.maxX) / 2 * S, theme3dLift(), (b.minY + b.maxY) / 2 * S);
      const R = Math.max(b.maxX - b.minX, (b.maxY - b.minY) * 1.25) / 2 * S;
      dist = (R / Math.tan((55 * Math.PI) / 360)) * (aspect < 1 ? 1.4 / aspect : 0.92);
    }
    dist = Math.max(18, Math.min(380, dist));
    const pos = target.clone().add(new THREE.Vector3(0, dist * 0.68, dist * 0.74));
    return { target, pos };
  }
  function theme3dLift() { return layout.theme === 'l03' ? 1 : 0; }

  function animateCamera(to, dur = 1.1) {
    camAnim = { fromPos: camera.position.clone(), fromTarget: controls.target.clone(), toPos: to.pos, toTarget: to.target, t: 0, dur };
  }

  // 耳機號停在畫面前方，不會被中間的太陽、銀河蓋住
  function placeShip() {
    const { target, pos } = fitTarget();
    ship.position.copy(target).lerp(pos, 0.16);
    ship.position.y = Math.min(ship.position.y, target.y + 9);
    ship.rotation.set(0, 0, 0);
  }

  // ---------- 互動 ----------
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function pick(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(spots.map((s) => s.sprite), false);
    return hits.length ? hits[0].object.userData.spot : null;
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

  const spotColor = (e) => (e.state === 'subscriber' ? 0xffc040 : e.state === 'unreleased' ? 0x9aa6c8 : 0x6fe8ff);
  function land(spot) {
    const top = spotWorldPos(spot);
    const base = top.clone();
    base.y -= spot.local.y - spot.topY;
    if (!reduceMotion) {
      effects.shockwave(base, spotColor(spot.e), spot.size * 1.6);
      effects.burst(top, spot.e.state === 'subscriber' ? [0xffe070, 0xffb030, 0xffffff] : [0x8ff0ff, 0xffffff, 0xb48cff], { count: 50, speed: 7, size: 3 });
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
    const pr = pixelRatio;
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);
    composer.setPixelRatio(pr);
    composer.setSize(w, h);
    bloom.resolution.set(w * 0.5, h * 0.5);
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
    if (fixedQuality || perf.step >= 2 || warp) return;
    perf.sum += raw; perf.n += 1;
    if (perf.n < 90) return;
    const avg = perf.sum / perf.n;
    perf.sum = 0; perf.n = 0;
    if (avg < 1 / 30) return;
    perf.step += 1;
    if (perf.step === 1 && pixelRatio > 1) { pixelRatio = 1; resize(); }
    else { perf.step = 2; bloom.enabled = false; }
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

  function frame(now) {
    if (!running) return;
    const raw = (now - last) / 1000;
    const dt = Math.min(0.05, raw);
    last = now;
    adapt(raw);
    time += dt;
    stars.material.uniforms.time.value = time;
    ticks.forEach((f) => f(reduceMotion ? time * 0.3 : time, dt));

    // 頻道：上下漂浮、金色閃爍、拿到星章就換貼圖
    const st = getStamps();
    const key = `${st.ear.length}:${st.hand.length}:${(st.seen || []).length}`;
    const refresh = key !== stampKey;
    stampKey = key;
    spots.forEach((s) => {
      const bob = reduceMotion ? 0 : Math.sin(time * 1.6 + s.phase) * 0.5;
      s.pop = Math.max(0, s.pop - dt * 2.5);
      const grow = (s === hover ? 1.25 : 1) + Math.sin(s.pop * Math.PI) * 0.5;
      s.sprite.position.set(s.local.x, s.local.y + bob, s.local.z);
      s.glow.position.copy(s.sprite.position);
      s.sprite.scale.setScalar(s.size * grow);
      if (s.parts) {
        const w = s.size * (s === hover ? 0.26 : 0.16);
        s.parts.beam.scale.set(w, s.local.y + bob - s.topY, w);
        s.parts.halo.scale.setScalar(s.size * 0.5 * (1 + 0.15 * Math.sin(time * 2 + s.phase)));
        if (s.parts.orbit) { s.parts.orbit.position.y = s.local.y + bob - s.topY; s.parts.orbit.rotation.set(1.1, time * 1.4 + s.phase, 0.35); }
      }
      if (s.e.state === 'subscriber') s.glow.material.opacity = 0.55 + 0.35 * Math.sin(time * 2.4 + s.phase);
      if (refresh) {
        const m = marksFor(s.e, st);
        if (m !== s.marks) {
          s.marks = m;
          s.sprite.material.map = badgeTexture(s.icon, s.e.state, m);
          if (s.parts) beacons.setKind(s.parts, beacons.kindOf(s.e.state, Boolean(m)));
        }
      }
    });

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
      warpLines.material.opacity = k * 0.9;
      warpLines.scale.set(1, 1, 1 + k * 6);
      camera.fov = 55 + k * 40;
      camera.updateProjectionMatrix();
      flash.style.opacity = String(Math.max(0, 1 - Math.abs(p - 0.5) * 5) * 0.8);
      if (warp.next && p >= 0.5) {
        build(warp.next);
        warp.next = null;
        const to = fitTarget();
        camera.position.copy(to.target.clone().add(to.pos.clone().sub(to.target).multiplyScalar(2.2)));
        controls.target.copy(to.target);
        placeShip();
        animateCamera(to, 0.9);
      }
      if (p >= 1) { warp = null; warpLines.material.opacity = 0; camera.fov = 55; camera.updateProjectionMatrix(); flash.style.opacity = '0'; }
    }
    beacons.tick(time);
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
    composer.render(dt);
    rafId = requestAnimationFrame(frame);
  }

  window.addEventListener('resize', resize);
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
      if (!layout || reduceMotion) {
        const first = !layout;
        build(view);
        const to = fitTarget();
        controls.target.copy(to.target);
        placeShip();
        if (first && !reduceMotion) {
          const off = to.pos.clone().sub(to.target).applyAxisAngle(new THREE.Vector3(0, 1, 0), -1.1).multiplyScalar(3.2);
          camera.position.copy(to.target).add(off).add(new THREE.Vector3(0, 60, 0));
          animateCamera(to, 2.6);
        } else camera.position.copy(to.pos);
        return;
      }
      sound.tune();
      warp = { t: 0, dur: 1.1, next: view };
    },
    zoom(delta) { dolly(delta > 0 ? 0.7 : 1.4); },
    home() { animateCamera(fitTarget(), 0.9); },
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
      effects.burst(ship.position, [0xff6f91, 0xffd25c, 0x7cf2ff, 0x9dff7a, 0xb48cff, 0xffffff], { count: 160, speed: 12, gravity: 10, dur: 1.8, size: 5 });
      effects.shockwave(ship.position.clone().setY(ship.position.y - 1), 0xffe070, 14, 1);
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
