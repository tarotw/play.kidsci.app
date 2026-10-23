// 宇宙地圖（迷宮開圖）的視覺層：星雲霧、發光的枝條、節點光暈、雲裡的光點、會視差的星空。
// 地圖平面在 z = 0、霧在 z = 2、星空在地圖下方；鏡頭從正上方往下看（x 向右、y 向上）。
import * as THREE from 'three';
import { TAU, makePoints, glowSprite } from './kit3d.js';
import { rng } from './explorer.js';

const coarse = matchMedia('(pointer: coarse)').matches;
const MASK = 512;

// 可以無縫拼接的雲朵雜訊（只在開頭算一次，之後 shader 只要查表，手機也跑得動）
function noiseTexture(size = 256) {
  const r = rng(0.77);
  const data = new Uint8Array(size * size * 4);
  const octaves = [[8, 0.5], [16, 0.25], [32, 0.15], [64, 0.1]];
  const grids = octaves.map(([n]) => Float32Array.from({ length: n * n }, () => r()));
  const smooth = (t) => t * t * (3 - 2 * t);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let v = 0;
      octaves.forEach(([n, amp], o) => {
        const g = grids[o], fx = (x / size) * n, fy = (y / size) * n;
        const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = smooth(fx - x0), ty = smooth(fy - y0);
        const at = (i, j) => g[((j % n) * n) + (i % n)];
        const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * tx;
        const b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * tx;
        v += (a + (b - a) * ty) * amp;
      });
      const k = (y * size + x) * 4;
      data[k] = data[k + 1] = data[k + 2] = Math.round(Math.min(1, v) * 255);
      data[k + 3] = 255;
    }
  }
  const t = new THREE.DataTexture(data, size, size);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

export function createMapFx({ canvas, worldR, onFrame }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0c0e22);
  const camera = new THREE.PerspectiveCamera(50, 1, 1, 6000);
  scene.add(camera);
  const view = { x: 0, y: 0, dist: 600, rot: 0 }; // rot：地圖轉了多少（手機直拿時讓長長的枝條變成直的）
  let time = 0, last = performance.now();
  let pixelRatio = Math.min(coarse ? 1.5 : 1.75, window.devicePixelRatio || 1);

  // ---------- 地圖下方的宇宙：星空與星雲（鏡頭移動時有視差，像在高空看下去） ----------
  const r0 = rng(0.31);
  const stars = makePoints(coarse ? 3000 : 6000, (i, c) => {
    c.setHSL(0.58 + r0() * 0.15, 0.4, 0.75 + r0() * 0.2);
    return { pos: [(r0() - 0.5) * worldR * 5, (r0() - 0.5) * worldR * 5, -60 - r0() * 900], size: 1.5 + r0() * 3.5 };
  }, { scale: 900, gain: 1.1 });
  scene.add(stars);
  [[0x8a6ac8, -0.4, 0.3, -700, 3.2], [0x3a8ab0, 0.5, -0.2, -700, 3.2], [0xb06a8a, 0.1, 0.6, -700, 3.0], [0x5a7ac8, -0.5, -0.6, -700, 3.0],
    [0xf0b08a, 0.3, 0.2, -320, 1.1], [0x9a8af0, -0.25, -0.3, -320, 1.2], [0x8ad8c8, 0.05, -0.55, -320, 1.0], [0xf0a0c0, -0.55, 0.45, -320, 1.0]].forEach(([c, x, y, z, k]) => {
    const s = glowSprite(c, worldR * k, z < -500 ? 0.8 : 0.55);
    s.position.set(x * worldR * 1.6, y * worldR * 1.6, z);
    scene.add(s);
  });

  // ---------- 枝條：一條條會流光的緞帶，打開時從爸爸那端長出來 ----------
  const edgeMat = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 } },
    vertexShader: /* glsl */ `attribute float along; attribute float side; attribute vec3 color; attribute float born; attribute float lit;
      varying float vAlong; varying float vSide; varying vec3 vColor; varying float vBorn; varying float vLit;
      void main() { vAlong = along; vSide = side; vColor = color; vBorn = born; vLit = lit; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `uniform float time; varying float vAlong; varying float vSide; varying vec3 vColor; varying float vBorn; varying float vLit;
      void main() {
        float grow = vLit > 0.5 ? clamp((time - vBorn) / 0.9, 0.0, 1.0) : 0.0;
        float core = exp(-vSide * vSide * 3.0);
        vec3 c = vColor; float a;
        if (vAlong <= grow) {
          float flow = 0.5 + 0.5 * sin(vAlong * 38.0 - time * 3.2);
          a = core * (0.75 + 0.5 * flow);
          c = mix(vColor, vec3(1.0), core * 0.4);
        } else {
          a = core * 0.32 * step(0.45, fract(vAlong * 12.0 - time * 0.6));
        }
        float tip = (vLit > 0.5 && grow < 1.0) ? exp(-pow((vAlong - grow) * 16.0, 2.0)) : 0.0;
        gl_FragColor = vec4(c * a + vec3(1.0, 0.93, 0.78) * tip, a + tip);
      }`,
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  const edgeMesh = new THREE.Mesh(new THREE.BufferGeometry(), edgeMat);
  edgeMesh.frustumCulled = false;
  edgeMesh.renderOrder = 1;
  scene.add(edgeMesh);

  // ---------- 節點光暈：打開的亮、還在雲裡的會呼吸 ----------
  const haloMat = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, scale: { value: 900 } },
    vertexShader: /* glsl */ `attribute vec3 color; attribute float size; attribute float lit; attribute float phase;
      uniform float time; uniform float scale; varying vec3 vColor; varying float vA;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        float breathe = 0.6 + 0.4 * sin(time * 2.2 + phase);
        gl_PointSize = size * scale / -mv.z * (lit > 0.5 ? 1.0 : 0.8 + 0.25 * breathe);
        vColor = color; vA = lit > 0.5 ? 0.85 : 0.45 * breathe;
      }`,
    fragmentShader: /* glsl */ `varying vec3 vColor; varying float vA;
      void main() { float d = length(gl_PointCoord - 0.5); float a = (1.0 - smoothstep(0.0, 0.5, d)); a *= a; gl_FragColor = vec4(vColor * a * vA * 1.4, a * vA); }`,
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
  });
  const halos = new THREE.Points(new THREE.BufferGeometry(), haloMat);
  halos.frustumCulled = false;
  halos.renderOrder = 2;
  scene.add(halos);

  // ---------- 打開的地方變成彩色的「大陸」：每個大主題一種顏色，上面有等高線，像一張藏寶圖 ----------
  const TINT = 256;
  const tintCanvas = document.createElement('canvas');
  tintCanvas.width = tintCanvas.height = TINT;
  const tg = tintCanvas.getContext('2d');
  tg.fillStyle = '#000'; tg.fillRect(0, 0, TINT, TINT);
  const tintTex = new THREE.CanvasTexture(tintCanvas);
  tintTex.minFilter = THREE.LinearFilter;
  tintTex.colorSpace = THREE.SRGBColorSpace;

  // ---------- 霧：雲朵雜訊＋打開的地方（遮罩）；打開的邊緣有一圈金光 ----------
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = maskCanvas.height = MASK;
  const mg = maskCanvas.getContext('2d');
  mg.fillStyle = '#000'; mg.fillRect(0, 0, MASK, MASK);
  const maskTex = new THREE.CanvasTexture(maskCanvas);
  maskTex.minFilter = THREE.LinearFilter;
  const noise = noiseTexture();
  const fogMat = new THREE.ShaderMaterial({
    uniforms: { mask: { value: maskTex }, noise: { value: noise }, time: { value: 0 }, worldR: { value: worldR }, far: { value: 0 } },
    vertexShader: /* glsl */ `varying vec2 vW; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xy; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `uniform sampler2D mask; uniform sampler2D noise; uniform float time; uniform float worldR; uniform float far; varying vec2 vW;
      void main() {
        vec2 muv = vW / (2.0 * worldR) + 0.5;
        float inside = step(0.0, muv.x) * step(muv.x, 1.0) * step(0.0, muv.y) * step(muv.y, 1.0);
        float m = texture2D(mask, clamp(muv, 0.0, 1.0)).r * inside;
        float n1 = texture2D(noise, vW * 0.0016 + vec2(time * 0.004, time * 0.0025)).r;
        float n2 = texture2D(noise, vW * 0.0043 + vec2(-time * 0.007, time * 0.004)).r;
        float n = n1 * 0.65 + mix(n2, 0.5, far) * 0.45; // 拉很遠的時候細雲淡掉，不會花花的
        float clear = smoothstep(0.25, 0.85, m + (n - 0.5) * 0.45);
        float fogA = (1.0 - clear) * (0.88 + 0.12 * n);
        float rim = smoothstep(0.02, 0.4, clear) * (1.0 - smoothstep(0.4, 0.95, clear));
        vec3 col = mix(vec3(0.07, 0.08, 0.18), vec3(0.27, 0.24, 0.43), smoothstep(0.25, 0.85, n));
        col = mix(col, vec3(0.46, 0.38, 0.6), smoothstep(0.7, 1.0, n) * 0.55);
        col += vec3(1.0, 0.8, 0.52) * rim * 0.5;
        gl_FragColor = vec4(col, clamp(fogA + rim * 0.3, 0.0, 1.0));
      }`,
    transparent: true, depthWrite: false, depthTest: false,
  });
  const groundMat = new THREE.ShaderMaterial({
    uniforms: { tint: { value: tintTex }, noise: { value: noise }, time: { value: 0 }, worldR: { value: worldR } },
    vertexShader: fogMat.vertexShader,
    fragmentShader: /* glsl */ `uniform sampler2D tint; uniform sampler2D noise; uniform float time; uniform float worldR; varying vec2 vW;
      void main() {
        vec2 muv = clamp(vW / (2.0 * worldR) + 0.5, 0.0, 1.0);
        vec3 t = texture2D(tint, muv).rgb;
        float n = texture2D(noise, vW * 0.0021).r * 0.7 + texture2D(noise, vW * 0.0057).r * 0.4;
        float c = abs(fract(n * 6.0 - time * 0.03) - 0.5);
        float line = 1.0 - smoothstep(0.02, 0.07, c);
        float land = 0.28 + 0.4 * smoothstep(0.35, 0.95, n);
        gl_FragColor = vec4(t * (land + line * 0.55), 1.0);
      }`,
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(worldR * 2, worldR * 2), groundMat);
  ground.renderOrder = 0;
  scene.add(ground);
  const fog = new THREE.Mesh(new THREE.PlaneGeometry(worldR * 8, worldR * 8), fogMat);
  fog.position.z = 2;
  fog.renderOrder = 5;
  scene.add(fog);
  const wispMat = new THREE.ShaderMaterial({
    uniforms: { mask: { value: maskTex }, noise: { value: noise }, time: { value: 0 }, worldR: { value: worldR } },
    vertexShader: fogMat.vertexShader,
    fragmentShader: /* glsl */ `uniform sampler2D mask; uniform sampler2D noise; uniform float time; uniform float worldR; varying vec2 vW;
      void main() {
        vec2 muv = clamp(vW / (2.0 * worldR) + 0.5, 0.0, 1.0);
        float m = texture2D(mask, muv).r;
        float n = texture2D(noise, vW * 0.0011 + vec2(-time * 0.009, time * 0.005)).r;
        float k = texture2D(noise, vW * 0.0031 + vec2(time * 0.01, -time * 0.006)).r;
        float w = smoothstep(0.55, 0.9, n * 0.7 + k * 0.5);
        float a = w * 0.45 * (0.35 + 0.65 * (1.0 - m));
        vec3 col = mix(vec3(0.62, 0.56, 0.86), vec3(0.95, 0.82, 0.92), k);
        gl_FragColor = vec4(col, a);
      }`,
    transparent: true, depthWrite: false, depthTest: false,
  });
  const wisp = new THREE.Mesh(new THREE.PlaneGeometry(worldR * 10, worldR * 10), wispMat);
  wisp.position.z = 60;
  wisp.renderOrder = 8;
  scene.add(wisp);

  // 雲裡一閃一閃的小光點（打開的地方就沒有）
  const r1 = rng(0.12);
  const dust = makePoints(coarse ? 900 : 1800, (i, c) => {
    c.setHSL(0.1 + r1() * 0.6, 0.5, 0.8);
    const a = r1() * TAU, d = Math.sqrt(r1()) * worldR * 1.25;
    return { pos: [Math.cos(a) * d, Math.sin(a) * d, 3], size: 1.6 + r1() * 2.6 };
  }, { scale: 900, gain: 0.9 });
  dust.material.onBeforeCompile = (sh) => {
    sh.uniforms.mask = { value: maskTex }; sh.uniforms.worldR = { value: worldR };
    sh.vertexShader = 'uniform sampler2D mask; uniform float worldR;\n' + sh.vertexShader.replace('vColor = color;',
      'vColor = color * (1.0 - texture2D(mask, clamp(position.xy / (2.0 * worldR) + 0.5, 0.0, 1.0)).r);');
  };
  dust.renderOrder = 6;
  scene.add(dust);

  // 開圖的星星煙火：往四面八方散開，再加一圈擴散的光環（都在地圖平面上）
  const live = [];
  function sparkle(x, y, colors) {
    const count = 70, vel = [];
    const pts = makePoints(count, (i, c) => {
      const a = Math.random() * TAU, v = 20 + Math.random() * 70;
      vel.push(Math.cos(a) * v, Math.sin(a) * v);
      c.set(colors[i % colors.length]);
      return { pos: [x, y, 4], size: 4 + Math.random() * 6 };
    }, { scale: 900, gain: 1.2 });
    pts.frustumCulled = false; pts.renderOrder = 7;
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 72), new THREE.MeshBasicMaterial({ color: colors[0], transparent: true, opacity: 0.8, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending }));
    ring.position.set(x, y, 4); ring.renderOrder = 7;
    scene.add(pts, ring);
    let t = 0;
    live.push((dt) => {
      t += dt;
      const p = pts.geometry.attributes.position;
      for (let i = 0; i < count; i++) { p.array[i * 3] += vel[i * 2] * dt * (1 - t * 0.7); p.array[i * 3 + 1] += vel[i * 2 + 1] * dt * (1 - t * 0.7); }
      p.needsUpdate = true;
      pts.material.uniforms.gain.value = 1.2 * Math.max(0, 1 - t / 1.2);
      pts.material.uniforms.time.value = t * 6;
      ring.scale.setScalar(8 + t * 110);
      ring.material.opacity = 0.8 * Math.max(0, 1 - t / 0.9);
      if (t < 1.2) return true;
      scene.remove(pts, ring); pts.geometry.dispose(); pts.material.dispose(); ring.geometry.dispose(); ring.material.dispose();
      return false;
    });
  }

  // ---------- 開圖：在遮罩上畫一個慢慢變大的圓 ----------
  const opening = [];
  function drawHole(x, y, r, tint) {
    const cx = (x / (2 * worldR) + 0.5) * MASK, cy = (0.5 - y / (2 * worldR)) * MASK, rr = (r / (2 * worldR)) * MASK;
    const g = mg.createRadialGradient(cx, cy, 0, cx, cy, rr);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.55, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    mg.globalCompositeOperation = 'lighten';
    mg.fillStyle = g;
    mg.beginPath(); mg.arc(cx, cy, rr, 0, TAU); mg.fill();
    if (tint) {
      const k = TINT / MASK, tc = tg.createRadialGradient(cx * k, cy * k, 0, cx * k, cy * k, rr * k * 1.1);
      tc.addColorStop(0, tint); tc.addColorStop(1, 'rgba(0,0,0,0)');
      tg.globalCompositeOperation = 'lighten';
      tg.fillStyle = tc;
      tg.beginPath(); tg.arc(cx * k, cy * k, rr * k * 1.1, 0, TAU); tg.fill();
      tintTex.needsUpdate = true;
    }
    mg.globalCompositeOperation = 'source-over';
    maskTex.needsUpdate = true;
  }

  function unitsPerPx() { return (2 * view.dist * Math.tan((camera.fov * Math.PI) / 360)) / Math.max(1, canvas.clientHeight); }
  function aim() {
    camera.up.set(-Math.sin(view.rot), Math.cos(view.rot), 0);
    camera.position.set(view.x, view.y, view.dist);
    camera.lookAt(view.x, view.y, 0);
  }

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
    const raw = (now - last) / 1000;
    const dt = Math.min(0.05, raw);
    const rdt = Math.min(0.25, raw); // 鏡頭和開圖用真的經過時間：比較慢的裝置也會準時飛到
    last = now;
    time += dt;
    if (!perf.done && !document.querySelector('dialog[open]')) {
      perf.sum += raw; perf.n += 1;
      if (perf.n >= 90) { if (perf.sum / perf.n > 1 / 30 && pixelRatio > 1) { pixelRatio = 1; resize(); } perf.done = true; }
    }
    try {
      onFrame(rdt, time);
      for (let i = opening.length - 1; i >= 0; i--) {
        const o = opening[i];
        o.t = Math.min(1, o.t + rdt / o.dur);
        drawHole(o.x, o.y, o.r * (1 - Math.pow(1 - o.t, 3)), o.tint);
        if (o.t >= 1) opening.splice(i, 1);
      }
      aim();
      fogMat.uniforms.far.value = Math.min(1, Math.max(0, (unitsPerPx() - 1.6) / 2.5));
      [groundMat, edgeMat, haloMat, fogMat, wispMat, stars.material, dust.material].forEach((m) => { if (m.uniforms?.time) m.uniforms.time.value = time; });
      for (let i = live.length - 1; i >= 0; i--) if (!live[i](dt)) live.splice(i, 1);
      renderer.render(scene, camera);
    } catch (err) { if (String(err) !== lastErr) { lastErr = String(err); console.error('宇宙地圖出錯', err); } }
  }
  requestAnimationFrame(frame);

  const v3 = new THREE.Vector3();
  return {
    view,
    maskCanvas,
    get time() { return time; },
    unitsPerPx,
    distForHeight: (units) => units / (2 * Math.tan((camera.fov * Math.PI) / 360)),
    project(x, y) {
      aim(); camera.updateMatrixWorld();
      v3.set(x, y, 0).project(camera);
      return { x: ((v3.x + 1) / 2) * canvas.clientWidth, y: ((1 - v3.y) / 2) * canvas.clientHeight };
    },
    /** 一次換掉所有枝條與光暈（打開新地方時呼叫）。 */
    setGraph({ nodes, edges }) {
      // 枝條緞帶
      const N = 22, pos = [], along = [], side = [], color = [], born = [], lit = [], index = [];
      edges.forEach((e) => {
        const base = pos.length / 3;
        for (let i = 0; i <= N; i++) {
          const t = i / N, u = 1 - t;
          const px = u * u * e.ax + 2 * u * t * e.cx + t * t * e.bx, py = u * u * e.ay + 2 * u * t * e.cy + t * t * e.by;
          const dx = 2 * u * (e.cx - e.ax) + 2 * t * (e.bx - e.cx), dy = 2 * u * (e.cy - e.ay) + 2 * t * (e.by - e.cy);
          const len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
          const w = (e.w0 + (e.w1 - e.w0) * t) / 2;
          [-1, 1].forEach((s) => {
            pos.push(px + nx * w * s, py + ny * w * s, 0.5);
            along.push(t); side.push(s);
            color.push(e.color.r, e.color.g, e.color.b); born.push(e.born); lit.push(e.lit ? 1 : 0);
          });
          if (i < N) { const k = base + i * 2; index.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
        }
      });
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('along', new THREE.Float32BufferAttribute(along, 1));
      g.setAttribute('side', new THREE.Float32BufferAttribute(side, 1));
      g.setAttribute('color', new THREE.Float32BufferAttribute(color, 3));
      g.setAttribute('born', new THREE.Float32BufferAttribute(born, 1));
      g.setAttribute('lit', new THREE.Float32BufferAttribute(lit, 1));
      g.setIndex(index);
      edgeMesh.geometry.dispose();
      edgeMesh.geometry = g;
      // 光暈
      const hp = [], hc = [], hs = [], hl = [], hph = [];
      nodes.forEach((n, i) => { hp.push(n.x, n.y, 1); hc.push(n.color.r, n.color.g, n.color.b); hs.push(n.halo); hl.push(n.lit ? 1 : 0); hph.push(i * 1.7); });
      const hg = new THREE.BufferGeometry();
      hg.setAttribute('position', new THREE.Float32BufferAttribute(hp, 3));
      hg.setAttribute('color', new THREE.Float32BufferAttribute(hc, 3));
      hg.setAttribute('size', new THREE.Float32BufferAttribute(hs, 1));
      hg.setAttribute('lit', new THREE.Float32BufferAttribute(hl, 1));
      hg.setAttribute('phase', new THREE.Float32BufferAttribute(hph, 1));
      halos.geometry.dispose();
      halos.geometry = hg;
    },
    /** 把一塊雲打開（dur 秒內慢慢散開；0 就是馬上）。 */
    reveal(x, y, r, dur = 0.9, tint = null) {
      if (dur <= 0) drawHole(x, y, r, tint);
      else opening.push({ x, y, r, t: 0, dur, tint });
    },
    resetFog() {
      opening.length = 0;
      mg.fillStyle = '#000'; mg.fillRect(0, 0, MASK, MASK); maskTex.needsUpdate = true;
      tg.globalCompositeOperation = 'source-over'; tg.fillStyle = '#000'; tg.fillRect(0, 0, TINT, TINT); tintTex.needsUpdate = true;
    },
    burst: sparkle,
  };
}
