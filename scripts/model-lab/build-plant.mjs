/* IONA tesis GLB jeneratörü — model-lab
   Kullanım (WSL):  node scripts/model-lab/build-plant.mjs
   Çıktı:           model-lab/out/iona-tesis-r2.glb

   Kapsam (kullanıcı kararı): digester + besleme havuzu + pompa istasyonu +
   borulama. SCADA odası ve motor/kojenerasyon YOK. Aşırı detay yok; ama her
   boru ucu bir yere bağlanır: flanş çifti + cıvatalar, gate vanalar, kör
   flanşlı yedek ağızlar, mesnetler.

   Referanslar (ölçüler kullanıcının GLB'lerinden okundu):
   - iona-mono-pompa / pompa_istasyonu_sari_zemin_dokulu: gövde Ø0.54 kırmızı,
     motor Ø0.37×0.62 finli, kaide 0.94×0.45, mil kotu +0.8, sarı platform.
   - ANKA-Tesis-3D-R01: DN150 gate vana (gövde Ø0.22×0.32, el çarkı Ø0.32,
     flanş Ø0.295×0.03, 8 cıvata), yeşil trapez digester + düşey nervürler.

   Node adları sitedeki kod sözleşmesini korur: kök `biogas_plant`;
   `digester/feed_pool/pump_room/site_piping`; `tank_wall`, `gas_dome`,
   `dome_seam`; `biogas_mixer` + `side_mixer_prop_hub` + `side_mixer_beacon`;
   boru kanalları `feed_from_pool`, `feed_to_digester`, `gas_main`. */

import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

if (typeof globalThis.FileReader === 'undefined') {
  globalThis.FileReader = class {
    readAsArrayBuffer(blob) {
      blob.arrayBuffer().then((r) => { this.result = r; this.onloadend?.(); });
    }
    readAsDataURL(blob) {
      blob.arrayBuffer().then((r) => {
        this.result = 'data:application/octet-stream;base64,' + Buffer.from(r).toString('base64');
        this.onloadend?.();
      });
    }
  };
}

/* ── Malzemeler ─────────────────────────────────────────────────────────── */
const MAT_DEFS = {
  beton: ['#dfe3db', 0.9, 0.0],
  sari_platform: ['#e2b636', 0.85, 0.0],
  porselen: ['#f6f7f3', 0.5, 0.02],
  trapez_yesili: ['#198837', 0.45, 0.05],
  nervur_yesili: ['#23a04b', 0.5, 0.05],
  membran: ['#dad8d0', 0.55, 0.0],
  paslanmaz: ['#c9cdd2', 0.25, 0.9],
  galvaniz: ['#a9b0b5', 0.5, 0.55],
  boru_celigi: ['#d0d6d8', 0.32, 0.55],
  flans_celigi: ['#aeb5ba', 0.35, 0.6],
  civata: ['#565d63', 0.4, 0.6],
  vana_dokum: ['#1c4483', 0.5, 0.15],
  el_carki: ['#c2382c', 0.45, 0.1],
  ekipman_kirmizi: ['#b02c1e', 0.45, 0.1],
  motor_koyu: ['#33393d', 0.42, 0.35],
  grafit: ['#3d4540', 0.55, 0.15],
  gaz_sari: ['#f2b711', 0.4, 0.1],
  emniyet_sari: ['#ffc700', 0.45, 0.1],
  isi_kirmizi: ['#c8502f', 0.45, 0.15],
  substrat: ['#5d5741', 0.35, 0.0],
  kirmizi_nokta: ['#e01b1b', 0.4, 0.0],
};
const MAT = Object.fromEntries(Object.entries(MAT_DEFS).map(([k, [c, r, m]]) => {
  const mat = new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
  mat.name = k;
  return [k, mat];
}));

/* ── Yardımcılar ────────────────────────────────────────────────────────── */
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
const quatTo = (dir) => new THREE.Quaternion().setFromUnitVectors(UP, dir.clone().normalize());
const M4 = (pos, quat, scl) => new THREE.Matrix4().compose(
  pos ?? new THREE.Vector3(), quat ?? new THREE.Quaternion(), scl ?? V(1, 1, 1),
);

class Parts {
  constructor() { this.byMat = new Map(); }
  add(matKey, geo, mtx) {
    const g = geo.clone();
    if (mtx) g.applyMatrix4(mtx);
    if (!this.byMat.has(matKey)) this.byMat.set(matKey, []);
    this.byMat.get(matKey).push(g);
  }
  build(name) {
    const meshes = [];
    const single = this.byMat.size === 1;
    for (const [key, list] of this.byMat) {
      const merged = mergeGeometries(list, false);
      const mesh = new THREE.Mesh(merged, MAT[key]);
      mesh.name = single ? name : `${name}_${key}`;
      mesh.castShadow = mesh.receiveShadow = true;
      meshes.push(mesh);
      list.forEach((g) => g.dispose());
    }
    return meshes;
  }
}

const cylGeo = (r1, r2, h, seg = 14, open = false) => new THREE.CylinderGeometry(r1, r2, h, seg, 1, open);
const boxGeo = (w, h, d) => new THREE.BoxGeometry(w, h, d);

/* Boru hattı: köşelerde gerçek dirsek (torus yayı). */
function pipeRun(parts, matKey, pts, r, { radial = 14, elbowR = null } = {}) {
  const R = elbowR ?? Math.max(r * 1.6, 0.12);
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i].clone();
    const b = pts[i + 1].clone();
    const dir = b.clone().sub(a).normalize();
    const start = a.clone(), end = b.clone();
    const prev = i > 0 ? pts[i].clone().sub(pts[i - 1]).normalize() : null;
    const next = i < pts.length - 2 ? pts[i + 2].clone().sub(pts[i + 1]).normalize() : null;
    if (prev && Math.abs(prev.dot(dir)) < 0.999) start.addScaledVector(dir, R);
    if (next && Math.abs(next.dot(dir)) < 0.999) end.addScaledVector(dir, -R);
    const segLen = end.distanceTo(start);
    if (segLen > 0.01) {
      const mid = start.clone().add(end).multiplyScalar(0.5);
      parts.add(matKey, cylGeo(r, r, segLen, radial), M4(mid, quatTo(dir)));
    }
    if (next && Math.abs(next.dot(dir)) < 0.999) {
      const p1 = pts[i + 1].clone();
      const C = p1.clone().addScaledVector(dir, -R).addScaledVector(next, R);
      const X = next.clone().negate();
      const Y = dir.clone();
      const Z = X.clone().cross(Y);
      const basis = new THREE.Matrix4().makeBasis(X, Y, Z).setPosition(C);
      parts.add(matKey, new THREE.TorusGeometry(R, r, radial, 10, Math.PI / 2), basis);
    }
  }
}

/* Flanş çifti + 8 cıvata (ANKA oranı: flanş Ø = boru Ø × 1.76). */
function flangePair(parts, pos, dir, r, matKey = 'flans_celigi') {
  const q = quatTo(dir);
  const fr = r * 1.76, t = 0.032;
  [-1, 1].forEach((s) => {
    parts.add(matKey, cylGeo(fr, fr, t, 18), M4(pos.clone().addScaledVector(dir, s * (t / 2 + 0.004)), q));
  });
  const boltR = Math.max(r * 0.13, 0.014);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const radial = V(Math.cos(a), 0, Math.sin(a)).applyQuaternion(q).multiplyScalar(r * 1.42);
    parts.add('civata', cylGeo(boltR, boltR, t * 2 + 0.05, 6), M4(pos.clone().add(radial), q));
  }
}

function blindFlange(parts, pos, dir, r) {
  const q = quatTo(dir);
  parts.add('flans_celigi', cylGeo(r * 1.76, r * 1.76, 0.05, 18), M4(pos.clone().addScaledVector(dir, 0.025), q));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const radial = V(Math.cos(a), 0, Math.sin(a)).applyQuaternion(q).multiplyScalar(r * 1.42);
    parts.add('civata', cylGeo(0.015, 0.015, 0.09, 6), M4(pos.clone().addScaledVector(dir, 0.025).add(radial), q));
  }
}

/* ANKA oranlı gate vana; mil daima +Y, `dir` akış ekseni. */
function gateValve(parts, pos, dir, r) {
  const s = r / 0.084;
  parts.add('vana_dokum', cylGeo(0.11 * s, 0.11 * s, 0.32 * s, 14), M4(pos, quatTo(dir)));
  [-1, 1].forEach((sd) => {
    flangePair(parts, pos.clone().addScaledVector(dir, sd * (0.16 * s + 0.02)), dir, r);
  });
  const bonnetH = 0.13 * s;
  parts.add('vana_dokum', cylGeo(0.045 * s, 0.062 * s, bonnetH, 12), M4(pos.clone().add(V(0, 0.1 * s + bonnetH / 2, 0))));
  const stemH = 0.22 * s;
  const stemTop = 0.1 * s + bonnetH + stemH;
  parts.add('paslanmaz', cylGeo(0.017 * s, 0.017 * s, stemH, 8), M4(pos.clone().add(V(0, stemTop - stemH / 2, 0))));
  const wheelR = 0.159 * s;
  const wg = new THREE.TorusGeometry(wheelR, 0.016 * s, 8, 20);
  wg.rotateX(Math.PI / 2);
  parts.add('el_carki', wg, M4(pos.clone().add(V(0, stemTop, 0))));
  for (let i = 0; i < 3; i++) {
    const sp = boxGeo(wheelR * 2 - 0.02, 0.02 * s, 0.02 * s);
    sp.rotateY((i / 3) * Math.PI);
    parts.add('el_carki', sp, M4(pos.clone().add(V(0, stemTop, 0))));
  }
  parts.add('el_carki', cylGeo(0.03 * s, 0.03 * s, 0.05 * s, 8), M4(pos.clone().add(V(0, stemTop, 0))));
}

function reducer(parts, pos, dir, rBig, rSmall, matKey = 'boru_celigi') {
  parts.add(matKey, cylGeo(rSmall, rBig, 0.32, 14), M4(pos, quatTo(dir)));
}

function sleeper(parts, pos, r) {
  const h = pos.y - r - 0.02;
  parts.add('beton', boxGeo(0.3, h, 0.55), M4(V(pos.x, h / 2, pos.z)));
  parts.add('galvaniz', boxGeo(0.26, 0.05, 0.4), M4(V(pos.x, h, pos.z)));
}
function stanchion(parts, x, z, topY) {
  parts.add('galvaniz', cylGeo(0.045, 0.045, topY, 8), M4(V(x, topY / 2, z)));
  parts.add('galvaniz', boxGeo(0.22, 0.04, 0.22), M4(V(x, 0.02, z)));
}

/* ── Yapılar ────────────────────────────────────────────────────────────── */
const root = new THREE.Group();
root.name = 'biogas_plant';

/* 1) ÇÜRÜTÜCÜ ------------------------------------------------------------ */
const digester = new THREE.Group();
digester.name = 'digester';
root.add(digester);
const DIG = { R: 12, WALL_H: 6, WALL_Y0: 0.3 };
{
  const { R, WALL_H, WALL_Y0 } = DIG;
  const p = new Parts();
  p.add('beton', cylGeo(R + 1.2, R + 1.6, 0.35, 48), M4(V(0, 0.175, 0)));
  digester.add(...p.build('foundation_pad'));

  const wall = new THREE.Mesh(cylGeo(R, R, WALL_H, 48, true), MAT.trapez_yesili);
  wall.name = 'tank_wall';
  wall.position.y = WALL_Y0 + WALL_H / 2;
  wall.material.side = THREE.DoubleSide;
  wall.castShadow = wall.receiveShadow = true;
  digester.add(wall);

  const ribs = new Parts();
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2;
    const pos = V(Math.cos(a) * (R + 0.05), WALL_Y0 + WALL_H / 2, Math.sin(a) * (R + 0.05));
    const g = boxGeo(0.1, WALL_H - 0.06, 0.05);
    g.rotateY(-a + Math.PI / 2);
    ribs.add('nervur_yesili', g, M4(pos));
  }
  digester.add(...ribs.build('wall_rib'));

  // Cam-emaye panel sıraları: iki yatay derz bandı
  const bands = new Parts();
  [WALL_Y0 + 2.05, WALL_Y0 + 4.0].forEach((y) => {
    const t = new THREE.TorusGeometry(R + 0.04, 0.028, 6, 72);
    t.rotateX(Math.PI / 2);
    bands.add('nervur_yesili', t, M4(V(0, y, 0)));
  });
  digester.add(...bands.build('wall_band'));

  const ringP = new Parts();
  ringP.add('galvaniz', cylGeo(R + 0.9, R + 0.9, 0.08, 48), M4(V(0, WALL_Y0 + WALL_H + 0.04, 0)));
  digester.add(...ringP.build('top_ring'));
  const railP = new Parts();
  const railY0 = WALL_Y0 + WALL_H + 0.08;
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    railP.add('galvaniz', cylGeo(0.025, 0.025, 1.05, 6), M4(V(Math.cos(a) * (R + 0.82), railY0 + 0.52, Math.sin(a) * (R + 0.82))));
  }
  [1.02, 0.6].forEach((h) => {
    const t = new THREE.TorusGeometry(R + 0.82, 0.02, 6, 64);
    t.rotateX(Math.PI / 2);
    railP.add('galvaniz', t, M4(V(0, railY0 + h, 0)));
  });
  digester.add(...railP.build('walkway_rail'));

  // Çift membran kubbe + etek dikişi + tepe kapağı
  const domeGeo = new THREE.SphereGeometry(R, 40, 18, 0, Math.PI * 2, 0, Math.PI / 2);
  const dome = new THREE.Mesh(domeGeo, MAT.membran);
  dome.name = 'gas_dome';
  dome.position.y = WALL_Y0 + WALL_H;
  dome.scale.set(1, 0.45, 1);
  dome.castShadow = dome.receiveShadow = true;
  digester.add(dome);
  const seamG = new THREE.TorusGeometry(R + 0.02, 0.09, 8, 64);
  seamG.rotateX(Math.PI / 2);
  const seam = new THREE.Mesh(seamG, MAT.paslanmaz);
  seam.name = 'dome_seam';
  seam.position.y = WALL_Y0 + WALL_H + 0.02;
  digester.add(seam);
  const domeY = (rr) => WALL_Y0 + WALL_H + 0.45 * Math.sqrt(Math.max(R * R - rr * rr, 0));
  const crown = new Parts();
  crown.add('paslanmaz', cylGeo(0.5, 0.6, 0.25, 16), M4(V(0, domeY(0) + 0.1, 0)));
  digester.add(...crown.build('dome_hatch'));

  // Duvar içi ısıtma serpantini (kesit modunda görünür)
  const coil = new Parts();
  for (let row = 0; row < 8; row++) {
    const t = new THREE.TorusGeometry(R - 0.45, 0.05, 8, 64, Math.PI * 1.7);
    t.rotateX(Math.PI / 2);
    t.rotateY(0.3);
    coil.add('isi_kirmizi', t, M4(V(0, 1.0 + row * 0.42, 0)));
  }
  digester.add(...coil.build('heating_coil_row'));

  // Emniyet tahliyesi + radar seviye sensörü (kubbe yüzeyinde)
  const relief = new Parts();
  const rlY = domeY(6);
  relief.add('emniyet_sari', cylGeo(0.16, 0.16, 0.5, 12), M4(V(Math.cos(0.9) * 6, rlY + 0.25, Math.sin(0.9) * 6)));
  relief.add('emniyet_sari', cylGeo(0.24, 0.24, 0.12, 12), M4(V(Math.cos(0.9) * 6, rlY + 0.56, Math.sin(0.9) * 6)));
  digester.add(...relief.build('pressure_relief_valve'));
  const inst = new Parts();
  const instAz = THREE.MathUtils.degToRad(70);
  const ip = V(Math.cos(instAz) * 8.5, domeY(8.5) + 0.22, Math.sin(instAz) * 8.5);
  inst.add('paslanmaz', cylGeo(0.06, 0.06, 0.45, 10), M4(ip));
  inst.add('porselen', boxGeo(0.22, 0.26, 0.16), M4(ip.clone().add(V(0, 0.34, 0))));
  digester.add(...inst.build('instrument_radar'));

  // Kafesli merdiven (az 210°)
  const ladder = new Parts();
  {
    const az = THREE.MathUtils.degToRad(210);
    const nx = Math.cos(az), nz = Math.sin(az);
    const base = V(nx * (R + 0.45), 0, nz * (R + 0.45));
    const side = V(-nz, 0, nx);
    [-0.25, 0.25].forEach((s) => {
      ladder.add('galvaniz', cylGeo(0.03, 0.03, WALL_H + 0.4, 8), M4(base.clone().addScaledVector(side, s).add(V(0, (WALL_H + 0.4) / 2, 0))));
    });
    for (let yy = 0.45; yy < WALL_H + 0.2; yy += 0.3) {
      const g = cylGeo(0.018, 0.018, 0.5, 6);
      const q = new THREE.Quaternion().setFromUnitVectors(UP, side);
      ladder.add('galvaniz', g, M4(base.clone().add(V(0, yy, 0)), q));
    }
    for (let yy = 2.4; yy < WALL_H + 0.3; yy += 1.1) {
      const hoop = new THREE.TorusGeometry(0.42, 0.02, 6, 16, Math.PI);
      hoop.rotateZ(-Math.PI / 2);
      const q = new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), V(nx, 0, nz));
      ladder.add('galvaniz', hoop, M4(base.clone().add(V(nx * 0.12, yy, nz * 0.12)), q));
    }
  }
  digester.add(...ladder.build('stair_stringer'));

  // 2 × Arma Mix Twin (az 150° / 330°): elmas flanş + kırmızı motor, tek şaft, çift pervane
  [150, 330].forEach((deg) => {
    const az = THREE.MathUtils.degToRad(deg);
    const nrm = V(Math.cos(az), 0, Math.sin(az));
    const mount = V(Math.cos(az) * R, 3.1, Math.sin(az) * R);
    const g = new THREE.Group();
    g.name = 'biogas_mixer';
    g.position.copy(mount);
    const inward = nrm.clone().negate();
    inward.y = -Math.tan(THREE.MathUtils.degToRad(32));
    inward.normalize();
    g.quaternion.setFromUnitVectors(V(0, 0, 1), inward);
    digester.add(g);

    const mp = new Parts();
    const dia = boxGeo(0.78, 0.78, 0.06);
    dia.rotateZ(Math.PI / 4);
    mp.add('grafit', dia, M4(V(0, 0, -0.05)));
    mp.add('ekipman_kirmizi', cylGeo(0.17, 0.2, 0.5, 12), M4(V(0, 0, -0.38), quatTo(V(0, 0, 1))));
    mp.add('ekipman_kirmizi', cylGeo(0.23, 0.23, 0.55, 12), M4(V(0, 0, -0.9), quatTo(V(0, 0, 1))));
    mp.add('grafit', boxGeo(0.16, 0.22, 0.2), M4(V(0, 0.25, -0.9)));
    const SHAFT = 4.4;
    mp.add('paslanmaz', cylGeo(0.05, 0.05, SHAFT, 10), M4(V(0, 0, SHAFT / 2), quatTo(V(0, 0, 1))));
    g.add(...mp.build('side_mixer_housing'));

    [0.55, 0.95].forEach((t) => {
      const hub = new THREE.Group();
      hub.name = 'side_mixer_prop_hub';
      hub.position.set(0, 0, SHAFT * t);
      const hp = new Parts();
      hp.add('grafit', cylGeo(0.09, 0.05, 0.22, 10), M4(new THREE.Vector3(), quatTo(V(0, 0, 1))));
      for (let b = 0; b < 3; b++) {
        const blade = boxGeo(0.1, 0.5, 0.04);
        blade.translate(0, 0.28, 0);
        blade.rotateY(0.5);
        blade.rotateZ((b / 3) * Math.PI * 2);
        hp.add('ekipman_kirmizi', blade, null);
      }
      hub.add(...hp.build('side_mixer_blade'));
      g.add(hub);
    });
    const beacon = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.03, 8, 20), MAT.paslanmaz);
    beacon.name = 'side_mixer_beacon';
    beacon.position.set(0, 0, -0.1);
    g.add(beacon);
  });
}

/* 2) BESLEME HAVUZU ------------------------------------------------------- */
const feedPool = new THREE.Group();
feedPool.name = 'feed_pool';
root.add(feedPool);
const POOL = { cx: 26, cz: 18, w: 10, d: 10, h: 2.6 };
{
  const { cx, cz, w, d, h } = POOL;
  const p = new Parts();
  p.add('beton', boxGeo(w + 1.4, 0.3, d + 1.4), M4(V(cx, 0.15, cz)));
  feedPool.add(...p.build('pool_pad'));
  const t = 0.35;
  const wallP = new Parts();
  [-1, 1].forEach((sx) => wallP.add('beton', boxGeo(t, h, d), M4(V(cx + sx * (w / 2 - t / 2), h / 2 + 0.05, cz))));
  [-1, 1].forEach((sz) => wallP.add('beton', boxGeo(w - 2 * t, h, t), M4(V(cx, h / 2 + 0.05, cz + sz * (d / 2 - t / 2)))));
  feedPool.add(...wallP.build('pool_wall'));
  const rimP = new Parts();
  [-1, 1].forEach((sx) => rimP.add('porselen', boxGeo(t + 0.14, 0.08, d + 0.2), M4(V(cx + sx * (w / 2 - t / 2), h + 0.09, cz))));
  [-1, 1].forEach((sz) => rimP.add('porselen', boxGeo(w + 0.2, 0.08, t + 0.14), M4(V(cx, h + 0.09, cz + sz * (d / 2 - t / 2)))));
  feedPool.add(...rimP.build('pool_rim'));
  const surf = new THREE.Mesh(boxGeo(w - 2 * t, 0.06, d - 2 * t), MAT.substrat);
  surf.name = 'substrate_surface';
  surf.position.set(cx, h - 0.55, cz);
  feedPool.add(surf);

  const bp = new Parts();
  bp.add('galvaniz', boxGeo(w + 1.6, 0.07, 0.9), M4(V(cx, h + 0.32, cz)));
  [-1, 1].forEach((s) => {
    const rail = cylGeo(0.02, 0.02, w + 1.5, 6);
    rail.rotateZ(Math.PI / 2);
    bp.add('galvaniz', rail, M4(V(cx, h + 0.9, cz + s * 0.42)));
    for (let x = -w / 2; x <= w / 2; x += 1.4) {
      bp.add('galvaniz', cylGeo(0.02, 0.02, 0.55, 6), M4(V(cx + x, h + 0.62, cz + s * 0.42)));
    }
  });
  feedPool.add(...bp.build('pool_bridge'));

  const mixP = new Parts();
  mixP.add('ekipman_kirmizi', cylGeo(0.16, 0.16, 0.55, 12), M4(V(cx, h + 0.75, cz)));
  mixP.add('paslanmaz', cylGeo(0.045, 0.045, 2.1, 8), M4(V(cx, h - 0.35, cz)));
  mixP.add('paslanmaz', cylGeo(0.09, 0.05, 0.2, 8), M4(V(cx, h - 1.4, cz)));
  for (let b = 0; b < 3; b++) {
    const blade = boxGeo(0.09, 0.42, 0.035);
    blade.translate(0, 0.24, 0);
    blade.rotateY(0.5);
    blade.rotateZ((b / 3) * Math.PI * 2);
    blade.rotateX(Math.PI / 2);
    mixP.add('paslanmaz', blade, M4(V(cx, h - 1.4, cz)));
  }
  feedPool.add(...mixP.build('pool_mixer_drive'));

  const chute = new Parts();
  const cg = boxGeo(1.6, 0.5, 1.2);
  cg.rotateZ(-0.5);
  chute.add('galvaniz', cg, M4(V(cx + w / 2 + 0.7, h + 0.35, cz - 2.4)));
  feedPool.add(...chute.build('pool_feed_chute'));
}

/* 3) POMPA İSTASYONU ------------------------------------------------------ */
const pumpRoom = new THREE.Group();
pumpRoom.name = 'pump_room';
root.add(pumpRoom);
const PUMP = { cx: 15.5, cz: 7.5 };
const DN150 = 0.084, DN200 = 0.1, DNGAS = 0.09;
{
  const { cx, cz } = PUMP;
  const slabP = new Parts();
  slabP.add('sari_platform', boxGeo(8.6, 0.25, 5.4), M4(V(cx, 0.125, cz)));
  slabP.add('beton', boxGeo(9.0, 0.12, 5.8), M4(V(cx, 0.06, cz)));
  pumpRoom.add(...slabP.build('slab'));

  const canopyP = new Parts();
  [[-3.9, -2.3], [3.9, -2.3], [-3.9, 2.3], [3.9, 2.3]].forEach(([dx, dz]) => {
    canopyP.add('galvaniz', cylGeo(0.07, 0.07, 3.3, 10), M4(V(cx + dx, 0.25 + 1.65, cz + dz)));
  });
  pumpRoom.add(...canopyP.build('canopy_post'));
  const roofG = boxGeo(9.2, 0.12, 6.0);
  roofG.rotateX(0.055);
  const roof = new THREE.Mesh(roofG, MAT.grafit);
  roof.name = 'roof';
  roof.position.set(cx, 3.75, cz);
  roof.castShadow = roof.receiveShadow = true;
  pumpRoom.add(roof);

  /* 2 pompa (mono-pompa ölçüleri: mil kotu +0.8, eksen z) */
  [-1.3, 1.3].forEach((dx, pi) => {
    const px = cx + dx, pz = cz + 0.4;
    const cy = 1.05;
    const base = new Parts();
    base.add('beton', boxGeo(0.94, 0.35, 2.9), M4(V(px, 0.25 + 0.175, pz - 0.5)));
    base.add('galvaniz', boxGeo(0.78, 0.06, 2.8), M4(V(px, 0.63, pz - 0.5)));
    pumpRoom.add(...base.build('pump_baseplate'));

    const vol = new Parts();
    vol.add('ekipman_kirmizi', cylGeo(0.27, 0.27, 0.75, 18), M4(V(px, cy, pz + 0.3), quatTo(V(0, 0, 1))));
    vol.add('paslanmaz', cylGeo(0.285, 0.285, 0.06, 18), M4(V(px, cy, pz + 0.71), quatTo(V(0, 0, 1))));
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      vol.add('civata', cylGeo(0.016, 0.016, 0.1, 6), M4(V(px + Math.cos(a) * 0.24, cy + Math.sin(a) * 0.24, pz + 0.72), quatTo(V(0, 0, 1))));
    }
    vol.add('ekipman_kirmizi', boxGeo(0.34, 0.3, 0.08), M4(V(px, cy - 0.34, pz + 0.3)));
    pumpRoom.add(...vol.build('pump_volute'));

    const suck = new Parts();
    const sg = cylGeo(DN150, DN150, 0.3, 12);
    sg.rotateZ(Math.PI / 2);
    suck.add('boru_celigi', sg, M4(V(px - 0.4, cy, pz + 0.3)));
    flangePair(suck, V(px - 0.56, cy, pz + 0.3), V(1, 0, 0), DN150);
    pumpRoom.add(...suck.build('pump_suction'));

    const drv = new Parts();
    drv.add('grafit', boxGeo(0.24, 0.22, 0.26), M4(V(px, cy, pz - 0.28)));
    drv.add('paslanmaz', cylGeo(0.045, 0.045, 0.3, 10), M4(V(px, cy, pz - 0.52), quatTo(V(0, 0, 1))));
    drv.add('emniyet_sari', cylGeo(0.145, 0.145, 0.26, 12, true), M4(V(px, cy, pz - 0.52), quatTo(V(0, 0, 1))));
    pumpRoom.add(...drv.build('coupling_guard'));
    const mot = new Parts();
    mot.add('motor_koyu', cylGeo(0.21, 0.21, 0.05, 16), M4(V(px, cy, pz - 0.7), quatTo(V(0, 0, 1))));
    mot.add('motor_koyu', cylGeo(0.185, 0.185, 0.62, 16), M4(V(px, cy, pz - 1.05), quatTo(V(0, 0, 1))));
    mot.add('motor_koyu', cylGeo(0.1, 0.14, 0.1, 12), M4(V(px, cy, pz - 1.42), quatTo(V(0, 0, 1))));
    mot.add('grafit', boxGeo(0.18, 0.12, 0.24), M4(V(px, cy + 0.24, pz - 1.05)));
    pumpRoom.add(...mot.build('pump_motor'));
    const fins = new Parts();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const fg = boxGeo(0.02, 0.05, 0.6);
      fg.rotateZ(a);
      fins.add('motor_koyu', fg, M4(V(px + Math.cos(a) * 0.2, cy + Math.sin(a) * 0.2, pz - 1.05)));
    }
    pumpRoom.add(...fins.build('motor_fin'));

    const dis = new Parts();
    pipeRun(dis, 'boru_celigi', [V(px, cy + 0.27, pz + 0.3), V(px, 1.95, pz + 0.3), V(px, 1.95, cz - 0.75)], DN150);
    pumpRoom.add(...dis.build('pump_discharge'));
    const dvP = new Parts();
    gateValve(dvP, V(px, 1.6, pz + 0.3), V(0, 1, 0), DN150);
    pumpRoom.add(...dvP.build(`discharge_valve_${pi + 1}`));
  });

  /* Basma kolektörü DN200 + körtapa uç + orta flanş */
  const header = new Parts();
  const hy = 1.95, hz = cz - 0.75;
  pipeRun(header, 'boru_celigi', [V(cx - 3.6, hy, hz), V(cx + 2.6, hy, hz)], DN200);
  blindFlange(header, V(cx + 2.6, hy, hz), V(1, 0, 0), DN200);
  flangePair(header, V(cx, hy, hz), V(1, 0, 0), DN200);
  pumpRoom.add(...header.build('discharge_header'));

  /* Maseratör (emiş hattı üzerinde) */
  const macer = new Parts();
  const mx = cx - 3.0, mz = cz + 1.5;
  macer.add('grafit', boxGeo(0.5, 0.62, 0.42), M4(V(mx, 0.95, mz)));
  macer.add('motor_koyu', cylGeo(0.12, 0.12, 0.4, 12), M4(V(mx, 1.5, mz)));
  flangePair(macer, V(mx + 0.32, 0.85, mz), V(1, 0, 0), DN200);
  flangePair(macer, V(mx - 0.32, 0.85, mz), V(1, 0, 0), DN200);
  pumpRoom.add(...macer.build('macerator'));

  const mcc = new Parts();
  mcc.add('grafit', boxGeo(0.9, 1.7, 0.4), M4(V(cx + 3.6, 0.25 + 0.85, cz - 1.9)));
  mcc.add('porselen', boxGeo(0.8, 1.2, 0.03), M4(V(cx + 3.6, 0.25 + 0.95, cz - 1.68)));
  pumpRoom.add(...mcc.build('pump_mcc_cabinet'));
}

/* 4) KOJENERASYON KONTEYNERİ — olduğu gibi, sade (detay istenmedi) --------- */
const engineRoom = new THREE.Group();
engineRoom.name = 'engine_room';
root.add(engineRoom);
const CHP = { cx: -20, cz: 10, L: 12.2, D: 3.0, H: 3.0 };
{
  const { cx, cz, L, D, H } = CHP;
  const y0 = 0.25;
  const slab = new Parts();
  slab.add('beton', boxGeo(L + 1, 0.25, D + 1), M4(V(cx, 0.125, cz)));
  engineRoom.add(...slab.build('slab'));

  const wallP = new Parts();
  [D / 2, -D / 2].forEach((dz) => wallP.add('porselen', boxGeo(L, H, 0.08), M4(V(cx, y0 + H / 2, cz + dz))));
  [L / 2, -L / 2].forEach((dx) => wallP.add('porselen', boxGeo(0.08, H, D), M4(V(cx + dx, y0 + H / 2, cz))));
  wallP.add('porselen', boxGeo(L + 0.15, 0.1, D + 0.15), M4(V(cx, y0 + H + 0.05, cz)));
  const RIBS = 26;
  for (let i = 0; i < RIBS; i++) {
    const x = cx - L / 2 + 0.3 + (i / (RIBS - 1)) * (L - 0.6);
    [D / 2 + 0.03, -D / 2 - 0.03].forEach((dz) => {
      wallP.add('porselen', boxGeo(0.07, H - 0.2, 0.04), M4(V(x, y0 + H / 2, cz + dz)));
    });
  }
  engineRoom.add(...wallP.build('container_wall'));

  const frameP = new Parts();
  [[-L / 2, -D / 2], [L / 2, -D / 2], [-L / 2, D / 2], [L / 2, D / 2]].forEach(([dx, dz]) => {
    [y0 + 0.12, y0 + H - 0.12].forEach((yy) => frameP.add('grafit', boxGeo(0.24, 0.24, 0.24), M4(V(cx + dx, yy, cz + dz))));
    frameP.add('grafit', boxGeo(0.1, H, 0.1), M4(V(cx + dx, y0 + H / 2, cz + dz)));
  });
  engineRoom.add(...frameP.build('container_frame'));

  const door = new THREE.Mesh(boxGeo(0.95, 2.0, 0.06), MAT.trapez_yesili);
  door.name = 'door';
  door.position.set(cx - L / 2 + 1.4, y0 + 1.0, cz - D / 2 - 0.05);
  engineRoom.add(door);
  const stripe = new THREE.Mesh(boxGeo(L - 1, 0.3, 0.02), MAT.emniyet_sari);
  stripe.name = 'container_hazard_stripe';
  stripe.position.set(cx, y0 + 0.35, cz - D / 2 - 0.05);
  engineRoom.add(stripe);

  [-3, 1.5].forEach((dx) => {
    const fanP = new Parts();
    fanP.add('grafit', cylGeo(0.62, 0.62, 0.4, 16, true), M4(V(cx + dx, y0 + H + 0.32, cz)));
    engineRoom.add(...fanP.build('container_fan'));
    const hub = new THREE.Group();
    hub.name = 'container_fan_hub';
    hub.position.set(cx + dx, y0 + H + 0.42, cz);
    const bl = new Parts();
    for (let b = 0; b < 4; b++) {
      const g = boxGeo(0.07, 0.03, 1.05);
      g.rotateY((b / 4) * Math.PI * 2);
      bl.add('grafit', g, null);
    }
    bl.add('grafit', cylGeo(0.08, 0.08, 0.1, 10), null);
    hub.add(...bl.build('container_fan_blade'));
    engineRoom.add(hub);
  });
  const stackP = new Parts();
  const sx = cx + L / 2 - 0.9;
  stackP.add('paslanmaz', cylGeo(0.42, 0.42, 1.5, 14), M4(V(sx, y0 + H + 0.95, cz)));
  stackP.add('paslanmaz', cylGeo(0.16, 0.16, 2.6, 12), M4(V(sx, y0 + H + 2.9, cz)));
  stackP.add('paslanmaz', cylGeo(0.22, 0.22, 0.08, 12), M4(V(sx, y0 + H + 4.2, cz)));
  engineRoom.add(...stackP.build('exhaust_stack'));
  const louverP = new Parts();
  for (let i = 0; i < 6; i++) {
    const g = boxGeo(0.04, 0.2, 1.1);
    g.rotateZ(0.45);
    louverP.add('grafit', g, M4(V(cx + L / 2 + 0.05, y0 + 0.8 + i * 0.26, cz + 0.6)));
  }
  engineRoom.add(...louverP.build('container_louver'));
}

/* 5) SCADA KABİNİ — olduğu gibi, sade ------------------------------------- */
const scadaRoom = new THREE.Group();
scadaRoom.name = 'scada_room';
root.add(scadaRoom);
const SCADA = { cx: -19, cz: -7, L: 5, D: 2.8, H: 2.8 };
{
  const { cx, cz, L, D, H } = SCADA;
  const y0 = 0.22;
  const slab = new Parts();
  slab.add('beton', boxGeo(L + 0.8, 0.22, D + 0.8), M4(V(cx, 0.11, cz)));
  scadaRoom.add(...slab.build('slab'));
  const wallP = new Parts();
  [[0, D / 2, L, 0.1], [0, -D / 2, L, 0.1], [L / 2, 0, 0.1, D], [-L / 2, 0, 0.1, D]].forEach(([dx, dz, w, d]) => {
    wallP.add('porselen', boxGeo(w, H, d), M4(V(cx + dx, y0 + H / 2, cz + dz)));
  });
  scadaRoom.add(...wallP.build('wall_front'));
  const roofP = new Parts();
  roofP.add('grafit', boxGeo(L + 0.3, 0.1, D + 0.3), M4(V(cx, y0 + H + 0.05, cz)));
  roofP.add('grafit', boxGeo(L + 0.3, 0.18, 0.06), M4(V(cx, y0 + H + 0.14, cz + D / 2 + 0.12)));
  scadaRoom.add(...roofP.build('roof'));
  const win = new THREE.Mesh(boxGeo(3.0, 0.9, 0.05), MAT.paslanmaz);
  win.name = 'window';
  win.material = new THREE.MeshStandardMaterial({ color: '#9fc0c8', roughness: 0.12, metalness: 0.1 });
  win.material.name = 'cam';
  win.position.set(cx + 0.4, y0 + 1.7, cz + D / 2 + 0.06);
  scadaRoom.add(win);
  const door = new THREE.Mesh(boxGeo(0.9, 2.0, 0.06), MAT.trapez_yesili);
  door.name = 'door';
  door.position.set(cx - L / 2 + 0.8, y0 + 1.0, cz + D / 2 + 0.06);
  scadaRoom.add(door);
  const extras = new Parts();
  extras.add('porselen', boxGeo(0.8, 0.55, 0.3), M4(V(cx + L / 2 + 0.18, y0 + 1.9, cz - 0.4)));
  extras.add('galvaniz', cylGeo(0.03, 0.03, 3.6, 8), M4(V(cx - L / 2 + 0.3, y0 + H + 1.8, cz - D / 2 + 0.3)));
  extras.add('galvaniz', boxGeo(0.5, 0.04, 0.04), M4(V(cx - L / 2 + 0.3, y0 + H + 3.3, cz - D / 2 + 0.3)));
  scadaRoom.add(...extras.build('roof_ac_unit'));
}

/* 6) SAHA BORULARI --------------------------------------------------------- */
const sitePiping = new THREE.Group();
sitePiping.name = 'site_piping';
root.add(sitePiping);
{
  const suctionY = 0.85;

  /* Besleme: havuz → (vana) → maseratör (feed_from_pool) */
  const fromPool = new Parts();
  const poolExit = V(POOL.cx - POOL.w / 2 - 0.05, suctionY, POOL.cz - 2);
  flangePair(fromPool, poolExit.clone().add(V(-0.12, 0, 0)), V(1, 0, 0), DN200);
  pipeRun(fromPool, 'boru_celigi', [
    poolExit, V(19.0, suctionY, POOL.cz - 2), V(19.0, suctionY, PUMP.cz + 1.5), V(PUMP.cx - 2.68 + 0.06, suctionY, PUMP.cz + 1.5),
  ], DN200);
  sitePiping.add(...fromPool.build('feed_from_pool'));
  const sfv = new Parts();
  gateValve(sfv, V(19.0, suctionY, 12.6), V(0, 0, 1), DN200);
  sitePiping.add(...sfv.build('suction_valve'));
  const slp = new Parts();
  sleeper(slp, V(20.1, suctionY, POOL.cz - 2), DN200);
  sleeper(slp, V(19.0, suctionY, 14.7), DN200);
  sleeper(slp, V(19.0, suctionY, 10.4), DN200);
  sitePiping.add(...slp.build('heat_pipe_sleeper'));

  /* Maseratör → pompa emiş manifoldu */
  const macOut = new Parts();
  pipeRun(macOut, 'boru_celigi', [
    V(PUMP.cx - 2.68, 0.85, PUMP.cz + 1.5),
    V(PUMP.cx - 1.9, 0.85, PUMP.cz + 1.5),
    V(PUMP.cx - 1.9, 1.05, PUMP.cz + 1.5),
    V(PUMP.cx - 1.9, 1.05, PUMP.cz + 0.7),
  ], DN200);
  pipeRun(macOut, 'boru_celigi', [
    V(PUMP.cx - 2.05, 1.05, PUMP.cz + 0.7), V(PUMP.cx + 1.4, 1.05, PUMP.cz + 0.7),
  ], DN150);
  sitePiping.add(...macOut.build('suction_manifold'));

  /* Kolektör → çürütücü besleme hattı (feed_to_digester) */
  const toDig = new Parts();
  const hy = 1.95, hz = PUMP.cz - 0.75;
  reducer(toDig, V(PUMP.cx - 3.76, hy, hz), V(1, 0, 0), DN200, DN150);
  // duvar giriş noktası: x=10.2 hattı çemberi z=6.32'de keser
  pipeRun(toDig, 'boru_celigi', [
    V(PUMP.cx - 3.92, hy, hz), V(10.2, hy, hz), V(10.2, hy, 6.02),
  ], DN150);
  flangePair(toDig, V(10.2, hy, 6.44), V(0, 0, 1), DN150);
  sitePiping.add(...toDig.build('feed_to_digester'));
  const fdv = new Parts();
  gateValve(fdv, V(10.95, hy, hz), V(1, 0, 0), DN150);
  sitePiping.add(...fdv.build('feed_valve'));
  const marker = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), MAT.kirmizi_nokta);
  marker.name = 'feed_marker_point';
  marker.position.set(10.2, hy + 0.42, 6.5);
  sitePiping.add(marker);
  const fsup = new Parts();
  stanchion(fsup, 10.55, hz, hy - DN150 - 0.03);
  sitePiping.add(...fsup.build('gas_pipe_support'));

  /* Gaz hattı: kubbe eteği → duvar boyunca aşağı → kondens kabı → vana →
     kojenerasyon konteynerinin güney duvarına flanşla giriş */
  const gaz = new Parts();
  const az = THREE.MathUtils.degToRad(187);
  const tapR = 11.6;
  const tapY = DIG.WALL_Y0 + DIG.WALL_H + 0.45 * Math.sqrt(DIG.R * DIG.R - tapR * tapR);
  const p1 = V(Math.cos(az) * tapR, tapY, Math.sin(az) * tapR);
  const p2 = V(Math.cos(az) * 12.42, tapY, Math.sin(az) * 12.42);
  const chpEntryX = CHP.cx + 2.5;
  const chpFace = CHP.cz - CHP.D / 2;
  pipeRun(gaz, 'gaz_sari', [
    p1, p2, V(p2.x, 0.9, p2.z), V(p2.x, 0.9, 6.5),
    V(chpEntryX, 0.9, 6.5), V(chpEntryX, 1.7, 6.5), V(chpEntryX, 1.7, chpFace - 0.06),
  ], DNGAS);
  flangePair(gaz, V(chpEntryX, 1.7, chpFace - 0.12), V(0, 0, 1), DNGAS);
  sitePiping.add(...gaz.build('gas_main'));
  const gv = new Parts();
  gateValve(gv, V(p2.x, 0.9, 2.5), V(0, 0, 1), DNGAS);
  sitePiping.add(...gv.build('gas_valve'));
  const pot = new Parts();
  pot.add('paslanmaz', cylGeo(0.14, 0.14, 0.42, 12), M4(V(p2.x, 0.42, 0.4)));
  pot.add('gaz_sari', cylGeo(0.045, 0.045, 0.28, 8), M4(V(p2.x, 0.72, 0.4)));
  sitePiping.add(...pot.build('condensate_pot'));
  const gsup = new Parts();
  sleeper(gsup, V(p2.x, 0.9, 1.5), DNGAS);
  sleeper(gsup, V(p2.x, 0.9, 4.9), DNGAS);
  sleeper(gsup, V(-15.2, 0.9, 6.5), DNGAS);
  sitePiping.add(...gsup.build('gas_pipe_sleeper'));
}

/* ── Export ─────────────────────────────────────────────────────────────── */
let tris = 0, meshCount = 0;
root.updateMatrixWorld(true);
root.traverse((n) => {
  if (n.isMesh) {
    meshCount++;
    const idx = n.geometry.index;
    tris += (idx ? idx.count : n.geometry.attributes.position.count) / 3;
  }
});

const scene = new THREE.Scene();
scene.add(root);
const exporter = new GLTFExporter();
exporter.parse(
  scene,
  (result) => {
    const outDir = path.resolve('model-lab/out');
    fs.mkdirSync(outDir, { recursive: true });
    const outFile = path.join(outDir, 'iona-tesis-r2.glb');
    fs.writeFileSync(outFile, Buffer.from(result));
    console.log(`yazildi: ${outFile}`);
    console.log(`boyut: ${(fs.statSync(outFile).size / 1024 / 1024).toFixed(2)} MB | mesh: ${meshCount} | ucgen: ${Math.round(tris)}`);
  },
  (err) => { console.error('export hatasi:', err); process.exit(1); },
  { binary: true },
);
