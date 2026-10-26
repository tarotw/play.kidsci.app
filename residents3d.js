// 宇宙群島的小公仔：共用貼圖集、立體部位與材質。
import * as THREE from 'three';
import { TAU, EMOJI_FONT } from './kit3d.js';

// ---------- 居民（每一集一個會走路的小人：頭是它的圖示，下面有兩隻小腳） ----------
export function makeAtlas(icons, specials) {
  const T = 144, cols = Math.ceil(Math.sqrt(icons.length)), rows = Math.ceil(icons.length / cols);
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

// 居民是柔和的立體公仔：圓潤頭殼印上每集圖示，配上領巾、小手和雙層鞋。
// 頭上的徽章說能不能聽，腳下的光圈也是：
// 綠色 ▶ ＝ 現在就可以聽；金色皇冠 ＝ VIP（請大人幫忙）；灰灰的在睡覺 💤 ＝ 還在準備中
// 尺寸（以居民大小 S 為單位）：腳 0～0.16，身體 0.04～0.68，頭 0.59～1.39，徽章再上面
export const BODY = { headCenter: 0.99, top: 1.85 };
export function makeResidents(scene, list, atlas, { reduceMotion = false } = {}) {
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
  const uniforms = { motion: { value: reduceMotion ? 0 : 1 }, time: { value: 0 }, map: { value: atlas.tex }, grid: { value: new THREE.Vector2(atlas.cols, atlas.rows) }, checkTile: { value: atlas.index.get('check') } };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `attribute vec3 iPos; attribute vec4 iA; attribute vec4 iB; attribute vec2 iC; uniform float time;
      varying vec2 vQ; varying vec4 vA; varying vec4 vB; varying vec2 vC;
      void main() {
        float S = iB.w;
        vec3 right = normalize(vec3(viewMatrix[0][0], 0.0, viewMatrix[2][0]));
        vec3 back = normalize(vec3(viewMatrix[0][2], 0.0, viewMatrix[2][2]));
        // Keep badges in front, with a small per-resident depth offset.
        vec3 p = iPos + right * position.x * S * 1.3 + vec3(0.0, position.y * ${BODY.top.toFixed(2)} * S + iA.z, 0.0) + back * (S * 0.26 + iA.w * 0.03);
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
        vQ = vec2(position.x * 1.3, position.y * ${BODY.top.toFixed(2)});
        vA = iA; vB = iB; vC = iC;
      }`,
    fragmentShader: /* glsl */ `uniform sampler2D map; uniform vec2 grid; uniform float time; uniform float motion; uniform float checkTile;
      varying vec2 vQ; varying vec4 vA; varying vec4 vB; varying vec2 vC;
      vec4 tile(float idx, vec2 uv) {
        if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return vec4(0.0);
        // Round interpolated tile indices to avoid sampling an adjacent cell.
        float id = floor(idx + 0.5);
        float row = floor((id + 0.5) / grid.x);
        vec2 cell = vec2(id - row * grid.x, row);
        return texture2D(map, vec2((cell.x + uv.x) / grid.x, 1.0 - (cell.y + 1.0 - uv.y) / grid.y));
      }
      vec4 over(vec4 top, vec4 base) { float a = top.a + base.a * (1.0 - top.a); return vec4((top.rgb * top.a + base.rgb * base.a * (1.0 - top.a)) / max(a, 0.0001), a); }
      void main() {
        vec4 col = vec4(0.0);
        float sleep = vC.x;
        float bob = sin(time * 2.0 + vA.w) * 0.03 * motion;
        // Listening status above the head.
        if (vC.y > 0.5 && vA.y >= 0.0) {
          // Crown (VIP) or zzz (unreleased).
          vec2 o = (vQ - vec2(sleep > 0.5 ? 0.32 : 0.0, 1.38 + bob)) / 0.46 + vec2(0.5, 0.0);
          col = over(tile(vA.y, o), col);
        }
        // Visited: green check at the upper left.
        if (vB.y > 0.5) col = over(tile(checkTile, (vQ - vec2(-0.4, 1.27)) / 0.3 + vec2(0.5, 0.0)), col);
        if (col.a < 0.5) discard;
        gl_FragColor = vec4(col.rgb, 1.0);
      }`,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(quad, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;
  scene.add(mesh);
  // 所有部位共用幾何、材質與 instancing；每多一位居民不增加 draw call。
  const sphere = new THREE.SphereGeometry(1, 12, 8);
  const vinyl = (color = 0xffffff) => new THREE.MeshStandardMaterial({ color, roughness: 0.38, metalness: 0.03 });
  const parts = {};
  const part = (name, geometry, material, count = n) => {
    const m = new THREE.InstancedMesh(geometry, material, count);
    m.name = `residents-${name}`;
    m.frustumCulled = false;
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    parts[name] = m;
    scene.add(m);
    return m;
  };
  const body = part('body', new THREE.CapsuleGeometry(0.215, 0.21, 6, 16), vinyl());
  const belly = part('belly', sphere, vinyl(0xfff5df));
  const collar = part('collar', new THREE.TorusGeometry(0.17, 0.047, 8, 20).rotateX(Math.PI / 2), vinyl());
  const scarf = part('scarf', new THREE.ConeGeometry(0.095, 0.18, 3).rotateZ(Math.PI), vinyl());
  const arms = part('arms', new THREE.CapsuleGeometry(0.071, 0.13, 4, 10), vinyl(), n * 2);
  const hands = part('hands', sphere, vinyl(0xfff5df), n * 2);
  const feet = part('feet', sphere, vinyl(), n * 2);
  const soles = part('soles', sphere, vinyl(0xfff5df), n * 2);

  // 播放徽章用真正的立體曲面，邊緣由 WebGL MSAA 平滑取樣。
  // 奶油色外殼、薄荷色鼓面，白色三角形的三個角也都有圓角與斜面。
  const badgeSphere = new THREE.SphereGeometry(1, 40, 20);
  const playShell = part('playShell', badgeSphere, vinyl(0xfff7e8));
  const playFace = part('playFace', badgeSphere, vinyl(0x42c798));
  const triangle = new THREE.Shape();
  triangle.moveTo(-0.045, -0.055);
  triangle.lineTo(-0.045, 0.055);
  triangle.quadraticCurveTo(-0.045, 0.08, -0.024, 0.067);
  triangle.lineTo(0.07, 0.013);
  triangle.quadraticCurveTo(0.09, 0, 0.07, -0.013);
  triangle.lineTo(-0.024, -0.067);
  triangle.quadraticCurveTo(-0.045, -0.08, -0.045, -0.055);
  const playGlyph = part('playGlyph', new THREE.ExtrudeGeometry(triangle, {
    depth: 0.014, steps: 1, curveSegments: 8,
    bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.006, bevelSegments: 4,
  }), vinyl(0xfffdf4));
  [playShell, playFace, playGlyph].forEach((m) => { m.userData.publicOnly = true; });

  // 圖示印在真正的圓潤 3D 頭上，與身體一起接受場景光照。
  // 在標準材質內合成貼圖，保留 Three.js 的色彩轉換、霧與色調映射。
  const headGeo = new THREE.SphereGeometry(1, 24, 16);
  const headA = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4).setUsage(THREE.DynamicDrawUsage);
  const headB = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4).setUsage(THREE.DynamicDrawUsage);
  headGeo.setAttribute('iA', headA); headGeo.setAttribute('iB', headB);
  const headMat = vinyl();
  headMat.onBeforeCompile = (shader) => {
    shader.uniforms.residentMap = uniforms.map;
    shader.uniforms.residentGrid = uniforms.grid;
    shader.vertexShader = `attribute vec4 iA; attribute vec4 iB;
      varying vec3 vHeadPoint; varying vec3 vHeadMark;\n` + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vHeadPoint = position;
      vHeadMark = vec3(iA.x, iB.x, iB.z);`);
    shader.fragmentShader = `uniform sampler2D residentMap; uniform vec2 residentGrid;
      varying vec3 vHeadPoint; varying vec3 vHeadMark;\n` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      vec2 faceUv = vec2(vHeadPoint.x * vHeadMark.y, vHeadPoint.y) / 2.05 + 0.5;
      float id = floor(vHeadMark.x + 0.5);
      float row = floor(id / residentGrid.x);
      vec2 cell = vec2(id - row * residentGrid.x, row);
      vec2 atlasUv = vec2((cell.x + clamp(faceUv.x, 0.01, 0.99)) / residentGrid.x,
        1.0 - (cell.y + 1.0 - clamp(faceUv.y, 0.01, 0.99)) / residentGrid.y);
      vec4 ink = texture2D(residentMap, atlasUv);
      float front = smoothstep(0.28, 0.52, vHeadPoint.z);
      diffuseColor.rgb = mix(diffuseColor.rgb, ink.rgb, ink.a * front);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0), vHeadMark.z * 0.12);`);
  };
  const heads = part('heads', headGeo, headMat);
  const grey = new THREE.Color(0xb8bccc), cream = new THREE.Color(0xfff5e7);
  const accent = new THREE.Color();
  list.forEach((p, i) => {
    const c = (atlas.colors.get(p.e.icon) || grey).clone().lerp(cream, 0.22);
    if (p.e.state === 'unreleased') c.lerp(grey, 0.6);
    // 同色系的衣服、頭殼、鞋子；領巾用溫暖的互補色。
    body.setColorAt(i, c);
    heads.setColorAt(i, c.clone().lerp(cream, 0.78));
    accent.set(p.e.state === 'subscriber' ? 0xf2b84e : 0x63cbb7);
    collar.setColorAt(i, accent); scarf.setColorAt(i, accent);
    for (let k = 0; k < 2; k++) {
      arms.setColorAt(i * 2 + k, c);
      feet.setColorAt(i * 2 + k, c.clone().multiplyScalar(0.48));
    }
  });
  // 腳下：影子＋光圈（綠色＝可以聽、金色＝VIP，還在準備中的只有影子）
  const sq = new THREE.InstancedBufferGeometry();
  sq.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, -0.5, 0.5, 0, -0.5, 0.5, 0, 0.5, -0.5, 0, 0.5], 3));
  sq.setIndex([0, 2, 1, 0, 3, 2]);
  sq.setAttribute('iPos', iPos); sq.setAttribute('iB', iB); sq.setAttribute('iC', iC); sq.setAttribute('iA', iA);
  sq.instanceCount = n;
  const shadow = new THREE.Mesh(sq, new THREE.ShaderMaterial({
    uniforms: { time: uniforms.time, motion: uniforms.motion },
    vertexShader: /* glsl */ `attribute vec3 iPos; attribute vec4 iB; attribute vec2 iC; attribute vec4 iA; varying vec2 vP; varying vec2 vC; varying float vPh;
      void main() { vP = position.xz * 2.0; vC = iC; vPh = iA.w; vec3 p = iPos + vec3(position.x * iB.w * 1.3, 0.12, position.z * iB.w * 1.3); gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0); }`,
    fragmentShader: /* glsl */ `uniform float time; uniform float motion; varying vec2 vP; varying vec2 vC; varying float vPh;
      void main() {
        float d = length(vP);
        vec4 c = vec4(0.25, 0.2, 0.4, 0.36 * (1.0 - smoothstep(0.05, 0.68, d)));
        if (vC.y < 1.5) {
          vec3 rc = vC.y < 0.5 ? vec3(0.25, 0.85, 0.5) : vec3(1.0, 0.78, 0.25);
          float pulse = vC.y < 0.5 ? 0.75 + 0.25 * sin(time * 3.0 + vPh) * motion : 0.8;
          float ring = (1.0 - smoothstep(0.025, 0.065, abs(d - 0.8))) * pulse;
          c = vec4(mix(c.rgb, rc, ring), max(c.a, ring * 0.65));
        }
        if (c.a < 0.01) discard;
        gl_FragColor = c;
      }`,
    transparent: true, depthWrite: false,
  }));
  shadow.frustumCulled = false;
  scene.add(shadow);
  // 遠島居民的立體部位先不繪製；保留原始顏色，靠近後再壓進同一批 instances。
  const slots = new Int32Array(n).fill(-1), playSlots = new Int32Array(n).fill(-1);
  const baseColors = new Map(Object.values(parts).filter((m) => m.instanceColor)
    .map((m) => [m, m.instanceColor.array.slice()]));
  let visible = [];
  function setVisible(indices) {
    if (visible.length === indices.length && visible.every((v, i) => v === indices[i])) return;
    visible = indices.slice();
    slots.fill(-1); playSlots.fill(-1);
    let playCount = 0;
    visible.forEach((id, slot) => {
      slots[id] = slot;
      if (list[id].e.state === 'public') playSlots[id] = playCount++;
    });
    Object.entries(parts).forEach(([name, m]) => {
      const pair = ['arms', 'hands', 'feet', 'soles'].includes(name) ? 2 : 1;
      m.count = m.userData.publicOnly ? playCount : visible.length * pair;
      const source = baseColors.get(m);
      if (!source) return;
      visible.forEach((id, slot) => {
        for (let k = 0; k < pair; k++) {
          const from = (id * pair + k) * 3, to = (slot * pair + k) * 3;
          m.instanceColor.array.set(source.subarray(from, from + 3), to);
        }
      });
      m.instanceColor.needsUpdate = true;
    });
  }
  // 初始化時也處理完全沒有居民的母島「好好聽島」。
  Object.values(parts).forEach((m) => { m.count = 0; });
  return { mesh, parts, body, feet, headA, headB, slots, playSlots, setVisible, iPos, iA, iB, iC, uniforms };
}
