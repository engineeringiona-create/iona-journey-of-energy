import * as THREE from 'three';
import { buildAgitator } from './agitator-model.js';

/* ---------------------------------------------------------------
   Scroll-driven exploded view.
   progress 0 → 1 maps to: assembled → exploded → held → reassembled
---------------------------------------------------------------- */

const CANVAS = document.getElementById('scene');
const STAGE = document.getElementById('stage');
const LABELS = document.getElementById('labels');
const SVG = document.getElementById('leaders');
const SCROLLER = document.getElementById('scroller');

const renderer = new THREE.WebGLRenderer({ canvas: CANVAS, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);

/* ---- studio environment (generated, no external HDRI) ---- */
function studioEnv() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.42, '#d8dce0');
  g.addColorStop(0.55, '#8f959b'); g.addColorStop(1, '#2a2d31');
  x.fillStyle = g; x.fillRect(0, 0, 512, 256);
  // soft light strips = believable specular highlights on metal
  const strip = (cx, cy, w, h, a) => {
    const rg = x.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h));
    rg.addColorStop(0, `rgba(255,255,255,${a})`); rg.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = rg; x.beginPath(); x.ellipse(cx, cy, w, h, 0, 0, 7); x.fill();
  };
  strip(118, 60, 168, 52, 1);      // ana softbox (sol üst)
  strip(256, 16, 300, 24, 0.8);    // tepe şerit ışığı
  strip(392, 70, 88, 36, 0.66);    // sağdan rim
  strip(250, 158, 190, 26, 0.16);  // alttan bounce
  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromEquirectangular(tex).texture;
  pmrem.dispose(); tex.dispose();
  return env;
}
scene.environment = studioEnv();

const key = new THREE.DirectionalLight(0xffffff, 2.1);
key.position.set(2.6, 4.2, 3.4);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.near = 1; key.shadow.camera.far = 20;
const d = 4.2;
Object.assign(key.shadow.camera, { left: -d, right: d, top: d, bottom: -d });
key.shadow.bias = -0.0007;
key.shadow.normalBias = 0.02;
scene.add(key);
const topStrip = new THREE.DirectionalLight(0xffffff, 0.5);
topStrip.position.set(-0.5, 6, 0.8);
scene.add(topStrip);
const rim = new THREE.DirectionalLight(0xdce6f2, 0.8);       // arkadan/sağdan rim
rim.position.set(-4, 1.6, -3.4);
scene.add(rim);
const bounce = new THREE.DirectionalLight(0xfff4e6, 0.2);    // alttan bounce kart
bounce.position.set(1.2, -3, 1.6);
scene.add(bounce);
scene.add(new THREE.HemisphereLight(0xffffff, 0x9aa0a6, 0.4));

/* soft contact shadow catcher */
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(14, 14),
  new THREE.ShadowMaterial({ opacity: 0.13 })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -1.15;
ground.receiveShadow = true;
scene.add(ground);

/* yumuşak temas gölgesi */
{
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const rg = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  rg.addColorStop(0, 'rgba(0,0,0,0.5)'); rg.addColorStop(0.55, 'rgba(0,0,0,0.2)');
  rg.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = rg; g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 2.2),
    new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2;
  blob.position.set(0, -1.14, 0);
  blob.renderOrder = -1;
  scene.add(blob);
}

/* ---- model ---- */
const { root, parts } = buildAgitator();
const pivot = new THREE.Group();
pivot.add(root);
scene.add(pivot);

const byKey = Object.fromEntries(parts.map(p => [p.key, p]));

/* Technical exploded view: every part slides along the shaft axis into its
   own slot, in assembly order, so nothing overlaps and the line stays true.
   Only the off-axis strut and the bolt ring get a small radial nudge. */
const RADIAL = { strut: [-0.38, 0.26], bolts: [0.26, 0.0], guard: [0.0, 0.0] };
{
  const box = new THREE.Box3();
  const size = new THREE.Vector3();
  const ordered = parts.slice().sort((a, b) => a.object.userData.home.x - b.object.userData.home.x);
  const len = new Map();
  let total = 0;
  const GAP = 0.17;
  ordered.forEach(p => {
    box.setFromObject(p.object).getSize(size);
    const l = Math.max(0.12, size.x);
    len.set(p, l); total += l;
  });
  total += GAP * (ordered.length - 1);
  const whole = new THREE.Box3().setFromObject(root);
  let cursor = whole.getCenter(new THREE.Vector3()).x - total / 2;
  ordered.forEach(p => {
    const l = len.get(p);
    const slot = cursor + l / 2;
    cursor += l + GAP;
    const r = RADIAL[p.key] || [0, 0];
    p.explode = new THREE.Vector3(slot - p.object.userData.home.x, r[0], r[1]);
  });
}

/* ---- label DOM ---- */
const labelEls = {};
parts.forEach(p => {
  if (p.key === 'plate') return;
  const el = document.createElement('div');
  el.className = 'lbl';
  el.innerHTML = `<span class="lbl-i">${String(parts.indexOf(p) + 1).padStart(2, '0')}</span>
    <span class="lbl-t">${p.label}</span>`;
  LABELS.appendChild(el);
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('class', 'leader');
  SVG.appendChild(line);
  labelEls[p.key] = { el, line };
});

/* ---- scroll ---- */
let target = 0, current = 0;
function readScroll() {
  // relative to the section itself, so the block can sit anywhere in a page
  const r = SCROLLER.getBoundingClientRect();
  const total = r.height - innerHeight;
  target = total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : 0;
}
addEventListener('scroll', readScroll, { passive: true });
readScroll();

/* ---- easing / phase mapping ---- */
const easeInOut = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const clamp01 = t => Math.min(1, Math.max(0, t));
const seg = (t, a, b) => clamp01((t - a) / (b - a));

const chapters = [...document.querySelectorAll('.chapter')];
let gutterPx = 0;

function resize() {
  const w = STAGE.clientWidth, h = STAGE.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = w < 780 ? 40 : 30;
  camera.clearViewOffset();
  gutterPx = w >= 900 ? (document.getElementById('copy').getBoundingClientRect().width + 28) : 0;
  if (gutterPx) camera.setViewOffset(w, h, -gutterPx / 2, 0, w, h);
  camera.updateProjectionMatrix();
  SVG.setAttribute('viewBox', `0 0 ${w} ${h}`);
}
addEventListener('resize', resize);
resize();

const v = new THREE.Vector3();
const bounds = new THREE.Box3();
const focusBox = new THREE.Box3();
const partBox = new THREE.Box3();
const sphere = new THREE.Sphere();
const camDir = new THREE.Vector3();
const camCenter = new THREE.Vector3();
const tmpCenter = new THREE.Vector3();
const corner = new THREE.Vector3();
let fitDist = 0, started = false;
let t0 = performance.now();

/* which parts each chapter talks about */
const GROUPS = {
  drive: ['cowl', 'motor', 'guard', 'drive'],
  seal: ['bolts', 'seal', 'plate', 'strut'],
  shaft: ['shaft1', 'propA', 'coupler', 'shaft2', 'propB']
};
function activeGroup(p) {
  if (p < 0.17 || p > 0.74) return null;
  if (p < 0.37) return 'drive';
  if (p < 0.56) return 'seal';
  return 'shaft';
}

/* distance at which every corner of `box` projects inside the frame */
function fitDistance(box, center, dir, fx, fy, shift) {
  let d = box.getBoundingSphere(sphere).radius * 3 + 1;
  for (let k = 0; k < 4; k++) {
    camera.position.copy(dir).multiplyScalar(d).add(center);
    camera.lookAt(center);
    camera.updateMatrixWorld(true);
    let m = 0;
    for (let i = 0; i < 8; i++) {
      corner.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z);
      corner.project(camera);
      m = Math.max(m, Math.abs(corner.x - shift) / fx, Math.abs(corner.y) / fy);
    }
    if (!isFinite(m) || m <= 0) break;
    d *= m;
  }
  return d;
}

function frame(now) {
  const dt = Math.min(0.05, (now - t0) / 1000); t0 = now;
  current += (target - current) * (1 - Math.pow(0.0022, dt));

  const p = current;
  const explode = easeInOut(seg(p, 0.14, 0.50));
  const assemble = easeInOut(seg(p, 0.74, 0.94));
  const spin = seg(p, 0.86, 1.0);
  const amount = explode * (1 - assemble);
  const w = STAGE.clientWidth, h = STAGE.clientHeight;
  const small = w < 900;

  parts.forEach(part => {
    const o = part.object;
    const reach = Math.min(1, Math.abs(part.explode.x) / 1.8);      // outermost parts lead
    const local = easeInOut(clamp01(amount * 1.20 - (1 - reach) * 0.16));
    v.copy(part.explode).multiplyScalar(local);
    o.position.copy(o.userData.home).add(v);
    o.rotation.x = (part.spin ? spin * (now / 1000) * 5.2 - local * 0.4 : 0);
    o.rotation.z = (part.key === 'bolts' || part.key === 'coupler' || part.key === 'strut') ? local * 0.26 : 0;
    part.on = 0;
  });

  // camera direction: 3/4 hero view when assembled, near-perpendicular when exploded
  const az = -0.60 - 0.48 * amount;
  const el = 0.19 + 0.10 * amount;
  pivot.rotation.y = -0.10 + p * 0.05;
  pivot.updateMatrixWorld(true);
  camDir.set(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el)).normalize();

  bounds.setFromObject(root);
  bounds.getCenter(tmpCenter);
  // the copy column is off-limits: the frustum is shifted right by gutter/2 (see resize),
  // so the usable half-width around that shifted centre is (1 - shift)
  const shift = gutterPx / w;
  const fx = (1 - shift) * (small ? 0.94 : 0.84), fy = small ? 0.90 : 0.82;
  let want = fitDistance(bounds, tmpCenter, camDir, fx, fy, shift);

  // chapters 2-4 lean the framing toward the group being described
  const g = activeGroup(p);
  if (g && !small) {
    focusBox.makeEmpty();
    GROUPS[g].forEach(k => { focusBox.union(partBox.setFromObject(byKey[k].object)); });
    const gd = fitDistance(focusBox, focusBox.getCenter(v), camDir, fx * 0.8, fy * 0.8, shift);
    const wgt = 0.20 * amount;
    tmpCenter.lerp(focusBox.getCenter(new THREE.Vector3()), wgt);
    want = want + (gd - want) * wgt;
  }

  if (!started) { fitDist = want; camCenter.copy(tmpCenter); started = true; }
  const k = 1 - Math.pow(0.004, dt);
  fitDist += (want - fitDist) * k;
  camCenter.lerp(tmpCenter, k);
  camera.position.copy(camDir).multiplyScalar(fitDist).add(camCenter);
  camera.lookAt(camCenter);

  // ---- labels: only for the group under discussion ----
  const base = clamp01(Math.min(amount * 2.4, (1 - assemble * 1.5) * 2));
  const shown = g ? GROUPS[g] : [];
  if (base < 0.02 || small || !shown.length) {
    parts.forEach(part => { const L = labelEls[part.key]; if (L) { L.el.style.opacity = 0; L.line.style.opacity = 0; } });
  } else {
    const gutter = gutterPx || w * 0.32;
    const cols = { '-1': [], '1': [] };
    parts.forEach(part => {
      const L = labelEls[part.key]; if (!L) return;
      if (shown.indexOf(part.key) === -1) { L.el.style.opacity = 0; L.line.style.opacity = 0; return; }
      partBox.setFromObject(part.object).getCenter(v).project(camera);
      const x = (v.x * 0.5 + 0.5) * w, y = (-v.y * 0.5 + 0.5) * h;
      cols[x > (gutter + w) / 2 ? 1 : -1].push({ L, x, y });
    });
    [-1, 1].forEach(side => {
      const list = cols[side].sort((a, b) => a.y - b.y);
      const gap = 46, top = 110, bottom = h - 84;
      let cursor = top;
      list.forEach(it => { it.ly = Math.max(cursor, Math.min(it.y, bottom)); cursor = it.ly + gap; });
      const over = cursor - gap - bottom;
      if (over > 0) list.forEach(it => { it.ly -= over; });
      list.forEach(({ L, x, y, ly }) => {
        const lx = side > 0 ? w - 30 : gutter + 6;
        L.el.style.transform = `translate(${lx}px, ${ly}px) translate(${side > 0 ? '-100%' : '0'}, -50%)`;
        L.el.style.opacity = base;
        L.line.setAttribute('x1', x); L.line.setAttribute('y1', y);
        L.line.setAttribute('x2', side > 0 ? lx - 16 : lx + 6); L.line.setAttribute('y2', ly);
        L.line.style.opacity = base * 0.5;
      });
    });
  }

  chapters.forEach(c => {
    const a = +c.dataset.in, b = +c.dataset.out;
    const on = p >= a && p <= b;
    const fade = Math.min(a <= 0 ? 1 : seg(p, a, a + 0.04), 1 - seg(p, b - 0.04, b));
    c.style.opacity = on ? fade : 0;
    c.style.transform = `translateY(${(1 - (on ? fade : 0)) * 18}px)`;
    c.style.pointerEvents = on && fade > 0.5 ? 'auto' : 'none';
  });
  document.getElementById('bar').style.transform = `scaleX(${p})`;

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// authoring hook: jump straight to a progress value
window.setExplodeProgress = (val) => { target = current = Math.min(1, Math.max(0, val)); };
