import * as THREE from 'three';
import { orangePeel, sandCast, brushed, machined, decal, decalPlane } from './cg170b-textures.js';

/* ---------------------------------------------------------------
   CAT CG170B-20 — gerçek fotoğraflara göre yeniden kurulmuş model
   Birim: metre. Krank ekseni +X; krank merkezi y = 0.
   Referans mimari: derin kutu kaynaklı şasi + titreşim takozları,
   60° V20 blok (kemerli yan kapaklar), banka başına 10 ayrı kapak,
   parlak izolasyon kılıflı egzoz manifoldu, V vadisinde emme plenumu,
   ön üstte iki dikey hava filtresi + iki turbo + karışım soğutucu,
   koyu egzoz genleşme bağlantısı, kapalı sarı alternatör muhafazası
   (dış yüzünde panjur ızgara) ve üstünde büyük klemens kutusu.
---------------------------------------------------------------- */

export const SPEC = {
  bore: 0.170, stroke: 0.195, rod: 0.360, cylinders: 16, vAngle: 30 * Math.PI / 180,
  pitch: 0.300, rpm: 1500, kw: 1600, hz: 50,
  length: 8.4, width: 2.05, height: 2.9
};

export const MAT = {
  yellow: new THREE.MeshStandardMaterial({ name: 'cat_yellow_metallic', color: 0xe6b514, roughness: 0.30, metalness: 0.52 }),
  yellowDark: new THREE.MeshStandardMaterial({ name: 'cat_yellow_metallic_shade', color: 0xb98d06, roughness: 0.36, metalness: 0.5 }),
  yellowCast: new THREE.MeshStandardMaterial({ name: 'cat_yellow_cast', color: 0xd0a410, roughness: 0.44, metalness: 0.42 }),
  black: new THREE.MeshStandardMaterial({ name: 'cat_black', color: 0x1a1c1e, roughness: 0.52, metalness: 0.25 }),
  rubber: new THREE.MeshStandardMaterial({ name: 'rubber', color: 0x121314, roughness: 0.86, metalness: 0.05 }),
  darkPipe: new THREE.MeshStandardMaterial({ name: 'exhaust_expansion', color: 0x4a4d50, roughness: 0.62, metalness: 0.6 }),
  skid: new THREE.MeshStandardMaterial({ name: 'skid_black_steel', color: 0x1b1d20, roughness: 0.45, metalness: 0.88 }),
  steel: new THREE.MeshStandardMaterial({ name: 'forged_steel', color: 0x8d939a, roughness: 0.34, metalness: 0.95 }),
  alu: new THREE.MeshStandardMaterial({ name: 'cast_aluminium', color: 0xa9aeb3, roughness: 0.5, metalness: 0.72 }),
  bright: new THREE.MeshStandardMaterial({ name: 'bright_stainless_shield', color: 0xd2d6da, roughness: 0.24, metalness: 0.96 }),
  insul: new THREE.MeshStandardMaterial({ name: 'exhaust_insulation', color: 0xbfc4c9, roughness: 0.44, metalness: 0.6 }),
  heat: new THREE.MeshStandardMaterial({ name: 'exhaust_pipe_hot', color: 0x6d6864, roughness: 0.62, metalness: 0.8, emissive: 0xff3b00, emissiveIntensity: 0 }),
  copper: new THREE.MeshStandardMaterial({ name: 'copper_winding', color: 0xb1703c, roughness: 0.4, metalness: 0.9 }),
  glass: new THREE.MeshStandardMaterial({ name: 'panel_screen', color: 0x0d2b2a, roughness: 0.16, metalness: 0.3, emissive: 0x0e5c50, emissiveIntensity: 0.25 }),
  bolt: new THREE.MeshStandardMaterial({ name: 'zinc_bolt', color: 0xb6babd, roughness: 0.36, metalness: 1.0 })
};

/* yüzey dokuları: boya portakal kabuğu, döküm greni, fırça izleri */
{
  const peel = orangePeel(4), peelD = orangePeel(3);
  const cast = sandCast(6), castFine = sandCast(3);
  const brush = brushed(3), brushSkid = brushed(6), brushFine = brushed(2);
  const mach = machined(1);
  const skin = (mat, maps, nScale, env) => {
    Object.assign(mat, maps);
    if (maps.normalMap) mat.normalScale = new THREE.Vector2(nScale, nScale);
    mat.envMapIntensity = env;
    mat.needsUpdate = true;
  };
  skin(MAT.yellow, peel, 0.24, 1.45);
  skin(MAT.yellowDark, peelD, 0.28, 1.3);
  skin(MAT.yellowCast, cast, 0.42, 1.15);
  skin(MAT.alu, cast, 0.6, 1.1);
  skin(MAT.bright, brushFine, 0.3, 1.5);
  skin(MAT.insul, castFine, 0.45, 0.95);
  skin(MAT.heat, cast, 0.75, 0.8);
  skin(MAT.darkPipe, castFine, 0.55, 0.8);
  skin(MAT.steel, brush, 0.42, 1.35);
  skin(MAT.skid, brushSkid, 0.45, 1.3);
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
function tubeX(rT, rB, len, seg, mat, name, parent, pos, open) {
  const g = new THREE.CylinderGeometry(rT, rB, len, seg, 1, !!open);
  g.rotateZ(Math.PI / 2);
  const m = mesh(g, mat, name, parent);
  if (pos) m.position.set(pos[0], pos[1] || 0, pos[2] || 0);
  return m;
}
function tubeY(rT, rB, len, seg, mat, name, parent, pos, open) {
  const m = mesh(new THREE.CylinderGeometry(rT, rB, len, seg, 1, !!open), mat, name, parent);
  if (pos) m.position.set(pos[0], pos[1], pos[2]);
  return m;
}
function tubeZ(rT, rB, len, seg, mat, name, parent, pos) {
  const g = new THREE.CylinderGeometry(rT, rB, len, seg);
  g.rotateX(Math.PI / 2);
  const m = mesh(g, mat, name, parent);
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
    b.castShadow = false;
  }
  parent && parent.add(g);
  return g;
}
/* körük (bellows): kısa üst üste bilezikler */
function bellowsX(r, len, rings, mat, name, parent, pos) {
  const g = new THREE.Group(); g.name = name;
  for (let i = 0; i < rings; i++) {
    const t = mesh(new THREE.TorusGeometry(r, r * 0.16, 8, 20), mat, `${name}_ring_${i}`, g);
    t.rotation.y = Math.PI / 2;
    t.position.x = -len / 2 + (i + 0.5) * (len / rings);
    t.castShadow = false;
  }
  tubeX(r * 0.92, r * 0.92, len, 18, mat, name + '_core', g);
  if (pos) g.position.set(pos[0], pos[1], pos[2]);
  parent && parent.add(g);
  return g;
}
function louvrePanel(w, h, count, mat, name, parent, pos, rotY = 0) {
  const g = new THREE.Group(); g.name = name;
  for (let i = 0; i < count; i++) {
    const s = box(0.035, h / count * 0.78, w, mat, `${name}_slat_${i}`, g,
      [0, -h / 2 + (i + 0.5) * (h / count), 0]);
    s.rotation.z = -0.55; s.castShadow = false;
  }
  g.rotation.y = rotY;
  if (pos) g.position.set(pos[0], pos[1], pos[2]);
  parent && parent.add(g);
  return g;
}

/* ------------------------- turboşarj ------------------------- */
function makeTurbo(name, heatMats) {
  const g = new THREE.Group(); g.name = name;
  // türbin tarafı (sıcak, izolasyonlu)
  const tv = mesh(new THREE.TorusGeometry(0.21, 0.115, 16, 30, Math.PI * 1.8), MAT.insul, name + '_turbine_volute', g);
  tv.rotation.y = Math.PI / 2; tv.position.x = 0.16;
  tubeX(0.13, 0.13, 0.16, 26, MAT.insul, name + '_turbine_inlet', g, [0.32, 0, 0]);
  // yatak gövdesi
  tubeX(0.095, 0.095, 0.2, 22, MAT.alu, name + '_bearing_housing', g, [0.0, 0, 0]);
  // kompresör tarafı (parlak döküm)
  const cv = mesh(new THREE.TorusGeometry(0.20, 0.10, 16, 30, Math.PI * 1.85), MAT.alu, name + '_compressor_volute', g);
  cv.rotation.y = Math.PI / 2; cv.position.x = -0.15;
  tubeX(0.15, 0.15, 0.07, 26, MAT.alu, name + '_compressor_inlet', g, [-0.26, 0, 0]);
  const rotor = new THREE.Group(); rotor.name = name + '_rotor';
  tubeX(0.035, 0.035, 0.5, 14, MAT.steel, name + '_shaft', rotor);
  for (let s = 0; s < 2; s++) {
    const hubX = s ? 0.16 : -0.15;
    tubeX(0.055, 0.09, 0.07, 20, MAT.steel, name + (s ? '_turbine_hub' : '_compressor_hub'), rotor, [hubX, 0, 0]);
    for (let i = 0; i < 12; i++) {
      const bl = box(0.06, 0.13, 0.009, s ? MAT.steel : MAT.alu, `${name}_${s ? 'turb' : 'comp'}_blade_${i}`, rotor);
      const a = (i / 12) * Math.PI * 2;
      bl.position.set(hubX, Math.cos(a) * 0.095, Math.sin(a) * 0.095);
      bl.rotation.x = -a; bl.rotation.y = s ? 0.5 : -0.55;
      bl.castShadow = false;
    }
  }
  g.add(rotor);
  heatMats.push(MAT.heat);
  return { group: g, rotor };
}

/* --------------------------- montaj --------------------------- */
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
  const CPB = SPEC.cylinders / 2;                 // banka başına silindir (V16 → 8)
  const xOf = i => (i - (CPB - 1) / 2) * pitch;
  const ENG = CPB * pitch + 0.9;                  // blok boyu
  const DECK = 0.60;                 // krank ekseninden kapak oturma yüzeyi

  /* ---------- 1 · derin kutu kaynaklı şasi + takozlar ---------- */
  const skid = new THREE.Group(); skid.name = 'base_frame';
  const SK_L = SPEC.length, SK_W = 2.05, TOP = -0.34, BOT = -1.02;
  for (const s of [1, -1]) {
    box(SK_L, TOP - BOT, 0.05, MAT.yellow, `skid_side_web_${s}`, skid, [0, (TOP + BOT) / 2, s * SK_W / 2]);
    box(SK_L + 0.1, 0.07, 0.20, MAT.yellow, `skid_top_flange_${s}`, skid, [0, TOP + 0.02, s * (SK_W / 2 + 0.03)]);
    box(SK_L + 0.1, 0.06, 0.16, MAT.yellowDark, `skid_bottom_flange_${s}`, skid, [0, BOT - 0.01, s * (SK_W / 2 + 0.01)]);
    // dikey takviye nervürleri
    for (let i = 0; i < 14; i++) {
      const rb = box(0.07, TOP - BOT - 0.12, 0.05, MAT.yellowDark, `skid_rib_${s}_${i}`, skid,
        [-SK_L / 2 + 0.35 + i * 0.6, (TOP + BOT) / 2, s * (SK_W / 2 + 0.03)]);
      rb.castShadow = false;
    }
    // yan servis kapakları
    for (let i = 0; i < 3; i++) {
      box(0.5, 0.3, 0.03, MAT.yellowDark, `skid_access_panel_${s}_${i}`, skid,
        [-2.0 + i * 2.4, -0.60, s * (SK_W / 2 + 0.045)]);
    }
  }
  box(SK_L, 0.06, SK_W - 0.1, MAT.yellowDark, 'skid_deck', skid, [0, TOP - 0.03, 0]);
  box(SK_L - 0.1, 0.05, SK_W - 0.1, MAT.skid, 'skid_floor', skid, [0, BOT + 0.03, 0]);
  for (let i = 0; i < 9; i++) {
    box(0.09, TOP - BOT - 0.1, SK_W - 0.12, MAT.skid, `skid_cross_member_${i}`, skid,
      [-SK_L / 2 + 0.4 + i * (SK_L - 0.8) / 8, (TOP + BOT) / 2, 0]).castShadow = false;
  }
  // titreşim takozları: taban plakası + konik takoz + bağlantı ayağı
  const mountX = [-3.75, -2.5, -1.25, 0, 1.25, 2.5, 3.75];
  for (const s of [1, -1]) mountX.forEach((mx, i) => {
    box(0.46, 0.05, 0.42, MAT.skid, `mount_base_plate_${s}_${i}`, skid, [mx, BOT - 0.16, s * (SK_W / 2 - 0.02)]);
    tubeY(0.14, 0.17, 0.12, 18, MAT.rubber, `isolator_${s}_${i}`, skid, [mx, BOT - 0.08, s * (SK_W / 2 - 0.02)]);
    box(0.34, 0.06, 0.34, MAT.yellowDark, `mount_bracket_${s}_${i}`, skid, [mx, BOT - 0.015, s * (SK_W / 2 - 0.02)]);
    for (const bs of [-1, 1]) tubeY(0.022, 0.022, 0.09, 10, MAT.bolt, `mount_bolt_${s}_${i}_${bs}`, skid,
      [mx + bs * 0.16, BOT - 0.16, s * (SK_W / 2 - 0.02)]).castShadow = false;
  });
  // kaldırma kulakları
  for (const s of [1, -1]) for (const ex of [-(SK_L / 2 - 0.15), SK_L / 2 - 0.15]) {
    const lug = box(0.06, 0.26, 0.3, MAT.skid, `lifting_lug_${s}_${ex}`, skid, [ex, TOP + 0.14, s * 0.7]);
    mesh(new THREE.TorusGeometry(0.075, 0.02, 8, 18), MAT.skid, `lug_eye_${s}_${ex}`, skid)
      .position.set(ex, TOP + 0.24, s * 0.7);
    lug.castShadow = false;
  }
  add(skid, {
    key: 'skid', label: 'Kutu kesitli taşıyıcı şasi', ex: [0, -3.6, 0],
    desc: 'Motor ve alternatörü tek eksende tutan derin kaynaklı çelik şasi; on dört konik takozla temelden izole edilir.'
  });

  /* ---------- 2 · yağ teknesi & yağlama grubu ---------- */
  const pan = new THREE.Group(); pan.name = 'oil_pan';
  box(ENG, 0.34, 1.1, MAT.yellow, 'oil_pan_body', pan, [0, -0.50, 0]);
  box(ENG + 0.1, 0.05, 1.2, MAT.yellowDark, 'oil_pan_rail', pan, [0, -0.32, 0]);
  box(0.7, 0.14, 0.8, MAT.yellowDark, 'oil_pan_sump', pan, [-0.6, -0.72, 0]);
  tubeY(0.05, 0.05, 0.1, 14, MAT.bolt, 'oil_drain', pan, [-0.6, -0.82, 0]);
  tubeX(0.11, 0.11, 0.9, 20, MAT.alu, 'oil_gallery_pipe', pan, [1.2, -0.46, 0.52]);
  box(0.4, 0.62, 0.4, MAT.alu, 'oil_filter_bank', pan, [1.75, -0.28, 0.62]);
  for (let i = 0; i < 3; i++) tubeY(0.1, 0.1, 0.4, 18, MAT.black, `oil_filter_can_${i}`, pan, [1.55 + i * 0.2, -0.08, 0.62]);
  box(0.5, 0.5, 0.34, MAT.alu, 'lube_oil_pump', pan, [-1.7, -0.42, 0.5]);
  add(pan, {
    key: 'pan', label: 'Yağ teknesi & yağlama grubu', ex: [-0.7, -2.0, 0],
    desc: 'Derin karter, dişli yağ pompası ve üç kartuşlu filtre bataryası — servis şasi içinden yapılır.'
  });

  /* ---------- 3 · blok (60° V, kemerli yan kapaklar) ---------- */
  const block = new THREE.Group(); block.name = 'cylinder_block';
  box(ENG, 0.68, 1.08, MAT.yellow, 'crankcase', block, [0, 0.0, 0], true);
  box(ENG + 0.06, 0.08, 1.16, MAT.yellowDark, 'crankcase_top_rail', block, [0, 0.30, 0]);
  box(ENG + 0.06, 0.07, 1.14, MAT.yellowDark, 'crankcase_bottom_rail', block, [0, -0.32, 0]);
  for (const s of [1, -1]) {
    // kemerli servis kapakları (fotoğraftaki karakteristik yan yüz)
    for (let i = 0; i < CPB; i++) {
      const cx = xOf(i);
      box(0.24, 0.34, 0.05, MAT.yellowCast, `arch_cover_${s}_${i}`, block, [cx, -0.10, s * 0.555]);
      const cap = tubeZ(0.12, 0.12, 0.05, 20, MAT.yellowCast, `arch_cap_${s}_${i}`, block, [cx, 0.07, s * 0.555]);
      cap.castShadow = false;
      for (const by of [-0.24, 0.16]) tubeZ(0.018, 0.018, 0.06, 8, MAT.bolt, `arch_bolt_${s}_${i}_${by}`, block,
        [cx, by, s * 0.575]).castShadow = false;
    }
    // banka duvarı
    const bank = new THREE.Group(); bank.name = s > 0 ? 'bank_A_wall' : 'bank_B_wall';
    bank.rotation.x = -s * vAngle;
    box(ENG, DECK - 0.16, 0.52, MAT.yellow, 'bank_wall', bank, [0, (DECK + 0.14) / 2, 0], true);
    box(ENG + 0.06, 0.06, 0.58, MAT.yellowDark, 'deck_face', bank, [0, DECK - 0.02, 0]);
    for (let i = 0; i < CPB; i++) box(0.18, DECK - 0.2, 0.06, MAT.yellowDark, `bank_web_${i}`, bank,
      [xOf(i), (DECK + 0.1) / 2, 0.28], true).castShadow = false;
    block.add(bank);
  }
  // ön dişli kapağı ve su pompaları
  box(0.46, 0.9, 1.0, MAT.yellow, 'front_gear_cover', block, [-(ENG / 2 + 0.11), 0.05, 0]);
  tubeX(0.24, 0.24, 0.2, 26, MAT.steel, 'vibration_damper', block, [-(ENG / 2 + 0.4), 0, 0]);
  for (const s of [1, -1]) {
    box(0.44, 0.44, 0.4, MAT.alu, `jacket_water_pump_${s}`, block, [-(ENG / 2 + 0.15), -0.16, s * 0.62]);
    tubeX(0.09, 0.09, 0.6, 18, MAT.alu, `water_manifold_${s}`, block, [-(ENG / 2 - 0.45), -0.2, s * 0.62]);
  }
  // model plakası
  for (const s of [1, -1]) {
    box(0.66, 0.22, 0.012, MAT.steel, `nameplate_body_${s}`, block, [0.75, 0.12, s * 0.545]).castShadow = false;
    const d = decalPlane(decal(['CG170-20'], {
      w: 640, h: 200, color: '#1a1c20', border: 'rgba(26,28,32,.45)',
      sub: '16 CYL · 60° V · 170 × 195 mm'
    }), 0.62, 0.2);
    d.name = `nameplate_text_${s}`;
    d.position.set(0.75, 0.12, s * 0.553);
    if (s < 0) d.rotation.y = Math.PI;
    block.add(d);
  }
  add(block, {
    key: 'block', label: 'Silindir bloğu — 60° V', ex: [0, 0, 0],
    desc: 'Kemerli yan kapaklarıyla tek parça döküm blok; iki banka 60° açıyla, 300 mm silindir aralığıyla yerleşir.'
  });

  /* ---------- 4 · krank mili ---------- */
  const crank = new THREE.Group(); crank.name = 'crankshaft';
  const spin = new THREE.Group(); spin.name = 'crank_rotating'; crank.add(spin);
  tubeX(0.115, 0.115, ENG - 0.4, 26, MAT.steel, 'main_journal_shaft', spin);
  for (let i = 0; i < CPB; i++) {
    const th = new THREE.Group(); th.name = `throw_${i + 1}`;
    th.rotation.x = ((i * 3) % CPB) * (Math.PI * 2 / CPB);
    th.position.x = xOf(i);
    tubeX(0.08, 0.08, 0.19, 18, MAT.steel, `crank_pin_${i + 1}`, th, [0, r, 0]);
    for (const s of [-1, 1]) {
      const cw = mesh(new THREE.CylinderGeometry(0.215, 0.215, 0.062, 20, 1, false, -0.95, 1.9), MAT.steel,
        `counterweight_${i + 1}_${s}`, th);
      cw.geometry.rotateZ(Math.PI / 2);
      cw.position.set(s * 0.135, -0.02, 0); cw.rotation.x = Math.PI;
      box(0.05, 0.31, 0.14, MAT.steel, `crank_web_${i + 1}_${s}`, th, [s * 0.135, r / 2, 0]).castShadow = false;
    }
    spin.add(th);
  }
  tubeX(0.17, 0.17, 0.12, 24, MAT.steel, 'crank_rear_flange', spin, [ENG / 2 - 0.13, 0, 0]);
  add(crank, {
    key: 'crank', label: 'Krank mili & ana yataklar', ex: [0, -1.25, 0],
    desc: '10 kollu dövme krank; her kol iki karşıt silindiri çalıştırır, ateşleme 36°’de bir gerçekleşir.'
  });
  anim.crank = spin;

  /* ---------- 5-6 · piston & gömlek grupları ---------- */
  ['A', 'B'].forEach((tag, bi) => {
    const s = bi === 0 ? 1 : -1;
    const g = new THREE.Group(); g.name = `piston_group_${tag}`;
    for (let i = 0; i < CPB; i++) {
      const cyl = new THREE.Group(); cyl.name = `cylinder_${tag}${i + 1}`;
      cyl.rotation.x = -s * vAngle; cyl.position.x = xOf(i);
      tubeY(bore / 2 + 0.018, bore / 2 + 0.018, 0.44, 26, MAT.steel, `liner_${tag}${i + 1}`, cyl, [0, 0.42, 0], true);
      const piston = new THREE.Group(); piston.name = `piston_${tag}${i + 1}`;
      tubeY(bore / 2, bore / 2, 0.16, 26, MAT.alu, `piston_crown_${tag}${i + 1}`, piston, [0, 0.02, 0]);
      for (let k = 0; k < 3; k++) tubeY(bore / 2 + 0.002, bore / 2 + 0.002, 0.008, 26, MAT.steel,
        `piston_ring_${tag}${i + 1}_${k}`, piston, [0, 0.06 - k * 0.018, 0]).castShadow = false;
      cyl.add(piston);
      const rodG = new THREE.Group(); rodG.name = `con_rod_${tag}${i + 1}`;
      box(0.058, rod * 0.82, 0.10, MAT.steel, 'rod_beam', rodG, [0, -rod * 0.44, 0]);
      tubeX(0.052, 0.052, 0.115, 16, MAT.steel, 'small_end', rodG, [0, -0.01, 0]);
      tubeX(0.09, 0.09, 0.175, 18, MAT.steel, 'big_end', rodG, [0, -rod, 0]);
      cyl.add(rodG);
      g.add(cyl);
      anim.pistons.push({ piston, rod: rodG, angle: ((i * 3) % CPB) * (Math.PI * 2 / CPB), bank: s });
    }
    add(g, {
      key: 'piston' + tag, label: `Piston & gömlek — banka ${tag}`, ex: [0, 1.35, s * 1.7],
      desc: 'Ø170 mm piston, 195 mm strok, ıslak gömlek. Gömlek blok sökülmeden tek tek çekilir.'
    });
  });

  /* ---------- 7-8 · silindir kapakları + supap kapağı ---------- */
  ['A', 'B'].forEach((tag, bi) => {
    const s = bi === 0 ? 1 : -1;
    const g = new THREE.Group(); g.name = `head_group_${tag}`;
    const bank = new THREE.Group(); bank.rotation.x = -s * vAngle; g.add(bank);
    for (let i = 0; i < CPB; i++) {
      const hx = xOf(i);
      // döküm alüminyum kapak gövdesi (fotoğrafta parlak, ayrı ayrı)
      box(0.265, 0.26, 0.50, MAT.alu, `cylinder_head_${tag}${i + 1}`, bank, [hx, DECK + 0.14, 0], tag === 'A');
      // üstteki sarı supap kapağı, her silindirde ayrı
      box(0.25, 0.17, 0.42, MAT.yellow, `valve_cover_${tag}${i + 1}`, bank, [hx, DECK + 0.34, 0.01], tag === 'A');
      box(0.26, 0.03, 0.44, MAT.yellowDark, `valve_cover_lip_${tag}${i + 1}`, bank, [hx, DECK + 0.255, 0.01]).castShadow = false;
      boltRingX(0.17, 4, 0.019, 0.3, MAT.bolt, `head_stud_${tag}${i + 1}`, bank, hx).position.y = DECK + 0.14;
      // ateşleme bobini ve buji borusu
      box(0.1, 0.13, 0.1, MAT.black, `ignition_coil_${tag}${i + 1}`, bank, [hx, DECK + 0.49, 0.01]).castShadow = false;
      tubeY(0.016, 0.016, 0.1, 8, MAT.steel, `ht_lead_${tag}${i + 1}`, bank, [hx, DECK + 0.58, 0.01]).castShadow = false;
      // emme dirseği (vadi tarafına)
      const el = tubeY(0.07, 0.07, 0.2, 14, MAT.alu, `intake_elbow_${tag}${i + 1}`, bank, [hx, DECK + 0.13, -0.28]);
      el.rotation.x = -1.15; el.castShadow = false;
    }
    add(g, {
      key: 'head' + tag, label: `Silindir kapakları — banka ${tag}`, ex: [0, 2.3, s * 2.7],
      desc: 'Silindir başına dört supap ve merkezî buji; her kapak kendi supap kapağı ve bobiniyle tek tek sökülür.'
    });
  });

  /* ---------- 9-10 · egzoz manifoldu (parlak izolasyon kılıfı) ---------- */
  ['A', 'B'].forEach((tag, bi) => {
    const s = bi === 0 ? 1 : -1;
    const g = new THREE.Group(); g.name = `exhaust_manifold_${tag}`;
    const bank = new THREE.Group(); bank.rotation.x = -s * vAngle; g.add(bank);
    const MY = DECK + 0.42, MZ = 0.5;
    tubeX(0.115, 0.115, ENG, 22, MAT.heat, `manifold_pipe_${tag}`, bank, [0, MY, MZ]);
    // fotoğraftaki parlak paslanmaz kılıf: silindir + üstte kutu kesit
    tubeX(0.16, 0.16, ENG + 0.04, 24, MAT.bright, `manifold_shield_${tag}`, bank, [0, MY, MZ]);
    for (let i = 0; i < CPB + 2; i++) {
      const ring = mesh(new THREE.TorusGeometry(0.163, 0.012, 8, 22), MAT.bright, `shield_band_${tag}${i}`, bank);
      ring.rotation.y = Math.PI / 2;
      ring.position.set(-(ENG / 2 - 0.28) + i * (ENG - 0.56) / (CPB + 1), MY, MZ);
      ring.castShadow = false;
    }
    for (let i = 0; i < CPB; i++) {
      const bx = xOf(i);
      const b = bellowsX(0.075, 0.2, 5, MAT.bright, `exhaust_bellows_${tag}${i + 1}`, bank, [bx, DECK + 0.2, 0.34]);
      b.rotation.z = Math.PI / 2; b.rotation.x = -0.75;
      box(0.03, 0.18, 0.18, MAT.steel, `port_flange_${tag}${i + 1}`, bank, [bx, DECK + 0.12, 0.26]).castShadow = false;
    }
    tubeX(0.17, 0.17, 0.6, 24, MAT.bright, `manifold_collector_${tag}`, bank, [-(ENG / 2 + 0.2), MY, MZ]);
    add(g, {
      key: 'exh' + tag, label: `Egzoz manifoldu — banka ${tag}`, ex: [0, 1.15, s * 3.8],
      desc: 'Parlak paslanmaz izolasyon kılıflı kuru manifold; her silindirden körükle beslenir (≈ 500 °C).'
    });
  });

  /* ---------- 11 · V vadisi: emme plenumu & gaz karıştırıcı ---------- */
  const intake = new THREE.Group(); intake.name = 'gas_mixer_intake';
  box(ENG - 0.4, 0.30, 0.52, MAT.yellow, 'intake_plenum', intake, [0.05, 0.46, 0]);
  box(ENG - 0.36, 0.04, 0.56, MAT.yellowDark, 'plenum_lid', intake, [0.05, 0.62, 0]);
  for (const s of [1, -1]) for (let i = 0; i < CPB; i++) {
    const p = tubeY(0.06, 0.06, 0.24, 14, MAT.alu, `intake_runner_${s > 0 ? 'A' : 'B'}${i + 1}`, intake,
      [xOf(i), 0.5, s * 0.34]);
    p.rotation.x = s * 1.1; p.castShadow = false;
  }
  tubeX(0.17, 0.17, 0.55, 24, MAT.alu, 'venturi_gas_mixer', intake, [-2.05, 0.52, 0]);
  tubeY(0.105, 0.105, 0.3, 18, MAT.black, 'gas_train_riser', intake, [-2.05, 0.74, 0]);
  box(0.3, 0.3, 0.34, MAT.black, 'throttle_actuator', intake, [-1.65, 0.62, 0.26]);
  box(0.36, 0.24, 0.28, MAT.yellowDark, 'waste_gate', intake, [-1.3, 0.42, -0.3]);
  add(intake, {
    key: 'intake', label: 'Gaz karıştırıcı & emme plenumu', ex: [1.0, 3.5, 0],
    desc: 'Venturi karıştırıcı biyogazı hava ile oranlar; plenum V vadisinden yirmi silindiri eşit besler.'
  });

  /* ---------- 12 · turbo grubu + egzoz genleşme bağlantısı ---------- */
  const turbos = new THREE.Group(); turbos.name = 'turbocharger_group';
  for (const s of [1, -1]) {
    const t = makeTurbo(s > 0 ? 'turbo_A' : 'turbo_B', anim.heatMats);
    t.group.position.set(-2.25, 1.12, s * 0.42);
    t.group.rotation.y = s > 0 ? 0 : Math.PI;
    turbos.add(t.group);
    anim.turbos.push(t.rotor);
    box(0.36, 0.5, 0.34, MAT.yellowDark, `turbo_pedestal_${s}`, turbos, [-2.25, 0.78, s * 0.42]);
    // türbin çıkışından yukarı koyu genleşme körüğü
    const up = tubeY(0.19, 0.19, 0.36, 22, MAT.darkPipe, `turbine_outlet_${s}`, turbos, [-2.0, 1.46, s * 0.42]);
    up.castShadow = false;
  }
  // ortak egzoz toplayıcı + büyük koyu genleşme bağlantısı (fotoğraflardaki varil)
  tubeX(0.26, 0.26, 1.1, 26, MAT.darkPipe, 'exhaust_collector', turbos, [-1.6, 1.62, 0]);
  const barrel = tubeX(0.33, 0.33, 0.75, 28, MAT.darkPipe, 'exhaust_expansion_joint', turbos, [-0.8, 1.62, 0]);
  for (let i = 0; i < 6; i++) {
    const rg = mesh(new THREE.TorusGeometry(0.345, 0.028, 8, 24), MAT.darkPipe, `expansion_rib_${i}`, turbos);
    rg.rotation.y = Math.PI / 2; rg.position.set(-1.1 + i * 0.12, 1.62, 0); rg.castShadow = false;
  }
  barrel.userData.tag = 'exhaust';
  tubeX(0.27, 0.27, 0.5, 26, MAT.darkPipe, 'exhaust_outlet_stub', turbos, [-0.25, 1.62, 0]);
  add(turbos, {
    key: 'turbo', label: 'Turbo grubu & egzoz genleşme bağlantısı', ex: [-2.6, 2.0, 0],
    desc: 'Banka başına bir turbo; türbinler manifold gazıyla döner, çıkışlar körüklü koyu genleşme bağlantısında birleşir.'
  });

  /* ---------- 13 · dikey hava filtreleri ---------- */
  const air = new THREE.Group(); air.name = 'air_cleaners';
  box(1.2, 0.1, 1.15, MAT.bright, 'air_cleaner_platform', air, [-2.85, 1.02, 0]);
  for (const s of [1, -1]) {
    const cx = -2.85, cz = s * 0.34;
    tubeY(0.27, 0.27, 0.72, 30, MAT.bright, `air_cleaner_body_${s}`, air, [cx, 1.44, cz]);
    for (let i = 0; i < 4; i++) {
      const rg = mesh(new THREE.TorusGeometry(0.275, 0.014, 8, 26), MAT.bright, `air_cleaner_band_${s}_${i}`, air);
      rg.rotation.x = Math.PI / 2; rg.position.set(cx, 1.18 + i * 0.18, cz); rg.castShadow = false;
    }
    tubeY(0.29, 0.23, 0.14, 30, MAT.bright, `air_cleaner_bonnet_${s}`, air, [cx, 1.86, cz]);
    tubeY(0.1, 0.1, 0.08, 16, MAT.bright, `air_cleaner_vent_${s}`, air, [cx, 1.96, cz]);
    // filtreden turboya iniş borusu
    const down = tubeY(0.16, 0.16, 0.5, 20, MAT.bright, `air_duct_${s}`, air, [-2.65, 1.05, cz + s * 0.02]);
    down.rotation.z = 0.35;
    box(0.22, 0.5, 0.16, MAT.bright, `air_cleaner_strut_${s}`, air, [cx, 0.78, cz]).castShadow = false;
  }
  add(air, {
    key: 'air', label: 'Dikey hava filtreleri', ex: [-3.4, 2.6, 0],
    desc: 'İki kademeli kuru tip filtreler; emiş havası tepeden alınır, kartuşlar bonnet açılarak değiştirilir.'
  });

  /* ---------- 14 · karışım soğutucu (SCAC) ---------- */
  const cooler = new THREE.Group(); cooler.name = 'mixture_cooler';
  box(1.05, 0.62, 1.0, MAT.alu, 'cooler_core', cooler, [0, 0, 0]);
  for (let i = 0; i < 20; i++) {
    box(0.99, 0.54, 0.014, MAT.skid, `cooler_fin_${i}`, cooler, [0, 0, -0.46 + i * 0.048]).castShadow = false;
  }
  box(1.12, 0.12, 1.06, MAT.yellowDark, 'cooler_tank_top', cooler, [0, 0.35, 0]);
  box(1.12, 0.12, 1.06, MAT.yellowDark, 'cooler_tank_bottom', cooler, [0, -0.35, 0]);
  tubeX(0.085, 0.085, 0.34, 16, MAT.alu, 'coolant_in', cooler, [-0.62, 0.35, 0.34]);
  tubeX(0.085, 0.085, 0.34, 16, MAT.alu, 'coolant_out', cooler, [-0.62, -0.35, 0.34]);
  cooler.position.set(-1.35, 0.95, 0);
  add(cooler, {
    key: 'cooler', label: 'Karışım soğutucu (SCAC)', ex: [-1.6, 2.9, 0],
    desc: 'Sıkıştırılmış hava–gaz karışımını soğutur; dolgu yoğunluğunu ve vuruntu payını artırır.'
  });

  /* ---------- 15 · ön yardımcılar (pompa, filtre, borulama) ---------- */
  const front = new THREE.Group(); front.name = 'front_ancillaries';
  box(0.55, 0.75, 0.5, MAT.yellow, 'jacket_water_header', front, [-2.55, 0.2, 0.66]);
  tubeX(0.11, 0.11, 1.3, 20, MAT.yellowDark, 'jw_pipe_upper', front, [-1.95, 0.42, 0.72]);
  tubeX(0.11, 0.11, 1.3, 20, MAT.yellowDark, 'jw_pipe_lower', front, [-1.95, -0.05, 0.72]);
  box(0.5, 0.8, 0.42, MAT.yellow, 'gas_train_module', front, [-2.55, 0.16, -0.66]);
  for (let i = 0; i < 2; i++) tubeY(0.13, 0.13, 0.34, 18, MAT.black, `gas_filter_${i}`, front, [-2.65 + i * 0.22, 0.62, -0.66]);
  box(0.36, 0.36, 0.3, MAT.alu, 'starter_air_motor', front, [-1.95, -0.2, -0.62]);
  box(0.8, 0.5, 0.2, MAT.skid, 'cable_tray', front, [-1.2, -0.28, -0.66]);
  add(front, {
    key: 'front', label: 'Ön yardımcı grup: pompalar, gaz hattı', ex: [-3.4, -0.4, 1.5],
    desc: 'Ceket suyu kolektörü, biyogaz filtre hattı ve marş grubu motorun serbest ucunda toplanmıştır.'
  });

  /* ---------- 16 · volan & elastik kavrama ---------- */
  const fly = new THREE.Group(); fly.name = 'flywheel_housing';
  const bell = tubeX(0.68, 0.74, 0.4, 34, MAT.yellow, 'flywheel_housing_bell', fly, [0, 0, 0]);
  bell.userData.ghost = true;
  boltRingX(0.68, 16, 0.021, 0.06, MAT.bolt, 'housing_bolt', fly, -0.2);
  box(0.5, 0.36, 1.5, MAT.yellow, 'housing_foot', fly, [0, -0.6, 0]);
  const wheel = new THREE.Group(); wheel.name = 'flywheel_rotating';
  tubeX(0.56, 0.56, 0.14, 40, MAT.steel, 'flywheel_disc', wheel, [0.05, 0, 0]);
  tubeX(0.59, 0.59, 0.05, 90, MAT.steel, 'ring_gear', wheel, [0.12, 0, 0]);
  tubeX(0.34, 0.34, 0.06, 26, MAT.steel, 'flex_coupling_plate', wheel, [0.19, 0, 0]);
  boltRingX(0.46, 12, 0.022, 0.1, MAT.bolt, 'coupling_bolt', wheel, 0.16);
  fly.add(wheel);
  box(0.34, 0.36, 0.3, MAT.black, 'starter_motor', fly, [-0.12, -0.46, 0.55]);
  fly.position.set(1.95, 0, 0);
  add(fly, {
    key: 'fly', label: 'Volan & elastik kavrama', ex: [1.9, 0, 0],
    desc: 'Volan dönüş düzgünlüğünü sağlar; elastik kavrama torku burulma titreşimi geçirmeden alternatöre iletir.'
  });
  anim.flywheel = wheel;

  /* ---------- 17 · alternatör (kapalı sarı muhafaza + panjur) ---------- */
  const alt = new THREE.Group(); alt.name = 'alternator';
  const AL = 2.6, AH = 1.62, AW = 1.9;
  const encl = box(AL, AH, AW, MAT.yellow, 'alternator_enclosure', alt, [0, 0.42, 0], true);
  box(AL + 0.06, 0.08, AW + 0.06, MAT.yellowDark, 'enclosure_top_rail', alt, [0, 1.19, 0]);
  box(AL + 0.06, 0.08, AW + 0.06, MAT.yellowDark, 'enclosure_bottom_rail', alt, [0, -0.35, 0]);
  for (const s of [1, -1]) {
    for (let i = 0; i < 5; i++) box(0.07, AH - 0.16, 0.05, MAT.yellowDark, `enclosure_rib_${s}_${i}`, alt,
      [-1.05 + i * 0.52, 0.42, s * (AW / 2 + 0.03)]).castShadow = false;
    // yan yüzdeki CAT yazısı
    const d = decalPlane(decal(['CAT'], { w: 512, h: 200, color: '#1a1c20' }), 0.62, 0.24);
    d.name = `enclosure_mark_${s}`;
    d.position.set(-0.2, 0.62, s * (AW / 2 + 0.055));
    if (s < 0) d.rotation.y = Math.PI;
    alt.add(d);
  }
  // dış uçtaki panjur ızgara (fotoğraf 5)
  box(0.07, AH - 0.1, AW - 0.08, MAT.yellowDark, 'grille_frame', alt, [AL / 2 + 0.03, 0.42, 0]);
  louvrePanel(AW - 0.24, AH - 0.26, 15, MAT.yellowDark, 'alternator_grille', alt, [AL / 2 + 0.075, 0.42, 0], Math.PI / 2);
  // içindeki gerçek alternatör gövdesi
  const drum = tubeX(0.66, 0.66, 2.0, 40, MAT.steel, 'alternator_stator', alt, [-0.1, 0.34, 0]);
  drum.userData.ghost = true;
  const rotor = new THREE.Group(); rotor.name = 'alternator_rotor';
  tubeX(0.5, 0.5, 1.7, 30, MAT.copper, 'rotor_poles', rotor);
  tubeX(0.15, 0.15, 2.7, 20, MAT.steel, 'rotor_shaft', rotor);
  for (let i = 0; i < 12; i++) {
    const bl = box(0.11, 0.18, 0.022, MAT.alu, `rotor_fan_blade_${i}`, rotor);
    const a = (i / 12) * Math.PI * 2;
    bl.position.set(-1.1, Math.cos(a) * 0.32, Math.sin(a) * 0.32);
    bl.rotation.x = -a; bl.rotation.y = 0.6; bl.castShadow = false;
  }
  rotor.position.set(-0.1, 0.34, 0);
  alt.add(rotor);
  {
    const dp = decalPlane(decal(['1 600 ekW'], {
      w: 640, h: 220, color: '#1a1c20', border: 'rgba(26,28,32,.4)',
      sub: ['1500 rpm · 50 Hz · 4 POLE', 'IP23 · H CLASS']
    }), 0.5, 0.17);
    dp.name = 'alternator_data_plate';
    dp.position.set(0.85, 0.2, AW / 2 + 0.056);
    alt.add(dp);
  }
  alt.position.set(3.6, 0, 0);
  add(alt, {
    key: 'alt', label: 'Senkron alternatör (kapalı muhafaza)', ex: [3.8, 0, 0],
    desc: 'Fırçasız senkron alternatör kapalı sarı gövde içinde; dış uçtaki panjur ızgara soğutma havasını alır.'
  });
  anim.rotor = rotor;

  /* ---------- 18 · üstteki klemens / bara kutusu ---------- */
  const tbox = new THREE.Group(); tbox.name = 'terminal_box';
  box(1.55, 0.72, 1.6, MAT.yellow, 'terminal_box_body', tbox, [0, 0, 0]);
  box(1.62, 0.07, 1.66, MAT.yellowDark, 'terminal_box_lid', tbox, [0, 0.39, 0]);
  box(1.6, 0.06, 1.64, MAT.yellowDark, 'terminal_box_base', tbox, [0, -0.38, 0]);
  for (let i = 0; i < 3; i++) tubeY(0.055, 0.055, 0.26, 14, MAT.copper, `bus_bar_${i}`, tbox, [-0.3 + i * 0.3, 0.5, 0.3]);
  for (const s of [1, -1]) {
    const d = decalPlane(decal(['CAT'], { w: 512, h: 200, color: '#1a1c20' }), 0.5, 0.2);
    d.name = `terminal_box_mark_${s}`;
    d.position.set(0, 0.06, s * 0.805);
    if (s < 0) d.rotation.y = Math.PI;
    tbox.add(d);
  }
  const wr = decalPlane(decal(['! HIGH VOLTAGE'], {
    w: 640, h: 170, color: '#8a1010', font: '700 74px "Barlow Condensed", Impact, sans-serif'
  }), 0.5, 0.13);
  wr.name = 'warning_decal_hv';
  wr.position.set(0.35, 0.427, 0.2);
  wr.rotation.x = -Math.PI / 2;
  tbox.add(wr);
  tbox.position.set(3.35, 1.6, 0);
  add(tbox, {
    key: 'tbox', label: 'Klemens & bara kutusu', ex: [1.2, 2.6, 0],
    desc: 'Alternatör çıkış baraları, akım trafoları ve topraklama bağlantıları muhafazanın üstündeki kutuda toplanır.'
  });

  /* ---------- 19 · kontrol panosu (şasi üstünde) ---------- */
  const cab = new THREE.Group(); cab.name = 'control_cabinet';
  box(0.95, 1.08, 0.78, MAT.yellow, 'cabinet_body', cab, [0, 0, 0]);
  box(1.02, 0.06, 0.84, MAT.yellowDark, 'cabinet_roof', cab, [0, 0.57, 0]);
  box(0.9, 0.62, 0.03, MAT.black, 'cabinet_door_face', cab, [0, 0.06, 0.4]);
  box(0.54, 0.34, 0.02, MAT.glass, 'operator_display', cab, [0, 0.14, 0.42]);
  for (let i = 0; i < 4; i++) tubeZ(0.026, 0.026, 0.03, 12, MAT.bolt, `panel_button_${i}`, cab, [-0.26 + i * 0.17, -0.16, 0.42]);
  {
    const d = decalPlane(decal(['CAT'], { w: 512, h: 200, color: '#1a1c20' }), 0.4, 0.16);
    d.name = 'cabinet_mark';
    d.position.set(0, 0.36, 0.397);
    cab.add(d);
    const l = decalPlane(decal(['TPEM'], { w: 640, h: 200, color: '#efbf16', sub: 'ENGINE & GENERATOR CONTROL' }), 0.52, 0.16);
    l.name = 'cabinet_legend';
    l.position.set(0, -0.14, 0.417);
    cab.add(l);
  }
  cab.position.set(-3.35, 0.24, 0.6);
  add(cab, {
    key: 'cab', label: 'TPEM kontrol panosu', ex: [-1.4, 1.2, 2.6],
    desc: 'Motor–jeneratör kontrolü, senkronizasyon ve koruma röleleri şasi üstündeki sarı panoda.'
  });

  // merkeze al
  const b3 = new THREE.Box3().setFromObject(root);
  const c = b3.getCenter(new THREE.Vector3());
  root.children.forEach(ch => { ch.position.x -= c.x; ch.userData.home.x -= c.x; });

  // kesit görünümü için saydamlaşacak malzemeleri klonla
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
