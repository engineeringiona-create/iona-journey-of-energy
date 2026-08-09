import * as THREE from 'three';
import { buildGenset } from './cg170b-model.js';

/* ---------------------------------------------------------------
   CAT CG170B-20 — scroll ile parçalanan / birleşen jeneratör seti
   0 → 0.12 montajlı · 0.12 → 0.52 patlama · 0.52 → 0.70 inceleme
   0.70 → 0.88 geri montaj · 0.88 → 1 çalışma (kesit + krank/piston)
---------------------------------------------------------------- */

const CANVAS = document.getElementById('scene');
const STAGE = document.getElementById('stage');
const LABELS = document.getElementById('labels');
const SVG = document.getElementById('leaders');
const SCROLLER = document.getElementById('scroller');
const RUN = document.getElementById('run');

const renderer = new THREE.WebGLRenderer({ canvas: CANVAS, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 200);

function studioEnv() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#fbfcfd'); g.addColorStop(0.40, '#c3c9d0');
  g.addColorStop(0.54, '#767b81'); g.addColorStop(0.72, '#3c4045'); g.addColorStop(1, '#14161a');
  x.fillStyle = g; x.fillRect(0, 0, 512, 256);
  const strip = (cx, cy, w, h, a) => {
    const rg = x.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h));
    rg.addColorStop(0, `rgba(255,255,255,${a})`); rg.addColorStop(0.55, `rgba(255,255,255,${a * 0.45})`);
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = rg; x.beginPath(); x.ellipse(cx, cy, w, h, 0, 0, 7); x.fill();
  };
  strip(120, 62, 178, 56, 1);        // ana softbox (sol üst)
  strip(256, 16, 320, 26, 0.85);     // tepe şerit ışığı — siluet çizer
  strip(398, 74, 92, 40, 0.7);       // sağdan rim
  strip(250, 168, 200, 26, 0.16);    // alttan hafif bounce
  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  const p = new THREE.PMREMGenerator(renderer);
  const env = p.fromEquirectangular(tex).texture;
  p.dispose(); tex.dispose();
  return env;
}
scene.environment = studioEnv();

const key = new THREE.DirectionalLight(0xffffff, 2.35);
key.position.set(1.5, 10.5, 12);
key.castShadow = true;
key.shadow.mapSize.set(1536, 1536);
key.shadow.camera.near = 2; key.shadow.camera.far = 46;
const d = 9;
Object.assign(key.shadow.camera, { left: -d, right: d, top: d, bottom: -d });
key.shadow.bias = -0.0008; key.shadow.normalBias = 0.03;
scene.add(key);
const topStrip = new THREE.DirectionalLight(0xffffff, 0.55);
topStrip.position.set(-2, 14, 1.5);
scene.add(topStrip);
const rim = new THREE.DirectionalLight(0xd7e2f0, 1.05);      // sağdan rim
rim.position.set(-7, 4.5, -9);
scene.add(rim);
const bounce = new THREE.DirectionalLight(0xfff4e0, 0.22);   // alttan bounce kart
bounce.position.set(2, -6, 4);
scene.add(bounce);
scene.add(new THREE.HemisphereLight(0xffffff, 0x6f767d, 0.30));

const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.26 }));
ground.rotation.x = -Math.PI / 2;
ground.position.y = -1.22;
ground.receiveShadow = true;
scene.add(ground);

/* yumuşak temas gölgesi (AO hissi) — şasinin altına yakın koyu leke */
{
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const rg = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  rg.addColorStop(0, 'rgba(0,0,0,0.72)'); rg.addColorStop(0.45, 'rgba(0,0,0,0.34)');
  rg.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = rg; g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const blob = new THREE.Mesh(
    new THREE.PlaneGeometry(13.5, 3.9),
    new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false })
  );
  blob.rotation.x = -Math.PI / 2;
  blob.position.set(0, -1.208, 0);
  blob.renderOrder = -1;
  scene.add(blob);
}

const { root, parts, anim, SPEC } = buildGenset();
const pivot = new THREE.Group();
pivot.add(root);
scene.add(pivot);
const byKey = Object.fromEntries(parts.map(p => [p.key, p]));

/* --- performance: this model has ~600 meshes, so bounding boxes are cached
   once (parts only translate) instead of re-walking the graph every frame --- */
parts.forEach(p => { p.box0 = new THREE.Box3().setFromObject(p.object); });
const SMALL_SHADOW = /ring_|bolt|stud|liner_|piston|rod|riser|web_|vent_|fin|louvre|blade|plug|coil/;
root.traverse(o => { if (o.isMesh && SMALL_SHADOW.test(o.name)) o.castShadow = false; });

const delta = new THREE.Vector3();
function partBoxOf(part, out) {
  delta.copy(part.object.position).sub(part.object.userData.home);
  return out.copy(part.box0).translate(delta);
}
function unionBoxes(keys, out) {
  out.makeEmpty();
  const tmp = new THREE.Box3();
  keys.forEach(k => out.union(partBoxOf(byKey[k], tmp)));
  return out.applyMatrix4(pivot.matrixWorld);
}

/* ---- labels ---- */
const labelEls = {};
parts.forEach((p, i) => {
  if (p.key === 'block') return;
  const el = document.createElement('div');
  el.className = 'lbl';
  el.innerHTML = `<span class="lbl-i">${String(i + 1).padStart(2, '0')}</span><span class="lbl-t">${p.label}</span>`;
  LABELS.appendChild(el);
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('class', 'leader');
  SVG.appendChild(line);
  labelEls[p.key] = { el, line };
});

/* ---- scroll ---- */
let target = 0, current = 0;
function readScroll() {
  const r = SCROLLER.getBoundingClientRect();
  const total = r.height - innerHeight;
  target = total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : 0;
}
addEventListener('scroll', readScroll, { passive: true });
readScroll();

const easeInOut = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const clamp01 = t => Math.min(1, Math.max(0, t));
const seg = (t, a, b) => clamp01((t - a) / (b - a));

const chapters = [...document.querySelectorAll('.chapter')];
let gutterPx = 0;

function resize() {
  const w = STAGE.clientWidth, h = STAGE.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = w < 780 ? 38 : 29;
  camera.clearViewOffset();
  gutterPx = w >= 900 ? (document.getElementById('copy').getBoundingClientRect().width + 24) : 0;
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
let fitDist = 0, started = false, t0 = performance.now(), crankAngle = 0;

const GROUPS = {
  frame: ['skid', 'pan', 'crank', 'block', 'front'],
  cyl: ['pistonA', 'pistonB', 'headA', 'headB'],
  air: ['turbo', 'air', 'cooler', 'intake', 'exhA', 'exhB'],
  power: ['fly', 'alt', 'tbox', 'cab']
};
function activeGroup(p) {
  if (p < 0.15 || p > 0.72) return null;
  if (p < 0.33) return 'frame';
  if (p < 0.48) return 'cyl';
  if (p < 0.61) return 'air';
  return 'power';
}

function fitDistance(box, center, dir, fx, fy, shift) {
  let dd = box.getBoundingSphere(sphere).radius * 3 + 1;
  for (let k = 0; k < 4; k++) {
    camera.position.copy(dir).multiplyScalar(dd).add(center);
    camera.lookAt(center);
    camera.updateMatrixWorld(true);
    let m = 0;
    for (let i = 0; i < 8; i++) {
      corner.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z);
      corner.project(camera);
      m = Math.max(m, Math.abs(corner.x - shift) / fx, Math.abs(corner.y) / fy);
    }
    if (!isFinite(m) || m <= 0) break;
    dd *= m;
  }
  return dd;
}

/* running instrument read-outs */
const out = {
  rpm: document.getElementById('v-rpm'),
  kw: document.getElementById('v-kw'),
  hz: document.getElementById('v-hz'),
  fire: document.getElementById('v-fire')
};

function frame(now) {
  const dt = Math.min(0.05, (now - t0) / 1000); t0 = now;
  current += (target - current) * (1 - Math.pow(0.0022, dt));
  const p = current;

  const explode = easeInOut(seg(p, 0.12, 0.52));
  const assemble = easeInOut(seg(p, 0.70, 0.88));
  const amount = explode * (1 - assemble);
  const run = easeInOut(seg(p, 0.87, 0.97));           // motor devri
  const cut = easeInOut(seg(p, 0.90, 0.99));           // kesit görünümü
  const w = STAGE.clientWidth, h = STAGE.clientHeight;
  const small = w < 900;

  parts.forEach(part => {
    const o = part.object;
    const reach = Math.min(1, part.explode.length() / 3.2);
    const local = easeInOut(clamp01(amount * 1.18 - (1 - reach) * 0.14));
    v.copy(part.explode).multiplyScalar(local);
    o.position.copy(o.userData.home).add(v);
    o.rotation.z = (part.key === 'cab' || part.key === 'cooler') ? local * 0.16 : 0;
  });

  /* ---- running machinery ---- */
  const rpm = SPEC.rpm * run;
  crankAngle += (rpm / 60) * Math.PI * 2 * dt;
  anim.crank.rotation.x = crankAngle;
  anim.flywheel.rotation.x = crankAngle;
  anim.rotor.rotation.x = crankAngle;
  anim.turbos.forEach((t, i) => { t.rotation.x = crankAngle * (i ? -9 : 9); });

  const r = SPEC.stroke / 2, L = SPEC.rod;
  anim.pistons.forEach(pt => {
    const a = crankAngle + pt.angle;                    // her kol için faz
    const sa = Math.sin(a), s = r * Math.cos(a) + Math.sqrt(L * L - r * r * sa * sa);
    pt.piston.position.y = s;
    pt.rod.position.y = s;
    pt.rod.rotation.x = -Math.asin((r * sa) / L);
  });

  // heat glow on the exhaust side once it is firing
  anim.heatMats.forEach(m => { m.emissiveIntensity = run * 0.85; });
  // cut-away: block walls, liners and housings fade so the motion is visible
  anim.ghostMats.forEach(m => { m.opacity = 1 - cut * 0.84; });

  const az = 2.42 + 0.42 * amount - run * 0.92;
  const el = 0.20 + 0.12 * amount + run * 0.04;
  pivot.rotation.y = -0.08 + p * 0.06;
  pivot.updateMatrixWorld(true);
  camDir.set(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el)).normalize();

  bounds.makeEmpty();
  parts.forEach(part => bounds.union(partBoxOf(part, partBox)));
  bounds.applyMatrix4(pivot.matrixWorld);
  bounds.getCenter(tmpCenter);
  const shift = gutterPx / w;
  const fx = (1 - shift) * (small ? 0.94 : 0.84), fy = small ? 0.90 : 0.82;
  let want = fitDistance(bounds, tmpCenter, camDir, fx, fy, shift);

  const g = activeGroup(p);
  if (g && !small) {
    unionBoxes(GROUPS[g], focusBox);
    const gd = fitDistance(focusBox, focusBox.getCenter(v), camDir, fx * 0.8, fy * 0.8, shift);
    const wgt = 0.22 * amount;
    tmpCenter.lerp(focusBox.getCenter(new THREE.Vector3()), wgt);
    want = want + (gd - want) * wgt;
  }
  // closing shot pushes in on the engine, not the whole skid
  if (cut > 0.01) {
    unionBoxes(['block', 'crank', 'headA', 'headB', 'pistonA'], focusBox);
    const gd = fitDistance(focusBox, focusBox.getCenter(v), camDir, fx * 0.82, fy * 0.82, shift);
    tmpCenter.lerp(focusBox.getCenter(new THREE.Vector3()), cut * 0.85);
    want = want + (gd - want) * cut * 0.85;
  }

  if (!started) { fitDist = want; camCenter.copy(tmpCenter); started = true; }
  const k = 1 - Math.pow(0.004, dt);
  fitDist += (want - fitDist) * k;
  camCenter.lerp(tmpCenter, k);
  camera.position.copy(camDir).multiplyScalar(fitDist).add(camCenter);
  camera.lookAt(camCenter);

  /* ---- labels ---- */
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
      partBoxOf(part, partBox).getCenter(v).applyMatrix4(pivot.matrixWorld).project(camera);
      const x = (v.x * 0.5 + 0.5) * w, y = (-v.y * 0.5 + 0.5) * h;
      cols[x > (gutter + w) / 2 ? 1 : -1].push({ L, x, y });
    });
    [-1, 1].forEach(side => {
      const list = cols[side].sort((a, b) => a.y - b.y);
      const gap = 46, top = 108, bottom = h - 86;
      let cursor = top;
      list.forEach(it => { it.ly = Math.max(cursor, Math.min(it.y, bottom)); cursor = it.ly + gap; });
      const over = cursor - gap - bottom;
      if (over > 0) list.forEach(it => { it.ly -= over; });
      list.forEach(({ L, x, y, ly }) => {
        const lx = side > 0 ? w - 28 : gutter + 6;
        L.el.style.transform = `translate(${lx}px, ${ly}px) translate(${side > 0 ? '-100%' : '0'}, -50%)`;
        L.el.style.opacity = base;
        L.line.setAttribute('x1', x); L.line.setAttribute('y1', y);
        L.line.setAttribute('x2', side > 0 ? lx - 14 : lx + 6); L.line.setAttribute('y2', ly);
        L.line.style.opacity = base * 0.5;
      });
    });
  }

  /* ---- instrument panel ---- */
  const showRun = clamp01(seg(p, 0.885, 0.925));
  RUN.style.opacity = showRun;
  RUN.style.transform = `translateY(${(1 - showRun) * 14}px)`;
  if (showRun > 0.01) {
    out.rpm.textContent = Math.round(rpm).toLocaleString('tr-TR');
    out.kw.textContent = Math.round(SPEC.kw * run).toLocaleString('tr-TR');
    out.hz.textContent = (SPEC.hz * run).toFixed(1);
    out.fire.textContent = Math.round(rpm / 60 * 10) + ' /s';
  }

  chapters.forEach(c => {
    const a = +c.dataset.in, b = +c.dataset.out;
    const on = p >= a && p <= b;
    const fade = Math.min(a <= 0 ? 1 : seg(p, a, a + 0.035), 1 - seg(p, b - 0.035, b));
    c.style.opacity = on ? fade : 0;
    c.style.transform = `translateY(${(1 - (on ? fade : 0)) * 18}px)`;
  });
  document.getElementById('bar').style.transform = `scaleX(${p})`;

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.setExplodeProgress = (val) => { target = current = Math.min(1, Math.max(0, val)); };
