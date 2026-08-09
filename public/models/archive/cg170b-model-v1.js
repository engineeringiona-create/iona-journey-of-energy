import * as THREE from 'three';
import { orangePeel, sandCast, brushed, machined, decal, decalPlane } from './cg170b-textures.js';

/* ---------------------------------------------------------------
   CAT CG170B-20 — 20 silindirli, 60° V, gaz motorlu jeneratör seti
   Gerçek ölçülere yakın parametrik model. Birim: metre.
   Krank ekseni +X boyunca; krank merkezi y = 0.
   Bore 170 mm · Stroke 195 mm · 20 silindir · 1500 dev/dak · 50 Hz
---------------------------------------------------------------- */

export const SPEC = {
  bore: 0.170, stroke: 0.195, rod: 0.360, cylinders: 20, vAngle: 30 * Math.PI / 180,
  pitch: 0.300, rpm: 1500, kw: 2000, hz: 50
};

export const MAT = {
  yellow: new THREE.MeshStandardMaterial({ name: 'cat_yellow', color: 0xf0c200, roughness: 0.42, metalness: 0.14 }),
  yellowDark: new THREE.MeshStandardMaterial({ name: 'cat_yellow_shade', color: 0xc39a05, roughness: 0.5, metalness: 0.14 }),
  black: new THREE.MeshStandardMaterial({ name: 'cat_black', color: 0x191b1d, roughness: 0.55, metalness: 0.2 }),
  rubber: new THREE.MeshStandardMaterial({ name: 'rubber', color: 0x121314, roughness: 0.85, metalness: 0.05 }),
  skid: new THREE.MeshStandardMaterial({ name: 'skid_steel', color: 0x33373b, roughness: 0.62, metalness: 0.75 }),
  steel: new THREE.MeshStandardMaterial({ name: 'forged_steel', color: 0x8d939a, roughness: 0.34, metalness: 0.95 }),
  alu: new THREE.MeshStandardMaterial({ name: 'cast_aluminium', color: 0xa8adb2, roughness: 0.52, metalness: 0.7 }),
  insul: new THREE.MeshStandardMaterial({ name: 'exhaust_insulation', color: 0xc3c7cb, roughness: 0.46, metalness: 0.55 }),
  heat: new THREE.MeshStandardMaterial({ name: 'exhaust_pipe_hot', color: 0x6f6a66, roughness: 0.62, metalness: 0.8, emissive: 0xff3b00, emissiveIntensity: 0 }),
  copper: new THREE.MeshStandardMaterial({ name: 'copper_winding', color: 0xb1703c, roughness: 0.4, metalness: 0.9 }),
  glass: new THREE.MeshStandardMaterial({ name: 'panel_screen', color: 0x0d2b2a, roughness: 0.16, metalness: 0.3, emissive: 0x0e5c50, emissiveIntensity: 0.25 }),
  bolt: new THREE.MeshStandardMaterial({ name: 'zinc_bolt', color: 0xb6babd, roughness: 0.36, metalness: 1.0 })
};

/* stüdyo çekimi gerçekçiliği: boya portakal kabuğu, kum döküm greni,
   fırçalanmış çelik izleri ve işlenmiş yüzey halkaları */
{
  const peel = orangePeel(4), peelD = orangePeel(3);
  const cast = sandCast(6), castFine = sandCast(3);
  const brush = brushed(3), brushSkid = brushed(6);
  const mach = machined(1);
  const skin = (mat, maps, nScale, env) => {
    Object.assign(mat, maps);
    if (maps.normalMap) mat.normalScale = new THREE.Vector2(nScale, nScale);
    mat.envMapIntensity = env;
    mat.needsUpdate = true;
  };
  skin(MAT.yellow, peel, 0.32, 1.05);
  skin(MAT.yellowDark, peelD, 0.34, 0.95);
  skin(MAT.alu, cast, 0.65, 1.1);
  skin(MAT.insul, castFine, 0.5, 0.9);
  skin(MAT.heat, cast, 0.75, 0.8);
  skin(MAT.steel, brush, 0.42, 1.35);
  skin(MAT.skid, brushSkid, 0.5, 1.0);
  skin(MAT.rubber, cast, 0.6, 0.5);
  skin(MAT.black, castFine, 0.45, 0.7);
  skin(MAT.copper, mach, 0.5, 1.2);
  skin(MAT.bolt, mach, 0.4, 1.4);
}

function mesh(geo, mat, name, parent, ghost) {
  const m = new THREE.Mesh(geo, mat);
  m.name = name; m.castShadow = true; m.receiveShadow = true;
  if (ghost) m.userData.ghost = true;
  if (parent) parent.add(m);
  return m;
}
const box = (w, h, d, mat, name, parent, pos, ghost) => {
  const m = mesh(new THREE.BoxGeometry(w, h, d), mat, name, parent, ghost);
  if (pos) m.position.set(pos[0], pos[1], pos[2]);
  return m;
};
/* cylinder along X */
function tubeX(rT, rB, len, seg, mat, name, parent, pos, open) {
  const g = new THREE.CylinderGeometry(rT, rB, len, seg, 1, !!open);
  g.rotateZ(Math.PI / 2);
  const m = mesh(g, mat, name, parent);
  if (pos) m.position.set(pos[0], pos[1] || 0, pos[2] || 0);
  return m;
}
/* cylinder along Y */
function tubeY(rT, rB, len, seg, mat, name, parent, pos, open) {
  const m = mesh(new THREE.CylinderGeometry(rT, rB, len, seg, 1, !!open), mat, name, parent);
  if (pos) m.position.set(pos[0], pos[1], pos[2]);
  return m;
}
function boltRingX(radius, count, r, h, mat, name, parent, x = 0) {
  const g = new THREE.Group(); g.name = name + '_ring';
  const geo = new THREE.CylinderGeometry(r, r, h, 10); geo.rotateZ(Math.PI / 2);
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const b = mesh(geo, mat, `${name}_${i}`, g);
    b.position.set(x, Math.cos(a) * radius, Math.sin(a) * radius);
  }
  parent && parent.add(g);
  return g;
}
/* ribbed / louvred face detail */
function louvres(count, w, h, gap, mat, name, parent, origin, axis = 'x') {
  for (let i = 0; i < count; i++) {
    const m = box(axis === 'x' ? w : 0.012, h, axis === 'x' ? 0.012 : w, mat, `${name}_${i}`, parent);
    if (axis === 'x') m.position.set(origin[0], origin[1], origin[2] + i * gap);
    else m.position.set(origin[0] + i * gap, origin[1], origin[2]);
  }
}

/* ----------------------- turbocharger ----------------------- */
function turbo(name, heat) {
  const g = new THREE.Group(); g.name = name;
  // turbine (exhaust) volute
  const tv = mesh(new THREE.TorusGeometry(0.16, 0.085, 14, 28, Math.PI * 1.75), MAT.heat, name + '_turbine_volute', g);
  tv.rotation.y = Math.PI / 2; tv.position.x = 0.13;
  tubeX(0.10, 0.10, 0.13, 26, MAT.heat, name + '_turbine_inlet', g, [0.24, 0, 0]);
  // bearing housing
  tubeX(0.075, 0.075, 0.16, 22, MAT.alu, name + '_bearing_housing', g, [0.02, 0, 0]);
  mesh(new THREE.TorusGeometry(0.085, 0.02, 8, 22), MAT.steel, name + '_oil_flange', g).rotation.y = Math.PI / 2;
  // compressor volute
  const cv = mesh(new THREE.TorusGeometry(0.15, 0.075, 14, 28, Math.PI * 1.8), MAT.alu, name + '_compressor_volute', g);
  cv.rotation.y = Math.PI / 2; cv.position.x = -0.11;
  tubeX(0.115, 0.115, 0.05, 26, MAT.alu, name + '_compressor_inlet', g, [-0.19, 0, 0]);
  tubeX(0.10, 0.10, 0.20, 22, MAT.alu, name + '_air_outlet', g, [-0.14, 0.20, 0]).rotation.z = Math.PI / 2;
  // spinning wheels
  const wheel = new THREE.Group(); wheel.name = name + '_rotor';
  tubeX(0.03, 0.03, 0.42, 14, MAT.steel, name + '_shaft', wheel);
  for (let s = 0; s < 2; s++) {
    const hubX = s ? 0.13 : -0.11;
    tubeX(0.05, 0.075, 0.06, 20, MAT.steel, name + (s ? '_turbine_hub' : '_compressor_hub'), wheel, [hubX, 0, 0]);
    for (let i = 0; i < 11; i++) {
      const bl = box(0.055, 0.115, 0.008, s ? MAT.steel : MAT.alu, `${name}_${s ? 'turb' : 'comp'}_blade_${i}`, wheel);
      const a = (i / 11) * Math.PI * 2;
      bl.position.set(hubX, Math.cos(a) * 0.085, Math.sin(a) * 0.085);
      bl.rotation.x = -a; bl.rotation.y = s ? 0.5 : -0.55;
    }
  }
  g.add(wheel);
  heat.push(MAT.heat);
  return { group: g, wheel };
}

/* --------------------------- assembly --------------------------- */
export function buildGenset() {
  const root = new THREE.Group(); root.name = 'cat_cg170b_20';
  const parts = [];
  const anim = { pistons: [], turbos: [], heatMats: [MAT.heat] };
  const add = (group, cfg) => {
    group.userData.home = group.position.clone();
    parts.push({ ...cfg, object: group, explode: new THREE.Vector3(...cfg.ex) });
    root.add(group);
    return group;
  };
  const { bore, stroke, rod, pitch, vAngle } = SPEC;
  const r = stroke / 2;
  const xOf = i => (i - 4.5) * pitch;            // 10 cylinders per bank
  const deckMin = rod - r, deckMax = rod + r;    // piston pin travel

  /* 1 — SKID / taşıyıcı şasi */
  const skid = new THREE.Group(); skid.name = 'base_frame';
  for (const z of [-0.92, 0.92]) {
    box(9.0, 0.09, 0.26, MAT.skid, `skid_beam_top_${z}`, skid, [0.2, -0.62, z]);
    box(9.0, 0.09, 0.26, MAT.skid, `skid_beam_bottom_${z}`, skid, [0.2, -0.86, z]);
    box(9.0, 0.15, 0.028, MAT.skid, `skid_beam_web_${z}`, skid, [0.2, -0.74, z]);
  }
  for (let i = 0; i < 8; i++) {
    box(0.10, 0.22, 1.84, MAT.skid, `skid_cross_${i}`, skid, [-4.0 + i * 1.2, -0.74, 0]);
  }
  for (let i = 0; i < 6; i++) {
    const zz = i % 2 ? 0.92 : -0.92, xx = -3.4 + Math.floor(i / 2) * 3.4;
    tubeY(0.11, 0.11, 0.14, 18, MAT.rubber, `vibration_isolator_${i}`, skid, [xx, -0.98, zz]);
    box(0.30, 0.03, 0.30, MAT.skid, `isolator_pad_${i}`, skid, [xx, -1.06, zz]);
  }
  box(0.9, 0.16, 1.5, MAT.skid, 'oil_sump_tank', skid, [-3.5, -0.44, 0]);
  skid.position.set(0, 0, 0);
  add(skid, {
    key: 'skid', label: 'Taşıyıcı şasi & titreşim takozları', ex: [0, -3.4, 0],
    desc: 'Motor ile alternatörü tek eksende tutan kaynaklı çelik şasi.'
  });

  /* 2 — karter / yağ teknesi */
  const pan = new THREE.Group(); pan.name = 'oil_pan';
  box(3.5, 0.30, 0.98, MAT.yellow, 'oil_pan_body', pan, [0, -0.44, 0]);
  box(3.62, 0.05, 1.08, MAT.yellowDark, 'oil_pan_rail', pan, [0, -0.28, 0]);
  box(0.55, 0.12, 0.7, MAT.yellowDark, 'oil_pan_deep_section', pan, [-0.9, -0.63, 0]);
  tubeY(0.045, 0.045, 0.10, 14, MAT.bolt, 'oil_drain_plug', pan, [-0.9, -0.72, 0]);
  tubeX(0.075, 0.075, 0.5, 20, MAT.alu, 'oil_suction_pipe', pan, [0.9, -0.42, 0.3]);
  box(0.34, 0.5, 0.34, MAT.alu, 'lube_oil_filter_bank', pan, [1.5, -0.34, 0.62]);
  pan.position.set(0, 0, 0);
  add(pan, {
    key: 'pan', label: 'Yağ teknesi & yağlama grubu', ex: [-0.6, -1.9, 0],
    desc: 'Basınçlı yağlama devresinin emiş ve filtre grubunu taşıyan derin karter.'
  });

  /* 3 — blok / karter gövdesi (60° V) */
  const block = new THREE.Group(); block.name = 'cylinder_block';
  box(3.5, 0.62, 0.96, MAT.yellow, 'crankcase', block, [0, 0.03, 0], true);
  box(3.56, 0.07, 1.02, MAT.yellowDark, 'crankcase_top_rail', block, [0, 0.30, 0]);
  for (const s of [1, -1]) {
    const bank = new THREE.Group(); bank.name = s > 0 ? 'bank_A_wall' : 'bank_B_wall';
    bank.rotation.x = -s * vAngle;
    const wall = box(3.5, 0.62, 0.46, MAT.yellow, 'bank_wall', bank, [0, 0.55, 0], true);
    wall.rotation.x = 0;
    box(3.56, 0.06, 0.52, MAT.yellowDark, 'deck_face', bank, [0, 0.87, 0]);
    for (let i = 0; i < 10; i++) box(0.16, 0.5, 0.06, MAT.yellowDark, `web_${i}`, bank, [xOf(i), 0.55, 0.25], true);
    block.add(bank);
    // side inspection covers
    for (let i = 0; i < 5; i++) {
      const c = box(0.5, 0.28, 0.03, MAT.yellowDark, `inspection_cover_${s}_${i}`, block, [-1.4 + i * 0.7, -0.05, s * 0.49]);
      boltRingX(0.1, 4, 0.014, 0.03, MAT.bolt, `cover_bolt_${s}_${i}`, c);
    }
  }
  box(0.42, 0.66, 0.9, MAT.yellow, 'front_gear_cover', block, [-1.86, 0.05, 0]);
  tubeX(0.2, 0.2, 0.18, 26, MAT.steel, 'vibration_damper', block, [-2.12, 0, 0]);
  box(0.5, 0.42, 0.44, MAT.alu, 'water_pump', block, [-1.9, -0.2, 0.6]);
  box(0.46, 0.6, 0.5, MAT.alu, 'oil_cooler_module', block, [1.6, -0.05, -0.66]);
  // blok yan yüzündeki model plakası (paslanmaz, gravür yazı)
  for (const s of [1, -1]) {
    const plateBody = box(0.62, 0.2, 0.012, MAT.steel, `nameplate_body_${s}`, block, [-0.75, 0.12, s * 0.485]);
    plateBody.castShadow = false;
    const d = decalPlane(decal(['CG170-20'], {
      w: 640, h: 200, color: '#1a1c20', border: 'rgba(26,28,32,.45)',
      sub: '20 CYL · 60° V · 170 × 195 mm'
    }), 0.6, 0.19);
    d.name = `nameplate_text_${s}`;
    d.position.set(-0.75, 0.12, s * 0.4925 + (s > 0 ? 0.001 : -0.001));
    if (s < 0) d.rotation.y = Math.PI;
    block.add(d);
  }
  block.position.set(0, 0, 0);
  add(block, {
    key: 'block', label: 'Silindir bloğu — 60° V', ex: [0, 0, 0],
    desc: '20 silindirin iki banka 60° açıyla yerleştiği tek parça döküm blok.'
  });

  /* 4 — krank mili */
  const crank = new THREE.Group(); crank.name = 'crankshaft';
  const spin = new THREE.Group(); spin.name = 'crank_rotating'; crank.add(spin);
  tubeX(0.105, 0.105, 3.3, 26, MAT.steel, 'main_journal_shaft', spin);
  for (let i = 0; i < 10; i++) {
    const a = (i * 2) % 10 * (Math.PI * 2 / 10) * 2;    // 72° throw spacing
    const th = new THREE.Group(); th.name = `throw_${i + 1}`;
    th.rotation.x = a; th.position.x = xOf(i);
    tubeX(0.075, 0.075, 0.18, 18, MAT.steel, `crank_pin_${i + 1}`, th, [0, r, 0]);
    for (const s of [-1, 1]) {
      const cw = mesh(new THREE.CylinderGeometry(0.20, 0.20, 0.06, 20, 1, false, -0.9, 1.8), MAT.steel, `counterweight_${i + 1}_${s}`, th);
      cw.geometry.rotateZ(Math.PI / 2); cw.position.set(s * 0.13, -0.02, 0); cw.rotation.x = Math.PI;
      box(0.05, 0.30, 0.13, MAT.steel, `web_${i + 1}_${s}`, th, [s * 0.13, r / 2, 0]);
    }
    spin.add(th);
  }
  tubeX(0.16, 0.16, 0.12, 24, MAT.steel, 'crank_rear_flange', spin, [1.72, 0, 0]);
  crank.position.set(0, 0, 0);
  add(crank, {
    key: 'crank', label: 'Krank mili & ana yataklar', ex: [0, -1.15, 0],
    desc: '10 kollu dövme krank; her kolda iki silindir çalışır, 36°’de bir ateşleme olur.'
  });
  anim.crank = spin;

  /* 5/6 — piston + gömlek grupları (banka A / B) */
  ['A', 'B'].forEach((tag, bi) => {
    const s = bi === 0 ? 1 : -1;
    const g = new THREE.Group(); g.name = `piston_group_${tag}`;
    for (let i = 0; i < 10; i++) {
      const cyl = new THREE.Group(); cyl.name = `cylinder_${tag}${i + 1}`;
      cyl.rotation.x = -s * vAngle; cyl.position.x = xOf(i);
      const holder = new THREE.Group(); holder.rotation.x = 0; cyl.add(holder);
      tubeY(bore / 2 + 0.016, bore / 2 + 0.016, 0.40, 26, MAT.steel, `liner_${tag}${i + 1}`, holder, [0, 0.42, 0], true);
      const piston = new THREE.Group(); piston.name = `piston_${tag}${i + 1}`;
      tubeY(bore / 2, bore / 2, 0.15, 26, MAT.alu, `piston_crown_${tag}${i + 1}`, piston, [0, 0.015, 0]);
      for (let k = 0; k < 3; k++) tubeY(bore / 2 + 0.002, bore / 2 + 0.002, 0.008, 26, MAT.steel, `ring_${k}`, piston, [0, 0.052 - k * 0.017, 0]);
      holder.add(piston);
      const rodG = new THREE.Group(); rodG.name = `con_rod_${tag}${i + 1}`;
      box(0.055, rod * 0.82, 0.10, MAT.steel, 'rod_beam', rodG, [0, -rod * 0.44, 0]);
      tubeX(0.05, 0.05, 0.11, 16, MAT.steel, 'small_end', rodG, [0, -0.01, 0]);
      const be = tubeX(0.085, 0.085, 0.17, 18, MAT.steel, 'big_end', rodG, [0, -rod, 0]);
      be.userData.big = true;
      holder.add(rodG);
      g.add(cyl);
      anim.pistons.push({ piston, rod: rodG, angle: (i * 2) % 10 * (Math.PI * 2 / 10) * 2, bank: s });
    }
    g.position.set(0, 0, 0);
    add(g, {
      key: 'piston' + tag, label: `Piston & gömlek — banka ${tag}`, ex: [0, 1.25 * 1, s * 1.55],
      desc: 'Ø170 mm piston, 195 mm strok. Islak gömlekler blok sökülmeden tek tek değişir.'
    });
  });

  /* 7/8 — silindir kapakları + supap kapağı */
  ['A', 'B'].forEach((tag, bi) => {
    const s = bi === 0 ? 1 : -1;
    const g = new THREE.Group(); g.name = `head_group_${tag}`;
    const bank = new THREE.Group(); bank.rotation.x = -s * vAngle; g.add(bank);
    for (let i = 0; i < 10; i++) {
      const h = box(0.27, 0.22, 0.44, MAT.yellow, `cylinder_head_${tag}${i + 1}`, bank, [xOf(i), 0.75, 0], tag === 'A');
      boltRingX(0.15, 4, 0.018, 0.28, MAT.bolt, `head_stud_${tag}${i + 1}`, bank, xOf(i)).position.y = 0.75;
      const plug = tubeY(0.03, 0.03, 0.16, 12, MAT.steel, `spark_plug_tube_${tag}${i + 1}`, bank, [xOf(i), 0.94, 0]);
      plug.castShadow = false;
      box(0.09, 0.05, 0.09, MAT.black, `ignition_coil_${tag}${i + 1}`, bank, [xOf(i), 1.04, 0]);
      h.userData.idx = i;
    }
    box(3.2, 0.16, 0.40, MAT.yellow, `valve_cover_${tag}`, bank, [0, 1.02, 0.02], tag === 'A');
    box(3.24, 0.03, 0.44, MAT.yellowDark, `valve_cover_lip_${tag}`, bank, [0, 0.93, 0.02]);
    // dökme kapak üstündeki marka yazısı
    [-1.0, 0.55].forEach((dx, i) => {
      const d = decalPlane(decal('CAT', { w: 512, h: 200, color: '#111316' }), 0.42, 0.165);
      d.name = `valve_cover_mark_${tag}${i}`;
      d.position.set(dx, 1.101, 0.02);
      d.rotation.x = -Math.PI / 2;
      bank.add(d);
    });
    louvres(11, 0.024, 0.10, 0.30, MAT.yellowDark, `cover_rib_${tag}`, bank, [-1.5, 1.10, 0.02], 'y');
    g.position.set(0, 0, 0);
    add(g, {
      key: 'head' + tag, label: `Silindir kapakları — banka ${tag}`, ex: [0, 2.15, s * 2.55],
      desc: 'Silindir başına dört supap ve merkezî ateşleme bujisi; kapaklar tek tek sökülebilir.'
    });
  });

  /* 9/10 — egzoz manifoldları */
  ['A', 'B'].forEach((tag, bi) => {
    const s = bi === 0 ? 1 : -1;
    const g = new THREE.Group(); g.name = `exhaust_manifold_${tag}`;
    const bank = new THREE.Group(); bank.rotation.x = -s * vAngle; g.add(bank);
    tubeX(0.10, 0.10, 3.3, 22, MAT.heat, `manifold_pipe_${tag}`, bank, [0, 0.72, 0.46]);
    tubeX(0.125, 0.125, 3.34, 24, MAT.insul, `manifold_insulation_${tag}`, bank, [0, 0.72, 0.46]);
    for (let i = 0; i < 10; i++) {
      const rz = tubeY(0.062, 0.062, 0.22, 16, MAT.heat, `riser_${tag}${i + 1}`, bank, [xOf(i), 0.80, 0.28]);
      rz.rotation.x = 0.9;
      const fl = box(0.03, 0.16, 0.16, MAT.steel, `riser_flange_${tag}${i + 1}`, bank, [xOf(i), 0.76, 0.19]);
      fl.rotation.z = Math.PI / 2;
    }
    tubeX(0.13, 0.13, 0.5, 22, MAT.insul, `manifold_outlet_${tag}`, bank, [-1.75, 0.72, 0.46]);
    g.position.set(0, 0, 0);
    add(g, {
      key: 'exh' + tag, label: `Egzoz manifoldu — banka ${tag}`, ex: [0, 1.05, s * 3.6],
      desc: 'İzolasyon ceketli kuru manifold; egzoz enerjisini turboya taşır (yaklaşık 450–500 °C).'
    });
  });

  /* 11 — turbo grubu */
  const turbos = new THREE.Group(); turbos.name = 'turbocharger_group';
  for (const s of [1, -1]) {
    const t = turbo(s > 0 ? 'turbo_A' : 'turbo_B', anim.heatMats);
    t.group.position.set(-2.35, 0.62, s * 0.52);
    t.group.rotation.y = s > 0 ? 0 : Math.PI;
    turbos.add(t.group);
    anim.turbos.push(t.wheel);
    box(0.3, 0.34, 0.3, MAT.skid, `turbo_bracket_${s}`, turbos, [-2.35, 0.32, s * 0.52]);
  }
  turbos.position.set(0, 0, 0);
  add(turbos, {
    key: 'turbo', label: 'İki kademeli turboşarj grubu', ex: [-3.0, 1.5, 0],
    desc: 'Her banka için bir turbo; egzoz gazı türbini besler, kompresör yakma havasını basar.'
  });

  /* 12 — karışım soğutucu (SCAC) */
  const cooler = new THREE.Group(); cooler.name = 'mixture_cooler';
  box(1.25, 0.52, 0.86, MAT.alu, 'cooler_core', cooler, [0, 0, 0]);
  louvres(22, 1.19, 0.44, 0.036, MAT.skid, 'cooler_fin', cooler, [0, 0, -0.38]);
  box(1.31, 0.10, 0.92, MAT.yellowDark, 'cooler_tank_top', cooler, [0, 0.30, 0]);
  box(1.31, 0.10, 0.92, MAT.yellowDark, 'cooler_tank_bottom', cooler, [0, -0.30, 0]);
  tubeX(0.075, 0.075, 0.3, 16, MAT.alu, 'coolant_in', cooler, [-0.72, 0.30, 0.3]);
  tubeX(0.075, 0.075, 0.3, 16, MAT.alu, 'coolant_out', cooler, [-0.72, -0.30, 0.3]);
  cooler.position.set(-1.15, 1.35, 0);
  add(cooler, {
    key: 'cooler', label: 'Karışım soğutucu (SCAC)', ex: [-1.9, 2.4, 0],
    desc: 'Sıkıştırılmış hava–gaz karışımını soğutur; dolgu verimini ve vuruntu payını artırır.'
  });

  /* 13 — gaz karıştırıcı & emme manifoldu */
  const intake = new THREE.Group(); intake.name = 'gas_mixer_intake';
  box(3.1, 0.30, 0.46, MAT.alu, 'intake_plenum', intake, [0.1, 0.80, 0]);
  for (const s of [1, -1]) for (let i = 0; i < 10; i++) {
    const p = tubeY(0.055, 0.055, 0.26, 14, MAT.alu, `intake_runner_${s}_${i}`, intake, [xOf(i) + 0.1, 0.80, s * 0.34]);
    p.rotation.x = s * 1.05;
  }
  tubeX(0.14, 0.14, 0.46, 24, MAT.alu, 'venturi_gas_mixer', intake, [-1.85, 0.86, 0]);
  tubeY(0.09, 0.09, 0.26, 18, MAT.black, 'gas_train_inlet', intake, [-1.85, 1.06, 0]);
  box(0.26, 0.26, 0.3, MAT.black, 'throttle_actuator', intake, [-1.5, 0.98, 0.24]);
  box(0.34, 0.2, 0.26, MAT.yellowDark, 'waste_gate', intake, [-1.2, 0.72, -0.3]);
  intake.position.set(0, 0, 0);
  add(intake, {
    key: 'intake', label: 'Gaz karıştırıcı & emme manifoldu', ex: [0.9, 3.15, 0],
    desc: 'Venturi karıştırıcı gazı hava ile oranlar; kelebek vana yükü, atık gaz vanası dolguyu ayarlar.'
  });

  /* 14 — volan & kavrama */
  const fly = new THREE.Group(); fly.name = 'flywheel_housing';
  const bell = tubeX(0.62, 0.68, 0.34, 34, MAT.yellow, 'flywheel_housing_bell', fly, [0, 0, 0]);
  bell.userData.ghost = true;
  boltRingX(0.62, 14, 0.019, 0.05, MAT.bolt, 'housing_bolt', fly, -0.17);
  const wheel = new THREE.Group(); wheel.name = 'flywheel_rotating';
  tubeX(0.52, 0.52, 0.12, 40, MAT.steel, 'flywheel_disc', wheel, [0.05, 0, 0]);
  tubeX(0.55, 0.55, 0.05, 90, MAT.steel, 'ring_gear', wheel, [0.11, 0, 0]);
  tubeX(0.30, 0.30, 0.06, 26, MAT.steel, 'flex_coupling_plate', wheel, [0.17, 0, 0]);
  boltRingX(0.42, 12, 0.02, 0.09, MAT.bolt, 'coupling_bolt', wheel, 0.14);
  fly.add(wheel);
  box(0.3, 0.34, 0.28, MAT.black, 'starter_motor', fly, [-0.1, -0.42, 0.5]);
  fly.position.set(2.05, 0, 0);
  add(fly, {
    key: 'fly', label: 'Volan, elastik kavrama & muhafaza', ex: [2.0, 0, 0],
    desc: 'Volan dönüş düzgünlüğünü sağlar; elastik kavrama torku alternatöre burulma titreşimi olmadan iletir.'
  });
  anim.flywheel = wheel;

  /* 15 — alternatör */
  const alt = new THREE.Group(); alt.name = 'alternator';
  const shell = tubeX(0.72, 0.72, 2.1, 40, MAT.yellow, 'alternator_shell', alt, [0, 0, 0]);
  shell.userData.ghost = true;
  tubeX(0.74, 0.74, 0.07, 40, MAT.yellowDark, 'alt_end_ring_de', alt, [-1.02, 0, 0]);
  tubeX(0.74, 0.74, 0.07, 40, MAT.yellowDark, 'alt_end_ring_nde', alt, [1.02, 0, 0]);
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2;
    const v = box(1.6, 0.03, 0.09, MAT.yellowDark, `alt_vent_${i}`, alt);
    v.position.set(0, Math.cos(a) * 0.735, Math.sin(a) * 0.735); v.rotation.x = -a;
  }
  const rotor = new THREE.Group(); rotor.name = 'alternator_rotor';
  tubeX(0.5, 0.5, 1.6, 30, MAT.copper, 'rotor_poles', rotor);
  tubeX(0.14, 0.14, 2.4, 20, MAT.steel, 'rotor_shaft', rotor);
  for (let i = 0; i < 12; i++) {
    const bl = box(0.10, 0.16, 0.02, MAT.alu, `cooling_fan_blade_${i}`, rotor);
    const a = (i / 12) * Math.PI * 2;
    bl.position.set(-1.12, Math.cos(a) * 0.30, Math.sin(a) * 0.30);
    bl.rotation.x = -a; bl.rotation.y = 0.6;
  }
  alt.add(rotor);
  box(0.9, 0.55, 0.9, MAT.yellow, 'terminal_box', alt, [0.45, 0.78, 0]);
  box(0.94, 0.05, 0.94, MAT.yellowDark, 'terminal_box_lid', alt, [0.45, 1.08, 0]);
  {
    const dp = decalPlane(decal(['2 000 ekW'], {
      w: 640, h: 220, color: '#1a1c20', border: 'rgba(26,28,32,.4)',
      sub: ['1500 rpm · 50 Hz · 4 POLE', 'IP23 · H CLASS']
    }), 0.46, 0.16);
    dp.name = 'alternator_data_plate';
    dp.position.set(0.45, 0.79, 0.455);
    alt.add(dp);
    const wr = decalPlane(decal(['! HIGH VOLTAGE'], {
      w: 640, h: 170, color: '#8a1010', font: '700 74px "Barlow Condensed", Impact, sans-serif'
    }), 0.44, 0.12);
    wr.name = 'warning_decal_hv';
    wr.position.set(0.45, 1.111, 0.12);
    wr.rotation.x = -Math.PI / 2;
    alt.add(wr);
  }
  for (let i = 0; i < 3; i++) tubeY(0.05, 0.05, 0.2, 12, MAT.copper, `bus_bar_${i}`, alt, [0.25 + i * 0.2, 1.14, 0.2]);
  for (const s of [1, -1]) box(0.6, 0.26, 0.22, MAT.skid, `alt_foot_${s}`, alt, [s * 0.7, -0.72, 0]);
  alt.position.set(3.55, 0, 0);
  add(alt, {
    key: 'alt', label: 'Senkron alternatör — 2 000 ekW', ex: [3.7, 0, 0],
    desc: 'Fırçasız senkron alternatör. 1500 dev/dak × 4 kutup = 50 Hz şebeke frekansı.'
  });
  anim.rotor = rotor;

  /* 16 — kontrol panosu */
  const cab = new THREE.Group(); cab.name = 'control_cabinet';
  box(1.05, 1.9, 0.5, MAT.yellow, 'cabinet_body', cab, [0, 0.3, 0]);
  box(1.0, 0.9, 0.03, MAT.black, 'cabinet_door_face', cab, [0, 0.62, 0.26]);
  box(0.62, 0.4, 0.02, MAT.glass, 'operator_display', cab, [0, 0.72, 0.28]);
  for (let i = 0; i < 4; i++) tubeX(0.026, 0.026, 0.03, 12, MAT.bolt, `panel_button_${i}`, cab, [-0.3 + i * 0.2, 0.34, 0.28]);
  {
    const d = decalPlane(decal(['TPEM'], {
      w: 640, h: 200, color: '#f0c200', sub: 'ENGINE & GENERATOR CONTROL'
    }), 0.6, 0.19);
    d.name = 'cabinet_legend';
    d.position.set(0, 0.24, 0.283);
    cab.add(d);
  }
  box(1.11, 0.06, 0.56, MAT.yellowDark, 'cabinet_roof', cab, [0, 1.28, 0]);
  louvres(8, 0.9, 0.02, 0.04, MAT.yellowDark, 'cabinet_louvre', cab, [0, -0.2, -0.16]);
  cab.position.set(0.6, -0.05, -1.55);
  add(cab, {
    key: 'cab', label: 'TPEM kontrol panosu', ex: [0, 0.5, -3.1],
    desc: 'Motor–jeneratör kontrolü, senkronizasyon ve koruma röleleri tek panoda.'
  });

  // merkeze al
  const b3 = new THREE.Box3().setFromObject(root);
  const c = b3.getCenter(new THREE.Vector3());
  root.children.forEach(ch => { ch.position.x -= c.x; ch.userData.home.x -= c.x; });

  // ghost’lanacak malzemeleri klonla (paylaşımlı malzemeyi bozmamak için)
  const ghostMats = new Set();
  root.traverse(o => {
    if (o.isMesh && o.userData.ghost) {
      o.material = o.material.clone();
      o.material.transparent = true;
      ghostMats.add(o.material);
    }
  });
  anim.ghostMats = [...ghostMats];

  return { root, parts, anim, SPEC };
}
