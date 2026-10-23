// 宇宙好好聽 3D 共用小工具：shader、貼圖、光暈、點雲。
import * as THREE from 'three';

export const TAU = Math.PI * 2;
// 柔光：所有光暈、邊光、點雲共用的強度。調這裡就能讓整個畫面更柔或更亮。
export const SOFT = { glow: 0.5, rim: 0.6, points: 0.75 };

// ---------- 共用的 GLSL ----------
export const NOISE = /* glsl */ `
float hash3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float noise3(vec3 p) {
  vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash3(i), hash3(i + vec3(1, 0, 0)), f.x), mix(hash3(i + vec3(0, 1, 0)), hash3(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(hash3(i + vec3(0, 0, 1)), hash3(i + vec3(1, 0, 1)), f.x), mix(hash3(i + vec3(0, 1, 1)), hash3(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float fbm(vec3 p) { float v = 0.03, a = 0.5; for (int i = 0; i < 4; i++) { v += a * noise3(p); p *= 2.03; a *= 0.5; } return v; }`;

export function pointsMaterial({ additive = true, scale = 600, gain = 1 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, scale: { value: scale }, gain: { value: gain * SOFT.points } },
    vertexShader: /* glsl */ `
      attribute float size; attribute float phase; attribute vec3 color;
      uniform float time; uniform float scale; varying vec3 vColor; varying float vTw;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        vTw = 0.65 + 0.35 * sin(time * 1.7 + phase);
        gl_PointSize = max(1.0, size * vTw * scale / -mv.z);
        vColor = color;
      }`,
    fragmentShader: /* glsl */ `
      uniform float gain; varying vec3 vColor; varying float vTw;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = 1.0 - smoothstep(0.0, 0.5, d);
        gl_FragColor = vec4(vColor * (0.6 + 0.5 * vTw) * gain, a);
      }`,
    transparent: true,
    depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
}

export function makePoints(count, place, { scale = 600, gain = 1 } = {}) {
  const pos = new Float32Array(count * 3), col = new Float32Array(count * 3), size = new Float32Array(count), phase = new Float32Array(count);
  const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const p = place(i, c);
    pos.set(p.pos, i * 3);
    col.set([c.r, c.g, c.b], i * 3);
    size[i] = p.size;
    phase[i] = p.phase ?? (i * 2.399) % TAU;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('size', new THREE.BufferAttribute(size, 1));
  g.setAttribute('phase', new THREE.BufferAttribute(phase, 1));
  return new THREE.Points(g, pointsMaterial({ scale, gain }));
}

export function fresnelMaterial(color, power = 3, strength = 1.4) {
  return new THREE.ShaderMaterial({
    uniforms: { color: { value: new THREE.Color(color) }, power: { value: power }, strength: { value: strength * SOFT.rim } },
    vertexShader: /* glsl */ `varying vec3 vN; varying vec3 vV;
      void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */ `uniform vec3 color; uniform float power; uniform float strength; varying vec3 vN; varying vec3 vV;
      void main() { float f = pow(1.0 - max(dot(vN, vV), 0.0), power); gl_FragColor = vec4(color * f * strength, f); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
}

export function flowMaterial(color, speed = 0.6, bands = 18) {
  return new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, color: { value: new THREE.Color(color) }, speed: { value: speed }, bands: { value: bands } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `uniform float time; uniform vec3 color; uniform float speed; uniform float bands; varying vec2 vUv;
      void main() {
        float s = fract(vUv.x * bands - time * speed);
        float pulse = smoothstep(0.0, 0.25, s) * (1.0 - smoothstep(0.55, 1.0, s));
        float edge = 1.0 - abs(vUv.y - 0.5) * 2.0;
        gl_FragColor = vec4(color * (0.4 + 0.7 * pulse) * (0.4 + 0.6 * edge), 0.4 + 0.3 * pulse);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
}

// ---------- 貼圖（畫在 canvas 上） ----------
export const textureCache = new Map();
export function cached(key, draw) {
  if (!textureCache.has(key)) {
    const t = new THREE.CanvasTexture(draw());
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    textureCache.set(key, t);
  }
  return textureCache.get(key);
}
export function glowTexture() {
  return cached('glow', () => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,255,255,0.55)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, 128, 128);
    return c;
  });
}
export const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
/** 畫一顆徽章（192×192 的座標系，外框半徑 80），可以畫在任何 canvas 的任何位置。 */
export function drawBadge(g, icon, state, marks) {
  const soon = state === 'unreleased';
  const [rimA, rimB] = state === 'subscriber' ? ['#f9e3a8', '#c99649'] : soon ? ['#b9b6d6', '#77749a'] : ['#c6ece2', '#6cb5a5'];
  // 像繪本裡的貼紙：粉彩外框、奶油色底面、上方一點反光
  const rim = g.createLinearGradient(0, 16, 0, 176);
  rim.addColorStop(0, rimA); rim.addColorStop(1, rimB);
  g.beginPath(); g.arc(96, 96, 80, 0, TAU); g.fillStyle = rim; g.fill();
  const face = g.createRadialGradient(80, 70, 8, 96, 100, 74);
  if (soon) { face.addColorStop(0, '#5b5a80'); face.addColorStop(1, '#3a3958'); }
  else if (state === 'subscriber') { face.addColorStop(0, '#fff6e2'); face.addColorStop(1, '#efd9ad'); }
  else { face.addColorStop(0, '#fffbf2'); face.addColorStop(1, '#e6ddcc'); }
  g.beginPath(); g.arc(96, 96, state === 'subscriber' ? 66 : 70, 0, TAU); g.fillStyle = face; g.fill();
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = 'rgba(60,40,20,0.25)'; g.shadowBlur = 6; g.shadowOffsetY = 3;
  if (soon) { g.font = '800 84px sans-serif'; g.fillStyle = '#d6d2ee'; g.fillText('?', 96, 102); }
  else { g.font = `86px ${EMOJI_FONT}`; g.fillStyle = '#000'; g.fillText(icon, 96, 104); }
  g.shadowColor = 'transparent'; g.shadowBlur = 0; g.shadowOffsetY = 0;
  const gloss = g.createLinearGradient(0, 26, 0, 96);
  gloss.addColorStop(0, 'rgba(255,255,255,0.4)'); gloss.addColorStop(1, 'rgba(255,255,255,0)');
  g.beginPath(); g.ellipse(96, 58, 52, 30, 0, Math.PI, TAU); g.ellipse(96, 58, 52, 14, 0, 0, Math.PI); g.fillStyle = gloss; g.fill();
  if (marks === 'seen') {
    g.beginPath(); g.arc(156, 38, 18, 0, TAU); g.fillStyle = '#8fd8bf'; g.fill();
    g.strokeStyle = '#1f4a3c'; g.lineWidth = 5; g.beginPath(); g.moveTo(147, 38); g.lineTo(154, 46); g.lineTo(166, 30); g.stroke();
  } else if (marks) { g.font = `44px ${EMOJI_FONT}`; g.fillText(marks, 150, 40); }
}

/** 把一堆靜態小物（樹、仙人掌、大樓…）合成一個網格，顏色存在頂點上：幾百次繪圖變成一次。 */
export function mergeStatic(meshes, { flat = true, roughness = 0.9, metalness = 0 } = {}) {
  let count = 0;
  const parts = meshes.map((m) => {
    m.updateMatrix();
    const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    g.applyMatrix4(m.matrix);
    if (!g.attributes.normal) g.computeVertexNormals();
    const c = m.material.color.clone();
    if (m.material.emissive) c.add(m.material.emissive.clone().multiplyScalar(0.6));
    count += g.attributes.position.count;
    return { g, c };
  });
  const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3), col = new Float32Array(count * 3);
  let o = 0;
  parts.forEach(({ g, c }) => {
    const n = g.attributes.position.count;
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    for (let i = (o) * 3, end = (o + n) * 3; i < end; i += 3) { col[i] = c.r; col[i + 1] = c.g; col[i + 2] = c.b; }
    o += n;
    g.dispose();
  });
  meshes.forEach((m) => { if (!m.userData.shared) { m.geometry.dispose(); m.material.dispose(); } });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: flat, roughness, metalness }));
}

export function labelTexture(text, color) {
  return cached(`label:${text}:${color}`, () => {
    const c = document.createElement('canvas');
    const g = c.getContext('2d');
    g.font = '700 44px "Noto Sans TC","PingFang TC",sans-serif';
    const w = Math.ceil(g.measureText(text).width) + 48;
    c.width = w; c.height = 80;
    g.font = '700 44px "Noto Sans TC","PingFang TC",sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    // 深色描邊代替模糊陰影：一樣好讀，畫起來快很多
    g.lineJoin = 'round'; g.lineWidth = 9; g.strokeStyle = 'rgba(8, 10, 28, 0.7)';
    g.strokeText(text, w / 2, 42);
    g.fillStyle = '#f7efe0';
    g.fillText(text, w / 2, 42);
    g.fillStyle = color; g.globalAlpha = 0.85; // 字下面一條小小的區域色
    g.beginPath(); g.roundRect(w / 2 - 22, 70, 44, 6, 3); g.fill();
    return c;
  });
}

// ---------- 小零件 ----------
export function ring(radius, color, opacity = 0.35, width = 0.12) {
  const m = new THREE.Mesh(new THREE.RingGeometry(radius - width, radius + width, 96),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  m.rotation.x = -Math.PI / 2;
  return m;
}
export function glowSprite(color, size, opacity = 1) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, opacity: opacity * SOFT.glow, blending: THREE.AdditiveBlending, depthWrite: false }));
  s.scale.set(size, size, 1);
  return s;
}

