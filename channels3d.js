// 宇宙好好聽：一格裡所有頻道合成幾批一次畫完。
// 原本每台頻道是 4～6 個物件（徽章、背光、光柱、光圈、金色軌道），120 台就要畫 600 次；
// 現在徽章畫在同一張圖集上，光柱、光圈、軌道各用一個 InstancedMesh，整格只要畫 5 次。
import * as THREE from 'three';
import { drawBadge } from './kit3d.js';

const TILE = 128; // 圖集裡每台頻道的格子
const BADGE = 96; // 徽章本體的直徑（其餘留給柔光）
const QUAD = TILE / BADGE;
const COLORS = { public: new THREE.Color(0x9fdccb), subscriber: new THREE.Color(0xf0c878), seen: new THREE.Color(0xbfe6a8) };
const GLOW = { public: '159,220,203', subscriber: '240,200,120', seen: '191,230,168' };
const kindOf = (s) => (s.marks ? 'seen' : s.e.state === 'subscriber' ? 'subscriber' : 'public');

// 每一格共用的幾何與材質，第一次用到才建立，永遠不丟
let shared = null;
function sharedParts() {
  if (shared) return shared;
  const quad = new THREE.PlaneGeometry(1, 1);
  const beamGeo = new THREE.CylinderGeometry(1, 1, 1, 16, 1, true);
  beamGeo.translate(0, 0.5, 0);
  const haloGeo = new THREE.RingGeometry(0.75, 1, 48);
  haloGeo.rotateX(-Math.PI / 2);
  const beamMat = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 } },
    vertexShader: /* glsl */ `varying vec2 vUv; varying vec3 vColor;
      void main() {
        vUv = uv; vColor = vec3(1.0);
        #ifdef USE_INSTANCING_COLOR
          vColor = instanceColor;
        #endif
        vec4 p = vec4(position, 1.0);
        #ifdef USE_INSTANCING
          p = instanceMatrix * p;
        #endif
        gl_Position = projectionMatrix * modelViewMatrix * p;
      }`,
    fragmentShader: /* glsl */ `uniform float time; varying vec2 vUv; varying vec3 vColor;
      void main() {
        float a = pow(1.0 - vUv.y, 1.6) * (0.7 + 0.3 * sin(vUv.y * 26.0 - time * 4.0)) * 0.2;
        gl_FragColor = vec4(vColor * a * 1.6, a);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  const haloMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const honey = new THREE.MeshStandardMaterial({ color: 0xf3d08a, emissive: 0xf3d08a, emissiveIntensity: 0.35, roughness: 0.4 });
  shared = {
    quad, beamGeo, haloGeo, beamMat, haloMat, honey,
    orbitGeo: new THREE.TorusGeometry(1, 0.045, 6, 64),
    sparkGeo: new THREE.OctahedronGeometry(0.22),
  };
  return shared;
}

/**
 * spots：[{ e, icon, holder, local, size, topY, phase, marks }]。
 * 每台頻道的世界座標會寫回 spot.world，給飛行、選取用。
 */
export function createChannelField(spots) {
  const P = sharedParts();
  const n = spots.length;
  const cells = Math.max(1, Math.ceil(Math.sqrt(n)));
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = cells * TILE;
  const g = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;

  function drawTile(i) {
    const s = spots[i];
    const x = (i % cells) * TILE, y = Math.floor(i / cells) * TILE;
    g.clearRect(x, y, TILE, TILE);
    if (s.e.state !== 'unreleased') {
      const rgb = GLOW[kindOf(s)];
      const glow = g.createRadialGradient(x + TILE / 2, y + TILE / 2, BADGE * 0.42, x + TILE / 2, y + TILE / 2, TILE / 2 - 1);
      glow.addColorStop(0, `rgba(${rgb},0.4)`); glow.addColorStop(1, `rgba(${rgb},0)`);
      g.fillStyle = glow; g.fillRect(x, y, TILE, TILE);
    }
    const k = BADGE / 160;
    g.save();
    g.translate(x + TILE / 2 - 96 * k, y + TILE / 2 - 96 * k);
    g.scale(k, k);
    drawBadge(g, s.icon, s.e.state, s.marks);
    g.restore();
  }
  spots.forEach((s, i) => { s.tile = i; s.world = new THREE.Vector3(); s.eff = s.size; s.rpx = 0; s.pop = 0; drawTile(i); });

  // 徽章：一張四邊形、每台頻道一份「中心點 + 圖集位置 + 大小 + 透明度」
  const geo = new THREE.InstancedBufferGeometry();
  geo.setIndex(P.quad.index.clone());
  geo.setAttribute('position', P.quad.attributes.position.clone());
  geo.setAttribute('uv', P.quad.attributes.uv.clone());
  const centers = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage);
  const tiles = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4).setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('center', centers);
  geo.setAttribute('tile', tiles);
  geo.instanceCount = n;
  const badgeMat = new THREE.ShaderMaterial({
    uniforms: { map: { value: texture }, cells: { value: cells } },
    vertexShader: /* glsl */ `attribute vec3 center; attribute vec4 tile; uniform float cells; varying vec2 vUv; varying float vA;
      void main() {
        vec4 mv = modelViewMatrix * vec4(center, 1.0);
        mv.xy += position.xy * tile.z;
        gl_Position = projectionMatrix * mv;
        vUv = vec2((tile.x + uv.x) / cells, 1.0 - (tile.y + 1.0 - uv.y) / cells);
        vA = tile.w;
      }`,
    fragmentShader: /* glsl */ `uniform sampler2D map; varying vec2 vUv; varying float vA;
      void main() { vec4 c = texture2D(map, vUv); float a = c.a * vA; if (a < 0.01) discard; gl_FragColor = vec4(c.rgb, a); }`,
    transparent: true, depthWrite: false,
  });
  const badges = new THREE.Mesh(geo, badgeMat);
  badges.frustumCulled = false;
  badges.renderOrder = 3; // 畫在平台、光柱之後

  // 光柱與底座光圈（還沒上架的沒有）、訂閱者的金色軌道
  const lit = spots.filter((s) => s.e.state !== 'unreleased');
  const gold = spots.filter((s) => s.e.state === 'subscriber');
  const beams = new THREE.InstancedMesh(P.beamGeo, P.beamMat, Math.max(1, lit.length));
  const halos = new THREE.InstancedMesh(P.haloGeo, P.haloMat, Math.max(1, lit.length));
  const orbits = new THREE.InstancedMesh(P.orbitGeo, P.honey, Math.max(1, gold.length));
  const sparks = new THREE.InstancedMesh(P.sparkGeo, P.honey, Math.max(1, gold.length));
  beams.count = halos.count = lit.length;
  orbits.count = sparks.count = gold.length;
  lit.forEach((s, j) => { s.beam = j; beams.setColorAt(j, COLORS[kindOf(s)]); halos.setColorAt(j, COLORS[kindOf(s)]); });
  if (!lit.length) { beams.setColorAt(0, COLORS.public); halos.setColorAt(0, COLORS.public); }
  gold.forEach((s, j) => { s.orbit = j; });

  const group = new THREE.Group();
  [badges, beams, halos, orbits, sparks].forEach((m) => { m.frustumCulled = false; m.userData.shared = true; group.add(m); });

  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e3 = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3(), off = new THREE.Matrix4();
  const order = spots.map((_, i) => i);
  const depth = new Float32Array(n);

  return {
    group,
    texture,
    /** 每一格更新位置、大小，並由遠到近排好徽章（透明的東西要從後面畫起）。 */
    update(time, camera, { hover, pxk, minPx, reduceMotion, dt }) {
      spots.forEach((s, i) => {
        const bob = reduceMotion ? 0 : Math.sin(time * 1.6 + s.phase) * 0.5;
        s.pop = Math.max(0, s.pop - dt * 2.5);
        const h = s.holder.position;
        s.world.set(h.x + s.local.x, h.y + s.local.y + bob, h.z + s.local.z);
        const dist = camera.position.distanceTo(s.world);
        depth[i] = dist;
        const base = Math.max(s.size, (s.e.state === 'unreleased' ? 22 : minPx) * pxk * dist);
        s.eff = base * ((s === hover ? 1.25 : 1) + Math.sin(s.pop * Math.PI) * 0.5);
        s.rpx = s.eff / 2 / Math.max(1e-6, pxk * dist);
      });
      order.sort((a, b) => depth[b] - depth[a]);
      order.forEach((i, k) => {
        const s = spots[i];
        centers.setXYZ(k, s.world.x, s.world.y, s.world.z);
        tiles.setXYZW(k, s.tile % cells, Math.floor(s.tile / cells), s.eff * QUAD, s.e.state === 'unreleased' ? 0.6 : 1);
      });
      centers.needsUpdate = true;
      tiles.needsUpdate = true;
      P.beamMat.uniforms.time.value = time;
      lit.forEach((s) => {
        const groundY = s.holder.position.y + s.topY;
        const w = s.size * (s === hover ? 0.26 : 0.16);
        m4.compose(v.set(s.world.x, groundY, s.world.z), q.identity(), sc.set(w, Math.max(0.01, s.world.y - groundY), w));
        beams.setMatrixAt(s.beam, m4);
        const r = s.size * 0.5 * (1 + 0.15 * Math.sin(time * 2 + s.phase));
        m4.compose(v.set(s.world.x, groundY + 0.05, s.world.z), q.identity(), sc.set(r, r, r));
        halos.setMatrixAt(s.beam, m4);
      });
      gold.forEach((s) => {
        q.setFromEuler(e3.set(1.1, time * 1.4 + s.phase, 0.35));
        const r = s.size * 0.62;
        m4.compose(s.world, q, sc.set(r, r, r));
        orbits.setMatrixAt(s.orbit, m4);
        m4.compose(s.world, q, sc.set(1, 1, 1)).multiply(off.makeTranslation(r, 0, 0));
        sparks.setMatrixAt(s.orbit, m4);
      });
      [beams, halos, orbits, sparks].forEach((m) => { m.instanceMatrix.needsUpdate = true; });
    },
    /** 拿到星章或拜訪過：重畫那一格徽章、換光柱顏色。 */
    setMarks(s, marks) {
      s.marks = marks;
      drawTile(s.tile);
      texture.needsUpdate = true;
      if (s.beam != null) {
        beams.setColorAt(s.beam, COLORS[kindOf(s)]);
        halos.setColorAt(s.beam, COLORS[kindOf(s)]);
        beams.instanceColor.needsUpdate = true;
        halos.instanceColor.needsUpdate = true;
      }
    },
    /** 用螢幕距離選頻道：點到徽章附近就算，小手比較好點。 */
    pick(clientX, clientY, camera, rect) {
      let best = null, bestDepth = Infinity;
      spots.forEach((s, i) => {
        v.copy(s.world).project(camera);
        if (v.z > 1 || v.z < -1) return;
        const px = rect.left + ((v.x + 1) / 2) * rect.width, py = rect.top + ((1 - v.y) / 2) * rect.height;
        const r = Math.max(s.rpx * 1.1, 20);
        if (Math.hypot(clientX - px, clientY - py) <= r && depth[i] < bestDepth) { best = s; bestDepth = depth[i]; }
      });
      return best;
    },
    dispose() {
      texture.dispose();
      geo.dispose();
      badgeMat.dispose();
      [beams, halos, orbits, sparks].forEach((m) => m.dispose());
    },
  };
}

