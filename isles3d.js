// 宇宙群島的 3D 世界：明亮的太空天空、浮在雲海上的島、坐火箭在島和島之間飛、每一集變成一個會走路的小居民。
import * as THREE from 'three';
import { TAU, cached, glowSprite, EMOJI_FONT } from './kit3d.js';
import { rng, hash, Sound } from './explorer.js';
import { buildIsland } from './isleprops.js';

const coarse = matchMedia('(pointer: coarse)').matches;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const UP = new THREE.Vector3(0, 1, 0);
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const TIER_Y = { home: 6, land: 0, sea: -16, sky: 24, space: 46 };

// ---------- 天空：粉彩的太空（上面是藍紫色、有星星，下面是一片雲海） ----------
function makeSky(scene) {
  const sky = new THREE.Mesh(new THREE.SphereGeometry(2400, 32, 20), new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 } },
    vertexShader: /* glsl */ `varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position.z = gl_Position.w; }`,
    fragmentShader: /* glsl */ `varying vec3 vDir; uniform float time;
      void main() {
        float y = vDir.y;
        // 從上到下：藍紫色的太空 → 天藍 → 地平線一圈粉紅光 → 雲海下面是乾淨的藍
        vec3 top = vec3(0.36, 0.44, 0.96), upper = vec3(0.47, 0.74, 1.0), horizon = vec3(1.0, 0.82, 0.89), below = vec3(0.62, 0.78, 1.0), deep = vec3(0.47, 0.56, 0.97);
        vec3 c = mix(horizon, upper, smoothstep(0.0, 0.3, y));
        c = mix(c, top, smoothstep(0.3, 0.95, y));
        c = mix(c, below, smoothstep(0.0, -0.12, y));
        c = mix(c, deep, smoothstep(-0.12, -0.9, y));
        gl_FragColor = vec4(c, 1.0);
      }`,
    side: THREE.BackSide, depthWrite: false, fog: false,
  }));
  sky.renderOrder = -10;
  scene.add(sky);
  // 星星：四角的小亮光，在上半部藍紫色的地方一閃一閃
  const r = rng(0.42), n = coarse ? 260 : 420;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3), ph = new Float32Array(n), sz = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = r() * TAU, y = 0.15 + Math.pow(r(), 0.7) * 0.85, rr = Math.sqrt(1 - y * y);
    pos.set([Math.cos(a) * rr * 2000, y * 2000, Math.sin(a) * rr * 2000], i * 3); ph[i] = r() * TAU; sz[i] = 8 + r() * 18;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('phase', new THREE.BufferAttribute(ph, 1));
  geo.setAttribute('size', new THREE.BufferAttribute(sz, 1));
  const stars = new THREE.Points(geo, new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, map: { value: sparkleTexture() } },
    vertexShader: /* glsl */ `attribute float phase; attribute float size; uniform float time; varying float vA; varying float vY;
      void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_Position.z = gl_Position.w * 0.9999;
        float tw = 0.55 + 0.45 * sin(time * 1.7 + phase); gl_PointSize = size * tw; vA = tw; vY = normalize(position).y; }`,
    fragmentShader: /* glsl */ `uniform sampler2D map; varying float vA; varying float vY;
      void main() { vec4 t = texture2D(map, gl_PointCoord); float a = t.a * vA * smoothstep(0.2, 0.55, vY); gl_FragColor = vec4(vec3(1.0, 0.98, 0.9), a); }`,
    transparent: true, depthWrite: false, fog: false,
  }));
  stars.frustumCulled = false;
  stars.renderOrder = -9;
  scene.add(stars);
  // 遠方的粉彩星球
  const planet = (color, size, x, y, z, ring) => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.SphereGeometry(size, 32, 20), new THREE.MeshStandardMaterial({ color, roughness: 0.9, emissive: color, emissiveIntensity: 0.35, fog: false })));
    if (ring) { const m = new THREE.Mesh(new THREE.RingGeometry(size * 1.35, size * 2, 48), new THREE.MeshBasicMaterial({ color: ring, transparent: true, opacity: 0.75, side: THREE.DoubleSide, fog: false })); m.rotation.x = -Math.PI / 2 + 0.45; g.add(m); }
    g.position.set(x, y, z);
    scene.add(g);
    return g;
  };
  const far = [planet(0xffc6a8, 110, -900, 420, -1300, 0xfff0c8), planet(0xc8b8ff, 60, 1200, 300, -700), planet(0xa8f0dc, 40, 600, 520, 1300), planet(0xffe08a, 80, -1400, 160, 900, 0xffffff)];
  // 雲海：島下面一大片蓬鬆的白雲，慢慢飄
  const clouds = new THREE.Group();
  const cm = new THREE.SpriteMaterial({ map: cloudTexture(), color: 0xffffff, transparent: true, opacity: 0.92, depthWrite: false, fog: false });
  const cr = rng(0.9);
  // 雲一朵一朵分開，中間看得到藍藍的天（太密會變成一片白）
  for (let i = 0; i < (coarse ? 34 : 50); i++) {
    const s = new THREE.Sprite(cm);
    const a = cr() * TAU, d = 250 + Math.sqrt(cr()) * 1300;
    s.position.set(Math.cos(a) * d, -230 - cr() * 120, Math.sin(a) * d);
    const k = 90 + cr() * 140; s.scale.set(k * 1.7, k, 1);
    s.userData.v = 2 + cr() * 4;
    clouds.add(s);
  }
  scene.add(clouds);
  return (t, dt) => {
    sky.material.uniforms.time.value = t;
    stars.material.uniforms.time.value = t;
    clouds.children.forEach((c) => { c.position.x += c.userData.v * dt; if (c.position.x > 1600) c.position.x -= 3200; });
    far.forEach((p, i) => { p.rotation.y = t * 0.02 * (i + 1); });
  };
}

// ---------- 火箭（紅白配色、圓窗戶裡坐著隊長和博士） ----------
const rocketParts = {};
function rocketGeo() {
  if (rocketParts.body) return rocketParts;
  const prof = [[0, 0], [0.9, 0.2], [1.15, 1], [1.2, 2.2], [1.05, 3.2], [0.7, 4.0], [0.25, 4.5], [0, 4.6]].map(([x, y]) => new THREE.Vector2(x, y));
  rocketParts.body = new THREE.LatheGeometry(prof, 20);
  rocketParts.nose = new THREE.LatheGeometry([[0, 3.25], [1.06, 3.25], [0.72, 4.0], [0.27, 4.5], [0, 4.62]].map(([x, y]) => new THREE.Vector2(x, y)), 20);
  rocketParts.fin = new THREE.BoxGeometry(0.16, 1.4, 1.1).translate(0, 0.6, 1.4);
  rocketParts.window = new THREE.CylinderGeometry(0.5, 0.5, 0.2, 20).rotateX(Math.PI / 2);
  rocketParts.rim = new THREE.TorusGeometry(0.52, 0.09, 8, 20);
  rocketParts.flame = new THREE.ConeGeometry(0.7, 2.2, 16, 1, true).rotateX(Math.PI).translate(0, -1.0, 0);
  return rocketParts;
}
function makeRocket({ scale = 1, color = 0xff5c5c, riders = false } = {}) {
  const P = rocketGeo();
  const g = new THREE.Group();
  const inner = new THREE.Group(); g.add(inner); // inner 會抖、會傾斜；g 是位置
  const white = new THREE.MeshStandardMaterial({ color: 0xfffaf2, roughness: 0.45, metalness: 0.05 });
  const red = new THREE.MeshStandardMaterial({ color, roughness: 0.5 });
  inner.add(new THREE.Mesh(P.body, white));
  const nose = new THREE.Mesh(P.nose, red); nose.scale.setScalar(1.01); inner.add(nose);
  for (let i = 0; i < 3; i++) { const f = new THREE.Mesh(P.fin, red); f.rotation.y = (i / 3) * TAU; inner.add(f); }
  const glass = new THREE.Mesh(P.window, new THREE.MeshStandardMaterial({ color: 0x9fdcff, emissive: 0x4a9ad8, emissiveIntensity: 0.4, roughness: 0.2 }));
  glass.position.set(0, 2.3, 1.1); inner.add(glass);
  const rim = new THREE.Mesh(P.rim, new THREE.MeshStandardMaterial({ color: 0xffc25a, roughness: 0.4, metalness: 0.4 })); rim.position.set(0, 2.3, 1.18); inner.add(rim);
  if (riders) {
    const tex = new THREE.TextureLoader().load('assets/avatar-captain.png'); tex.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, toneMapped: false })); s.scale.set(0.8, 0.8, 1); s.position.set(0, 2.3, 1.3); inner.add(s);
  }
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xffb04a, transparent: true, opacity: 0.85, depthWrite: false });
  const flame = new THREE.Mesh(P.flame, flameMat); inner.add(flame);
  const core = new THREE.Mesh(P.flame, new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.9, depthWrite: false })); core.scale.set(0.5, 0.7, 0.5); inner.add(core);
  const glow = glowSprite(0xffb46a, 5, 1); glow.position.y = -1.2; inner.add(glow);
  g.scale.setScalar(scale);
  g.userData = { inner, flame, core, glow, setFire(k) { flame.visible = core.visible = glow.visible = k > 0.01; flame.scale.set(1, 0.4 + k, 1); core.scale.set(0.5, 0.3 + k * 0.7, 0.5); glow.material.opacity = 0.5 * k; } };
  g.userData.setFire(0);
  return g;
}
// 火箭飛過留下的一串白煙（共用一組，很省）
function makeTrail(scene, count = 160) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3), born = new Float32Array(count).fill(-99), size = new Float32Array(count);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('born', new THREE.BufferAttribute(born, 1));
  geo.setAttribute('size', new THREE.BufferAttribute(size, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, map: { value: cloudTexture() } },
    vertexShader: /* glsl */ `attribute float born; attribute float size; uniform float time; varying float vA;
      void main() { float age = time - born; vec3 p = position + vec3(0.0, age * 1.5, 0.0); vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
        vA = clamp(1.0 - age / 2.2, 0.0, 1.0); gl_PointSize = size * (1.0 + age * 1.6) * 300.0 / -mv.z; }`,
    fragmentShader: /* glsl */ `uniform sampler2D map; varying float vA; void main() { vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(1.0, 0.99, 0.97, t.a * vA * 0.8); if (gl_FragColor.a < 0.01) discard; }`,
    transparent: true, depthWrite: false,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  scene.add(pts);
  let next = 0;
  return {
    puff(p, t, s = 2.2) { pos.set([p.x + (Math.random() - 0.5) * 0.6, p.y, p.z + (Math.random() - 0.5) * 0.6], next * 3); born[next] = t; size[next] = s; next = (next + 1) % count; geo.attributes.position.needsUpdate = true; geo.attributes.born.needsUpdate = true; geo.attributes.size.needsUpdate = true; },
    tick(t) { mat.uniforms.time.value = t; },
  };
}

// ---------- 居民（每一集一個會走路的小人：頭是它的圖示，下面有兩隻小腳） ----------
function makeAtlas(icons, specials) {
  const T = 112, cols = Math.ceil(Math.sqrt(icons.length)), rows = Math.ceil(icons.length / cols);
  const c = document.createElement('canvas'); c.width = cols * T; c.height = rows * T;
  const g = c.getContext('2d', { willReadFrequently: true });
  const tmp = document.createElement('canvas'); tmp.width = tmp.height = T; const tg = tmp.getContext('2d', { willReadFrequently: true });
  const colors = new Map();
  icons.forEach((icon, i) => {
    const x = (i % cols) * T, y = Math.floor(i / cols) * T;
    tg.clearRect(0, 0, T, T);
    tg.globalCompositeOperation = 'source-over';
    tg.textAlign = 'center'; tg.textBaseline = 'middle';
    if (icon === 'zzz') { tg.font = '900 44px sans-serif'; tg.fillStyle = '#7a6cff'; tg.fillText('z', T * 0.35, T * 0.62); tg.font = '900 34px sans-serif'; tg.fillText('z', T * 0.58, T * 0.42); tg.font = '900 26px sans-serif'; tg.fillText('z', T * 0.76, T * 0.26); }
    else if (icon === 'check') { tg.fillStyle = '#5fcf9f'; tg.beginPath(); tg.arc(T / 2, T / 2, T * 0.32, 0, TAU); tg.fill(); tg.strokeStyle = '#fff'; tg.lineWidth = 12; tg.lineCap = 'round'; tg.beginPath(); tg.moveTo(T * 0.34, T * 0.52); tg.lineTo(T * 0.46, T * 0.64); tg.lineTo(T * 0.68, T * 0.38); tg.stroke(); }
    else { tg.font = `${Math.round(T * 0.7)}px ${EMOJI_FONT}`; tg.fillStyle = '#000'; tg.fillText(icon, T / 2, T * 0.52); }
    g.save();
    if (specials.includes(icon)) {
      // 頭上的小徽章（皇冠、zzz、勾勾）保留白邊，遠遠也看得清楚
      const sil = document.createElement('canvas'); sil.width = sil.height = T; const sg = sil.getContext('2d');
      sg.drawImage(tmp, 0, 0); sg.globalCompositeOperation = 'source-in'; sg.fillStyle = '#ffffff'; sg.fillRect(0, 0, T, T);
      for (let k = 0; k < 12; k++) { const a = (k / 12) * TAU; g.drawImage(sil, x + Math.cos(a) * 4.5, y + Math.sin(a) * 4.5); }
    } else {
      // 居民的頭：記下圖示的主要顏色，身體就用這個顏色
      const d = tg.getImageData(0, 0, T, T).data;
      let r = 0, gg = 0, b = 0, w = 0;
      for (let k = 0; k < d.length; k += 16) { const a = d[k + 3] / 255; if (a < 0.5) continue; const sat = Math.max(d[k], d[k + 1], d[k + 2]) - Math.min(d[k], d[k + 1], d[k + 2]); const wt = a * (0.2 + sat / 255); r += d[k] * wt; gg += d[k + 1] * wt; b += d[k + 2] * wt; w += wt; }
      colors.set(icon, w ? new THREE.Color().setRGB(r / w / 255, gg / w / 255, b / w / 255, THREE.SRGBColorSpace) : new THREE.Color(0xdddddd));
    }
    g.drawImage(tmp, x, y);
    g.restore();
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return { tex, cols, rows, index: new Map(icons.map((ic, i) => [ic, i])), colors };
}

// 居民是一個立體的小人：3D 的身體和兩隻腳（會被光照到、有陰影），頭是那一集的圖示
// （做成有厚度、有光澤的一塊，永遠面向鏡頭），頭上的徽章說能不能聽，腳下的光圈也是：
// 綠色 ▶ ＝ 現在就可以聽；金色皇冠 ＝ VIP（請大人幫忙）；灰灰的在睡覺 💤 ＝ 還在準備中
// 尺寸（以居民大小 S 為單位）：腳 0～0.1，身體 0～0.58，頭 0.36～1.31，徽章再上面
export const BODY = { headBottom: 0.36, head: 0.95, top: 1.75 };
function makeResidents(scene, list, atlas) {
  const n = list.length;
  const quad = new THREE.InstancedBufferGeometry();
  quad.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0], 3));
  quad.setIndex([0, 1, 2, 0, 2, 3]);
  const iPos = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage);
  const iA = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4).setUsage(THREE.DynamicDrawUsage); // 圖示、頭上的東西、跳起來多高、相位
  const iB = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4).setUsage(THREE.DynamicDrawUsage); // 面向、聽過、被點到、大小
  const iC = new THREE.InstancedBufferAttribute(new Float32Array(n * 2), 2).setUsage(THREE.DynamicDrawUsage); // 睡覺（還沒上架）、能不能聽（0 可以聽、1 VIP、2 還不行）
  quad.setAttribute('iPos', iPos); quad.setAttribute('iA', iA); quad.setAttribute('iB', iB); quad.setAttribute('iC', iC);
  quad.instanceCount = n;
  const uniforms = { time: { value: 0 }, map: { value: atlas.tex }, grid: { value: new THREE.Vector2(atlas.cols, atlas.rows) }, checkTile: { value: atlas.index.get('check') } };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `attribute vec3 iPos; attribute vec4 iA; attribute vec4 iB; attribute vec2 iC; uniform float time;
      varying vec2 vQ; varying vec4 vA; varying vec4 vB; varying vec2 vC;
      void main() {
        float S = iB.w;
        vec3 right = normalize(vec3(viewMatrix[0][0], 0.0, viewMatrix[2][0]));
        vec3 back = normalize(vec3(viewMatrix[0][2], 0.0, viewMatrix[2][2]));
        // 頭在身體前面一點（不然會被圓圓的身體擋住），每個人再多挪一點點，站同一排的才不會閃爍
        vec3 p = iPos + right * position.x * S * 1.3 + vec3(0.0, position.y * ${BODY.top.toFixed(2)} * S + iA.z, 0.0) + back * (S * 0.26 + iA.w * 0.03);
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
        vQ = vec2(position.x * 1.3, position.y * ${BODY.top.toFixed(2)});
        vA = iA; vB = iB; vC = iC;
      }`,
    fragmentShader: /* glsl */ `uniform sampler2D map; uniform vec2 grid; uniform float time; uniform float checkTile;
      varying vec2 vQ; varying vec4 vA; varying vec4 vB; varying vec2 vC;
      vec4 tile(float idx, vec2 uv) {
        if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return vec4(0.0);
        // 編號從頂點傳過來會有一點點誤差（84 變成 83.9999），要先四捨五入，不然會拿到隔壁的圖、出現條紋
        float id = floor(idx + 0.5);
        float row = floor((id + 0.5) / grid.x);
        vec2 cell = vec2(id - row * grid.x, row);
        return texture2D(map, vec2((cell.x + uv.x) / grid.x, 1.0 - (cell.y + 1.0 - uv.y) / grid.y));
      }
      vec4 over(vec4 top, vec4 base) { float a = top.a + base.a * (1.0 - top.a); return vec4((top.rgb * top.a + base.rgb * base.a * (1.0 - top.a)) / max(a, 0.0001), a); }
      void main() {
        vec4 col = vec4(0.0);
        float sleep = vC.x;
        // ---- 頭：有厚度的圖示 ----
        vec2 h = (vQ - vec2(0.0, ${BODY.headBottom.toFixed(2)} + (sleep > 0.5 ? -0.06 : 0.0))) / ${BODY.head.toFixed(2)};
        vec2 uv = vec2(h.x * vB.x + 0.5, h.y);
        // 側面：往下、往旁邊疊幾層變暗的影子，看起來像一塊有厚度的餅乾
        vec4 side = vec4(0.0);
        for (int k = 5; k >= 1; k--) {
          vec4 s = tile(vA.x, uv + vec2(0.006 * float(k) * vB.x, 0.014 * float(k)));
          side = over(vec4(s.rgb * (0.52 + 0.03 * float(k)), s.a), side);
        }
        vec4 face = tile(vA.x, uv);
        // 邊緣的斜面：用旁邊四點的透明度算出「表面朝哪裡」，朝左上（光）的亮、朝右下的暗
        float e = 0.022;
        float aL = tile(vA.x, uv - vec2(e, 0.0)).a, aR = tile(vA.x, uv + vec2(e, 0.0)).a;
        float aD = tile(vA.x, uv - vec2(0.0, e)).a, aU = tile(vA.x, uv + vec2(0.0, e)).a;
        vec2 nrm = vec2(aL - aR, aD - aU);
        float bevel = dot(nrm, normalize(vec2(-0.6 * vB.x, 0.8)));
        face.rgb *= 1.0 + 0.32 * bevel + 0.08 * (uv.y - 0.5);
        // 一點點亮亮的反光
        face.rgb += vec3(0.22) * face.a * (1.0 - smoothstep(0.0, 0.16, length((uv - vec2(0.5 - 0.17 * vB.x, 0.74)) * vec2(1.0, 1.6))));
        // 細細的深色外框（貼在草地、雪地上也看得清楚）
        float near = max(max(aL, aR), max(aD, aU));
        vec4 rim = vec4(0.17, 0.18, 0.32, near * 0.9 * (1.0 - face.a));
        vec4 head = over(face, over(rim, side));
        if (sleep > 0.5) head.rgb = mix(head.rgb, vec3(dot(head.rgb, vec3(0.33))), 0.45) * 0.95;
        head.rgb = mix(head.rgb, vec3(1.0), vB.z * 0.2);
        col = over(head, col);
        float bob = sin(time * 2.0 + vA.w) * 0.03;
        // ---- 頭上：能不能聽 ----
        if (vC.y < 0.5) {
          // 綠色的播放鍵 ▶：可以聽
          vec2 c = (vQ - vec2(0.38, 1.22 + bob)) / (0.22 * (1.0 + 0.06 * sin(time * 3.0 + vA.w)));
          float r = length(c);
          vec2 t = c - vec2(0.08, 0.0);
          float tri = step(-0.32, t.x) * step(abs(t.y) * 1.73 + t.x, 0.42);
          vec4 badge = r < 1.0 ? vec4(mix(vec3(0.16, 0.72, 0.42), vec3(0.32, 0.86, 0.55), 0.5 + 0.5 * c.y), 1.0) : r < 1.22 ? vec4(1.0) : vec4(0.0);
          if (r < 1.0 && tri > 0.5) badge = vec4(1.0);
          if (r >= 1.22 && r < 1.32) badge = vec4(0.17, 0.18, 0.32, 0.6);
          col = over(badge, col);
        } else if (vA.y >= 0.0) {
          // 皇冠（VIP）或 zzz（還在準備中）
          vec2 o = (vQ - vec2(sleep > 0.5 ? 0.32 : 0.0, 1.2 + bob)) / 0.46 + vec2(0.5, 0.0);
          col = over(tile(vA.y, o), col);
        }
        // 聽過的：左上角一個綠色勾勾
        if (vB.y > 0.5) col = over(tile(checkTile, (vQ - vec2(-0.4, 1.04)) / 0.3 + vec2(0.5, 0.0)), col);
        if (col.a < 0.5) discard;
        gl_FragColor = vec4(col.rgb, 1.0);
      }`,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(quad, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;
  scene.add(mesh);
  // 身體：圓滾滾的豆子，顏色跟頭（圖示）一樣
  const body = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.2, 0.18, 4, 12).translate(0, 0.3, 0), new THREE.MeshStandardMaterial({ roughness: 0.55 }), n);
  const feet = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 6), new THREE.MeshStandardMaterial({ color: 0x3d4270, roughness: 0.6 }), n * 2);
  body.frustumCulled = feet.frustumCulled = false;
  body.instanceMatrix.setUsage(THREE.DynamicDrawUsage); feet.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const grey = new THREE.Color(0xb8bccc), white = new THREE.Color(0xffffff);
  list.forEach((p, i) => {
    const c = (atlas.colors.get(p.e.icon) || grey).clone().lerp(white, 0.3);
    if (p.e.state === 'unreleased') c.lerp(grey, 0.6);
    body.setColorAt(i, c);
  });
  scene.add(body, feet);
  // 腳下：影子＋光圈（綠色＝可以聽、金色＝VIP，還在準備中的只有影子）
  const sq = new THREE.InstancedBufferGeometry();
  sq.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, -0.5, 0.5, 0, -0.5, 0.5, 0, 0.5, -0.5, 0, 0.5], 3));
  sq.setIndex([0, 2, 1, 0, 3, 2]);
  sq.setAttribute('iPos', iPos); sq.setAttribute('iB', iB); sq.setAttribute('iC', iC); sq.setAttribute('iA', iA);
  sq.instanceCount = n;
  const shadow = new THREE.Mesh(sq, new THREE.ShaderMaterial({
    uniforms: { time: uniforms.time },
    vertexShader: /* glsl */ `attribute vec3 iPos; attribute vec4 iB; attribute vec2 iC; attribute vec4 iA; varying vec2 vP; varying vec2 vC; varying float vPh;
      void main() { vP = position.xz * 2.0; vC = iC; vPh = iA.w; vec3 p = iPos + vec3(position.x * iB.w * 1.3, 0.12, position.z * iB.w * 1.3); gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0); }`,
    fragmentShader: /* glsl */ `uniform float time; varying vec2 vP; varying vec2 vC; varying float vPh;
      void main() {
        float d = length(vP);
        vec4 c = vec4(0.25, 0.2, 0.4, 0.3 * (1.0 - smoothstep(0.15, 0.55, d)));
        if (vC.y < 1.5) {
          vec3 rc = vC.y < 0.5 ? vec3(0.25, 0.85, 0.5) : vec3(1.0, 0.78, 0.25);
          float pulse = vC.y < 0.5 ? 0.75 + 0.25 * sin(time * 3.0 + vPh) : 0.8;
          float ring = (1.0 - smoothstep(0.0, 0.1, abs(d - 0.72))) * pulse;
          c = vec4(mix(c.rgb, rc, ring), max(c.a, ring * 0.9));
        }
        if (c.a < 0.01) discard;
        gl_FragColor = c;
      }`,
    transparent: true, depthWrite: false,
  }));
  shadow.frustumCulled = false;
  scene.add(shadow);
  return { mesh, body, feet, iPos, iA, iB, iC, uniforms };
}

function sparkleTexture() {
  return cached('sparkle4', () => {
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
    g.translate(32, 32); g.fillStyle = '#fff';
    g.beginPath(); for (let i = 0; i < 8; i++) { const r = i % 2 ? 6 : 30, a = (i / 8) * TAU; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fill();
    const r = g.createRadialGradient(0, 0, 0, 0, 0, 14); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(-32, -32, 64, 64);
    return c;
  });
}
function cloudTexture() {
  return cached('cloud-soft', () => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 160; const g = c.getContext('2d');
    const blob = (x, y, r) => { const rg = g.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(0.6, 'rgba(255,255,255,0.85)'); rg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = rg; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); };
    blob(128, 100, 70); blob(80, 105, 50); blob(176, 108, 48); blob(110, 70, 48); blob(150, 74, 42);
    return c;
  });
}

// ---------- 主程式 ----------
/**
 * islands：[{ def, eps: [episode...] }]；episodes 要有 code、icon、state、labs。
 * 回呼：onArrive(def) 到達一座島、onResident(code) 點到居民、onHover(code|null, x, y)、onLaunch(def) 火箭出發、onReady()。
 */
export function createIsles({ canvas, islands, startId, getStamps, onArrive = () => {}, onResident = () => {}, onHover = () => {}, onLaunch = () => {}, onReady = () => {} }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.05;
  let pixelRatio = Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2);
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xd8e4ff, 650, 1900);
  const camera = new THREE.PerspectiveCamera(45, 1, 0.5, 6000);
  scene.add(new THREE.HemisphereLight(0xeaf4ff, 0xffe0c8, 1.5));
  const sun = new THREE.DirectionalLight(0xfff0d8, 2.0); sun.position.set(300, 500, 200); scene.add(sun);
  scene.add(new THREE.AmbientLight(0xffffff, 0.25));
  const skyTick = makeSky(scene);
  const sound = new Sound();

  const islandCloud = new THREE.SpriteMaterial({ map: cloudTexture(), color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false });
  // ----- 擺島：錄音室島在中間，其他島圍成兩圈；太空的島比較高 -----
  const isles = islands.map(({ def, eps }) => {
    const R = def.id === startId ? 17 : Math.max(11, Math.min(23, 10 + Math.sqrt(eps.length) * 2.3));
    return { def, eps, R };
  });
  const others = isles.filter((x) => x.def.id !== startId);
  others.forEach((x, i) => {
    const a = (i / others.length) * TAU + 0.15, ring = i % 2 ? 182 : 128;
    const jitter = (hash(x.def.id) - 0.5) * 10;
    x.pos = new THREE.Vector3(Math.cos(a) * ring, (TIER_Y[x.def.tier] ?? 0) + jitter, Math.sin(a) * ring);
  });
  isles.forEach((x) => {
    if (!x.pos) x.pos = new THREE.Vector3(0, TIER_Y.home, 0);
    const built = buildIsland(x.def, x.R);
    Object.assign(x, built);
    x.root = new THREE.Group();
    x.root.position.copy(x.pos);
    x.root.add(built.group);
    x.phase = hash(x.def.id) * TAU;
    // 島底下抱著幾朵小雲，看起來真的浮在天上
    const cr2 = rng(hash(x.def.id) + 0.5);
    for (let i = 0; i < 3; i++) {
      const c = new THREE.Sprite(islandCloud);
      const a = cr2() * TAU;
      c.position.set(Math.cos(a) * x.R * 0.75, -x.R * (0.55 + cr2() * 0.3), Math.sin(a) * x.R * 0.75);
      const k = x.R * (0.9 + cr2() * 0.5); c.scale.set(k * 1.7, k, 1);
      x.root.add(c);
    }
    scene.add(x.root);
  });
  const byId = new Map(isles.map((x) => [x.def.id, x]));

  // ----- 居民 -----
  const people = [];
  isles.forEach((x) => x.eps.forEach((e) => people.push({ e, isle: x })));
  const icons = [...new Set(people.map((p) => p.e.icon)), '👑', 'zzz', 'check'];
  const atlas = makeAtlas(icons, ['👑', 'zzz', 'check']);
  const crown = atlas.index.get('👑'), zzz = atlas.index.get('zzz');
  const res = makeResidents(scene, people, atlas);
  const r0 = rng(0.61);
  people.forEach((p, i) => {
    const w = p.isle.walk;
    // 從一個空地出發（稍微撒開，但不要撒進房子或水裡）
    const start = w[Math.floor(r0() * w.length)];
    p.x = start[0]; p.z = start[1];
    for (let k = 0; k < 6; k++) { const x = start[0] + (r0() - 0.5), z = start[1] + (r0() - 0.5); if (p.isle.canWalk(x, z)) { p.x = x; p.z = z; break; } }
    p.target = null; p.wait = r0() * 3; p.speed = 0.9 + r0() * 0.6; p.face = r0() > 0.5 ? 1 : -1;
    p.sleep = p.e.state === 'unreleased';
    p.size = p.isle.swim ? 2.7 : 3.0;
    p.walking = 0;
    p.gy = p.isle.swim ? p.isle.walkY : p.isle.ground(p.x, p.z);
    res.iA.setXYZW(i, atlas.index.get(p.e.icon), p.e.state === 'subscriber' ? crown : p.sleep ? zzz : -1, 0, r0() * TAU);
    res.iB.setXYZW(i, p.face, 0, 0, p.size);
    res.iC.setXY(i, p.sleep ? 1 : 0, p.e.state === 'public' ? 0 : p.e.state === 'subscriber' ? 1 : 2);
    p.hi = 0;
  });
  function refreshMarks() {
    const st = getStamps();
    people.forEach((p, i) => res.iB.setY(i, st.seen.includes(p.e.code) ? 1 : 0));
    res.iB.needsUpdate = true;
  }
  refreshMarks();
  const byCode = new Map(people.map((p, i) => [p.e.code, i]));
  const camRight = new THREE.Vector3(), camBack = new THREE.Vector3();
  const bodyM = new THREE.Matrix4(), footM = new THREE.Matrix4();
  function stepPeople(dt, t) {
    camRight.set(camera.matrixWorld.elements[0], 0, camera.matrixWorld.elements[2]).normalize();
    camBack.set(camera.matrixWorld.elements[8], 0, camera.matrixWorld.elements[10]).normalize();
    people.forEach((p, i) => {
      const isle = p.isle;
      if (p.hi > 0) p.hi = Math.max(0, p.hi - dt);
      let walking = 0;
      if (!p.sleep && !reduceMotion && p.hi <= 0) {
        if (p.wait > 0) p.wait -= dt;
        else {
          if (!p.target) {
            // 去附近的一個空地
            const near = isle.walk.filter(([x, z]) => Math.hypot(x - p.x, z - p.z) < 9);
            const list = near.length ? near : isle.walk;
            // 找一個走得到的點：路上不穿過房子、不掉進湖裡（試幾次都不行就先站著）
            for (let tries = 0; tries < 4 && !p.target; tries++) {
              const pick = list[Math.floor(Math.random() * list.length)];
              const tx = pick[0] + (Math.random() - 0.5) * 1.2, tz = pick[1] + (Math.random() - 0.5) * 1.2;
              const n = Math.ceil(Math.hypot(tx - p.x, tz - p.z) / 0.8);
              let ok = true;
              const stuck = !isle.canWalk(p.x, p.z); // 站在不能走的地方（一開始撒點撒歪了）：先讓他走出來
              for (let s = 1; s <= n && ok && !stuck; s++) ok = isle.canWalk(p.x + ((tx - p.x) * s) / n, p.z + ((tz - p.z) * s) / n);
              if (ok) p.target = [tx, tz];
            }
            if (!p.target) p.wait = 1 + Math.random() * 2;
          }
          if (p.target) {
            const dx = p.target[0] - p.x, dz = p.target[1] - p.z, d = Math.hypot(dx, dz);
            if (d < 0.2) { p.target = null; p.wait = 1 + Math.random() * 4; }
            else {
              const v = Math.min(d, p.speed * dt);
              p.x += (dx / d) * v; p.z += (dz / d) * v;
              if (!isle.swim) p.gy = isle.ground(p.x, p.z);
              walking = 1;
              const sx = dx * camRight.x + dz * camRight.z;
              if (Math.abs(sx) > 0.05) p.face = sx > 0 ? -1 : 1; // 圖示大多朝左：往右走就翻過來
            }
          }
        }
      }
      const bob = Math.sin(t * 0.5 + isle.phase) * 0.6;
      res.iPos.setXYZ(i, isle.pos.x + p.x, isle.pos.y + bob + p.gy, isle.pos.z + p.z);
      // 跳一跳：走路時小小的跳、被點到時跳高高；睡覺的輕輕晃
      const S = p.size, step = t * 7 + res.iA.getW(i);
      p.walking += (walking - p.walking) * Math.min(1, dt * 8);
      const jump = p.hi > 0 ? Math.abs(Math.sin(t * 9)) * 0.5 * S : 0;
      const hop = p.walking * Math.abs(Math.sin(step)) * 0.12 * S + jump;
      const sink = isle.swim ? 0.32 * S : 0; // 在水裡游泳：身體泡在水裡，只露出頭
      res.iA.setZ(i, hop - sink);
      res.iB.setX(i, p.face);
      res.iB.setZ(i, p.hi > 0 ? 1 : 0);
      // 3D 身體和腳
      const x = isle.pos.x + p.x, y = isle.pos.y + bob + p.gy, z = isle.pos.z + p.z;
      const squash = 1 + p.walking * Math.sin(step * 2) * 0.06;
      bodyM.makeScale(S / squash, S * squash * (p.sleep ? 0.8 : 1), S / squash);
      bodyM.setPosition(x, y + hop - sink, z);
      res.body.setMatrixAt(i, bodyM);
      for (let k = 0; k < 2; k++) {
        const side = k ? 1 : -1, lift = p.walking * Math.max(0, Math.sin(step + k * Math.PI)) * 0.09 * S;
        const fwd = p.sleep ? 0.2 : 0.05;
        footM.makeScale(0.11 * S, 0.065 * S, 0.15 * S);
        footM.setPosition(x + camRight.x * side * 0.11 * S + camBack.x * fwd * S, y + jump + lift + 0.05 * S - sink, z + camRight.z * side * 0.11 * S + camBack.z * fwd * S);
        res.feet.setMatrixAt(i * 2 + k, footM);
      }
    });
    res.iPos.needsUpdate = true; res.iA.needsUpdate = true; res.iB.needsUpdate = true;
    res.body.instanceMatrix.needsUpdate = true; res.feet.instanceMatrix.needsUpdate = true;
  }

  // ----- 火箭 -----
  const trail = makeTrail(scene);
  const ship = makeRocket({ scale: 0.9, riders: true });
  scene.add(ship);
  const padWorld = (isle, t = time) => new THREE.Vector3(isle.pos.x + isle.pad.x, isle.pos.y + Math.sin(t * 0.5 + isle.phase) * 0.6 + 0.3 + (isle.pad.y || 0), isle.pos.z + isle.pad.z);
  let here = byId.get(startId) || isles[0];
  let flight = null; // { from, to, t, dur, p0..p3 }
  const traffic = Array.from({ length: coarse ? 4 : 6 }, (_, i) => {
    const rk = makeRocket({ scale: 0.45, color: [0x5cb8ff, 0xffc25a, 0x7ad87a, 0xb98cff, 0xff8ab8, 0x5fdcc0][i] });
    scene.add(rk);
    return { rk, from: isles[(i * 5 + 1) % isles.length], to: null, t: 0, dur: 1, wait: i * 1.5 };
  });
  const bez = (p0, p1, p2, p3, t, out) => {
    const u = 1 - t;
    return out.set(0, 0, 0).addScaledVector(p0, u * u * u).addScaledVector(p1, 3 * u * u * t).addScaledVector(p2, 3 * u * t * t).addScaledVector(p3, t * t * t);
  };
  const arc = (a, b) => {
    const p0 = padWorld(a), p3 = padWorld(b);
    const lift = 26 + p0.distanceTo(p3) * 0.12;
    return { p0, p1: p0.clone().add(new THREE.Vector3(0, lift, 0)), p2: p3.clone().add(new THREE.Vector3(0, lift, 0)), p3 };
  };
  const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpQ = new THREE.Quaternion();
  function orient(obj, dir) {
    if (dir.lengthSq() < 1e-6) return;
    tmpQ.setFromUnitVectors(UP, dir.clone().normalize());
    obj.quaternion.slerp(tmpQ, 0.25);
  }
  function stepTraffic(dt, t) {
    traffic.forEach((r) => {
      if (!r.to) {
        r.wait -= dt;
        const p = padWorld(r.from, t).add(new THREE.Vector3(1.6, 0, 1.6));
        r.rk.position.copy(p); r.rk.quaternion.identity(); r.rk.userData.setFire(0);
        r.rk.visible = false; // 停好就收進機棚
        if (r.wait <= 0) {
          let to = isles[Math.floor(Math.random() * isles.length)];
          if (to === r.from) to = isles[(isles.indexOf(to) + 3) % isles.length];
          r.to = to; r.t = 0; r.path = arc(r.from, to); r.dur = 5 + r.path.p0.distanceTo(r.path.p3) / 45;
        }
        return;
      }
      r.rk.visible = true;
      r.t = Math.min(1, r.t + dt / r.dur);
      const e = ease(r.t);
      bez(r.path.p0, r.path.p1, r.path.p2, r.path.p3, e, tmpA);
      bez(r.path.p0, r.path.p1, r.path.p2, r.path.p3, Math.min(1, e + 0.01), tmpB);
      r.rk.position.copy(tmpA);
      orient(r.rk, tmpB.sub(tmpA));
      r.rk.userData.setFire(r.t < 0.95 ? 0.8 : 0.2);
      if (Math.random() < dt * 14) trail.puff(tmpA, t, 1.4);
      if (r.t >= 1) { r.from = r.to; r.to = null; r.wait = 2 + Math.random() * 4; }
    });
  }

  // ----- 鏡頭：繞著島轉（拖曳）、兩指／滾輪拉近拉遠；整個群島的全景 -----
  const view = { target: new THREE.Vector3(), yaw: 0.6, pitch: 0.55, dist: 50 };
  let mode = 'island';
  let camAnim = null, lastTouch = 0;
  const vel = { yaw: 0, pitch: 0 };
  // 要看到寬 w 的東西，鏡頭要多遠（手機直拿時橫的視野很窄，要退遠一點）
  function fitDist(w) { const hf = Math.atan(Math.tan((camera.fov * Math.PI) / 360) * camera.aspect); return w / Math.tan(hf); }
  function islandView(isle, yaw = view.yaw) { return { target: new THREE.Vector3(isle.pos.x, isle.pos.y + 2, isle.pos.z), yaw, pitch: 0.6, dist: Math.max(isle.R * 2.05 + 9, fitDist(isle.R * 1.08)) }; }
  function overviewView() { return { target: new THREE.Vector3(0, 6, 0), yaw: view.yaw, pitch: 0.98, dist: Math.max(470, fitDist(215)) }; }
  const limits = () => (mode === 'overview' ? { min: 260, max: Math.max(760, fitDist(260)), pmin: 0.35, pmax: 1.35 } : { min: here.R * 1.1 + 5, max: Math.max(here.R * 3.6 + 26, fitDist(here.R * 1.6)), pmin: 0.15, pmax: 1.2 });
  function placeCamera() {
    const cp = Math.cos(view.pitch);
    camera.position.set(view.target.x + Math.sin(view.yaw) * cp * view.dist, view.target.y + Math.sin(view.pitch) * view.dist, view.target.z + Math.cos(view.yaw) * cp * view.dist);
    camera.lookAt(view.target);
  }
  function animateTo(to, dur = 1.2, done) {
    camAnim = { from: { target: view.target.clone(), yaw: view.yaw, pitch: view.pitch, dist: view.dist }, to, t: 0, dur, done };
  }
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

  function travel(id) {
    const to = byId.get(id);
    if (!to || flight) return false;
    if (to === here) { mode = 'island'; animateTo(islandView(here), 1); onArrive(here.def); return true; }
    const path = arc(here, to);
    const flat = path.p3.clone().sub(path.p0).setY(0);
    flight = { from: here, to, t: 0, pre: reduceMotion ? 0.2 : 0.9, dur: reduceMotion ? 1.2 : 3.2 + path.p0.distanceTo(path.p3) / 160, path, heading: flat.lengthSq() > 1e-6 ? flat.normalize() : new THREE.Vector3(0, 0, 1) };
    mode = 'flight';
    sound.wake(); sound.tune();
    onLaunch(to.def);
    return true;
  }
  function stepFlight(dt, t) {
    if (!flight) {
      // 停在島上：直直地站在停機坪
      ship.position.copy(padWorld(here, t)); ship.quaternion.identity(); ship.userData.inner.position.set(0, 0, 0); ship.userData.setFire(0);
      return;
    }
    const f = flight;
    if (f.pre > 0) f.pre -= dt; else f.t += dt / f.dur;
    if (f.pre > 0) { // 點火倒數：火箭抖一抖、冒煙
      ship.position.copy(padWorld(f.from, t));
      ship.userData.inner.position.set((Math.random() - 0.5) * 0.12, 0, (Math.random() - 0.5) * 0.12);
      ship.userData.setFire(0.5 + Math.random() * 0.3);
      if (Math.random() < dt * 30) trail.puff(ship.position, t, 2.5);
      const v = islandView(f.from);
      view.target.lerp(ship.position.clone().add(new THREE.Vector3(0, 4, 0)), 0.06);
      view.dist += (Math.min(v.dist, 34) - view.dist) * 0.05;
      return;
    }
    ship.userData.inner.position.set(0, 0, 0);
    const u = Math.min(1, f.t), e = ease(u);
    bez(f.path.p0, f.path.p1, f.path.p2, f.path.p3, e, tmpA);
    bez(f.path.p0, f.path.p1, f.path.p2, f.path.p3, Math.min(1, e + 0.01), tmpB);
    const dir = tmpB.clone().sub(tmpA);
    ship.position.copy(tmpA);
    if (u < 0.97) orient(ship, dir); else ship.quaternion.slerp(new THREE.Quaternion(), 0.2);
    ship.userData.setFire(u < 0.9 ? 1 : 0.4);
    if (Math.random() < dt * 40) trail.puff(tmpA, t, 2.2);
    // 鏡頭跟在火箭後面上方
    const flatDir = dir.clone().setY(0);
    const fwd = flatDir.lengthSq() > 1e-4 ? flatDir.normalize() : f.heading;
    const wantYaw = Math.atan2(-fwd.x, -fwd.z);
    view.yaw += wrap(wantYaw - view.yaw) * Math.min(1, dt * 1.5);
    view.target.lerp(tmpA, Math.min(1, dt * 4));
    const goal = u > 0.75 ? islandView(f.to) : null;
    view.dist += ((goal ? goal.dist : 46) - view.dist) * Math.min(1, dt * 1.2);
    view.pitch += ((goal ? goal.pitch : 0.42) - view.pitch) * Math.min(1, dt * 1.2);
    if (u >= 1) {
      here = f.to; flight = null; mode = 'island';
      animateTo(islandView(here), 1.0);
      sound.chime();
      onArrive(here.def);
    }
  }

  // ----- 點選 -----
  const v3 = new THREE.Vector3();
  function toScreen(p) { v3.copy(p).project(camera); return { x: ((v3.x + 1) / 2) * canvas.clientWidth, y: ((1 - v3.y) / 2) * canvas.clientHeight, behind: v3.z > 1 }; }
  function pickPerson(sx, sy) {
    if (mode !== 'island') return -1;
    let best = -1, bestD = Infinity;
    const pxPerUnit = canvas.clientHeight / (2 * Math.tan((camera.fov * Math.PI) / 360) * view.dist);
    const rad = Math.max(30, 2.9 * pxPerUnit * 0.75);
    people.forEach((p, i) => {
      if (p.isle !== here) return;
      const s = toScreen(v3.set(res.iPos.getX(i), res.iPos.getY(i) + p.size * 0.8, res.iPos.getZ(i)));
      if (s.behind) return;
      const d = Math.hypot(s.x - sx, s.y - sy);
      if (d < rad && d < bestD) { best = i; bestD = d; }
    });
    return best;
  }
  function pickIsland(sx, sy) {
    let best = null, bestD = Infinity;
    isles.forEach((x) => {
      if (mode === 'island' && x === here) return;
      const s = toScreen(v3.copy(x.pos));
      if (s.behind) return;
      const rpx = (x.R / camera.position.distanceTo(x.pos)) * canvas.clientHeight / (2 * Math.tan((camera.fov * Math.PI) / 360));
      const d = Math.hypot(s.x - sx, s.y - sy);
      if (d < Math.max(36, rpx * 1.1) && d < bestD) { best = x; bestD = d; }
    });
    return best;
  }
  function greet(i) {
    const p = people[i];
    p.hi = 1.4;
    p.target = null; p.wait = 2.5;
    sound.wake(); sound.pick();
  }

  // ----- 手勢 -----
  const pointers = new Map();
  let drag = null, pinch = 0;
  canvas.addEventListener('pointerdown', (ev) => {
    if (ev.pointerType === 'mouse' && ev.button !== 0) return;
    try { canvas.setPointerCapture(ev.pointerId); } catch { /* 沒關係 */ }
    pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    lastTouch = performance.now();
    if (pointers.size === 1) { drag = { x: ev.clientX, y: ev.clientY, moved: 0 }; vel.yaw = vel.pitch = 0; }
    if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); drag = null; }
  });
  canvas.addEventListener('pointermove', (ev) => {
    if (!pointers.has(ev.pointerId)) {
      if (ev.pointerType === 'mouse' && mode === 'island') { const i = pickPerson(ev.clientX, ev.clientY); hover(i, ev.clientX, ev.clientY); canvas.style.cursor = i >= 0 || pickIsland(ev.clientX, ev.clientY) ? 'pointer' : 'grab'; }
      return;
    }
    const prev = pointers.get(ev.pointerId);
    pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    lastTouch = performance.now();
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch) zoom(pinch / d);
      pinch = d;
      return;
    }
    if (!drag || mode === 'flight') return;
    const dx = ev.clientX - prev.x, dy = ev.clientY - prev.y;
    drag.moved += Math.hypot(dx, dy);
    if (drag.moved < 8) return;
    camAnim = null;
    vel.yaw = -dx * 0.005; vel.pitch = dy * 0.004;
    view.yaw += vel.yaw; view.pitch += vel.pitch;
    clampView();
  });
  const end = (ev) => {
    if (!pointers.has(ev.pointerId)) return;
    const tap = drag && drag.moved < 8 && pointers.size === 1;
    pointers.delete(ev.pointerId);
    if (pointers.size < 2) pinch = 0;
    if (!pointers.size) drag = null;
    if (!tap || mode === 'flight') return;
    vel.yaw = vel.pitch = 0;
    const i = pickPerson(ev.clientX, ev.clientY);
    if (i >= 0) { greet(i); onResident(people[i].e.code); return; }
    const isle = pickIsland(ev.clientX, ev.clientY);
    if (isle) { if (mode === 'overview' && isle === here) { mode = 'island'; animateTo(islandView(here), 1.1); onArrive(here.def); } else travel(isle.def.id); }
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', (ev) => { pointers.delete(ev.pointerId); drag = null; pinch = 0; });
  canvas.addEventListener('lostpointercapture', (ev) => { if (pointers.has(ev.pointerId)) { pointers.delete(ev.pointerId); drag = null; pinch = 0; } });
  canvas.addEventListener('pointerleave', () => hover(-1));
  canvas.addEventListener('wheel', (ev) => { ev.preventDefault(); lastTouch = performance.now(); zoom(Math.exp(ev.deltaY * (ev.ctrlKey ? 0.01 : 0.0012))); }, { passive: false });
  function zoom(k) {
    if (mode === 'flight') return;
    camAnim = null;
    const L = limits();
    // 在島上一直拉遠 → 變成整個群島的全景；全景一直拉近 → 回到島上
    if (mode === 'island' && view.dist * k > L.max * 1.02) { showOverview(); return; }
    if (mode === 'overview' && view.dist * k < L.min * 0.98) { mode = 'island'; animateTo(islandView(here), 1.1); onArrive(here.def); return; }
    view.dist = Math.max(L.min, Math.min(L.max, view.dist * k));
  }
  function clampView() { const L = limits(); view.pitch = Math.max(L.pmin, Math.min(L.pmax, view.pitch)); view.dist = Math.max(L.min, Math.min(L.max, view.dist)); }
  function showOverview() {
    if (flight) return;
    mode = 'overview';
    animateTo(overviewView(), 1.4);
    onArrive(null);
  }
  let hovered = -1;
  function hover(i, x, y) {
    if (i === hovered) { if (i >= 0) onHover(people[i].e.code, x, y); return; }
    hovered = i;
    onHover(i >= 0 ? people[i].e.code : null, x, y);
  }

  // ----- 每一格 -----
  let time = 0, last = performance.now();
  const perf = { sum: 0, n: 0, done: false };
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // 手機直拿：視野放寬一點，島才不會只剩中間一小塊
    camera.fov = w / h < 0.8 ? 58 : 45;
    camera.updateProjectionMatrix();
  }
  if (typeof ResizeObserver === 'function') new ResizeObserver(resize).observe(canvas); else window.addEventListener('resize', resize);
  resize();
  let lastErr = '', firstFrame = true;
  function frame(now) {
    requestAnimationFrame(frame);
    if (document.hidden || !canvas.clientWidth || document.querySelector('dialog.labsheet[open]')) { last = now; return; }
    const raw = (now - last) / 1000;
    if (document.querySelector('dialog[open]') && raw < 0.1) return; // 視窗開著：每秒 10 格就好
    last = now;
    const dt = Math.min(0.1, raw);
    time += dt;
    if (!perf.done && !document.querySelector('dialog[open]') && !firstFrame) {
      perf.sum += raw; perf.n += 1;
      if (perf.n >= 90) { if (perf.sum / perf.n > 1 / 30 && pixelRatio > 1) { pixelRatio = 1; resize(); } perf.done = true; }
    }
    try {
      if (camAnim) {
        camAnim.t = Math.min(1, camAnim.t + dt / camAnim.dur);
        const e = ease(camAnim.t), a = camAnim.from, b = camAnim.to;
        view.target.lerpVectors(a.target, b.target, e);
        view.yaw = a.yaw + wrap(b.yaw - a.yaw) * e;
        view.pitch = a.pitch + (b.pitch - a.pitch) * e;
        view.dist = Math.exp(Math.log(a.dist) + (Math.log(b.dist) - Math.log(a.dist)) * e);
        if (camAnim.t >= 1) { const done = camAnim.done; camAnim = null; done?.(); }
      } else if (mode !== 'flight') {
        if (!pointers.size && Math.abs(vel.yaw) + Math.abs(vel.pitch) > 1e-4) { view.yaw += vel.yaw; view.pitch += vel.pitch; vel.yaw *= 0.92; vel.pitch *= 0.92; clampView(); }
        // 一陣子沒碰：慢慢自己轉
        if (!reduceMotion && performance.now() - lastTouch > 6000 && !navigator.webdriver) view.yaw += dt * (mode === 'overview' ? 0.03 : 0.06);
        // 島會上下飄，鏡頭跟著
        if (mode === 'island') view.target.y += (here.pos.y + 2 + Math.sin(time * 0.5 + here.phase) * 0.6 - view.target.y) * Math.min(1, dt * 3);
      }
      stepFlight(dt, time);
      placeCamera();
      camera.updateMatrixWorld();
      skyTick(time, dt);
      isles.forEach((x) => {
        x.root.position.y = x.pos.y + Math.sin(time * 0.5 + x.phase) * 0.6;
        // 遠的島只畫島本身，會動的小東西先收起來（省很多次繪圖）
        const near = camera.position.distanceTo(x.pos) < 150 + x.R * 3;
        if (x.live.visible !== near) x.live.visible = near;
        if (near) x.ticks.forEach((f) => f(time));
      });
      stepPeople(dt, time);
      stepTraffic(dt, time);
      trail.tick(time);
      res.uniforms.time.value = time;
      renderer.render(scene, camera);
      if (firstFrame) { firstFrame = false; onReady(); }
    } catch (err) { if (String(err) !== lastErr) { lastErr = String(err); console.error('宇宙群島出錯', err); } }
  }

  // 一開始：停在起點的島
  Object.assign(view, islandView(here));
  placeCamera();
  requestAnimationFrame(frame);

  return {
    sound,
    travel,
    overview: showOverview,
    current: () => (mode === 'overview' ? null : here.def),
    mode: () => mode,
    busy: () => !!flight || !!camAnim,
    refreshMarks,
    /** 讓一個居民跳一跳（從清單點的時候）。 */
    greet(code) { const i = byCode.get(code); if (i != null) greet(i); },
    islandOf(code) { const i = byCode.get(code); return i == null ? null : people[i].isle.def.id; },
    /** 每座島在螢幕上的位置（給島名標籤用）。 */
    islandScreens() {
      return isles.map((x) => {
        const p = toScreen(v3.set(x.pos.x, x.root.position.y + (mode === 'overview' ? x.R * 0.6 + 6 : -x.R * 0.25 - 4), x.pos.z));
        const dist = camera.position.distanceTo(x.pos);
        return { id: x.def.id, x: p.x, y: p.y, behind: p.behind, dist, here: x === here };
      });
    },
    residentScreen(code) { const i = byCode.get(code); if (i == null) return null; return toScreen(v3.set(res.iPos.getX(i), res.iPos.getY(i) + people[i].size * 1.6, res.iPos.getZ(i))); },
    /** 不坐火箭，直接換到那座島（測試用）。 */
    jump(id) { const to = byId.get(id); if (!to || flight) return; here = to; mode = 'island'; camAnim = null; Object.assign(view, islandView(here)); onArrive(here.def); },
    debug: { renderer, scene, camera, view, people, isles, ship, get here() { return here; }, get flight() { return flight; } },
  };
}
