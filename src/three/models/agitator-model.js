import * as THREE from 'three';
import { orangePeel, sandCast, brushed, machined, decal, decalPlane } from './cg170b-textures.js';

/* ---------------------------------------------------------------
   ARMA-MIX style twin-propeller ceiling agitator — parametric model
   Units: meters. Shaft runs along +X. Mounting plate sits at x = 0.
   Every mesh + material is named so the export/handoff stays usable.
---------------------------------------------------------------- */

export const MAT = {
  red: new THREE.MeshStandardMaterial({ name: 'enamel_red', color: 0xc0141c, roughness: 0.34, metalness: 0.12 }),
  redDark: new THREE.MeshStandardMaterial({ name: 'enamel_red_dark', color: 0x8d0f16, roughness: 0.42, metalness: 0.12 }),
  steel: new THREE.MeshStandardMaterial({ name: 'steel_plate', color: 0x3c4045, roughness: 0.55, metalness: 0.85 }),
  inox: new THREE.MeshStandardMaterial({ name: 'stainless', color: 0x9ba1a6, roughness: 0.28, metalness: 0.92 }),
  inoxRough: new THREE.MeshStandardMaterial({ name: 'stainless_cast', color: 0x8e949a, roughness: 0.46, metalness: 0.8 }),
  white: new THREE.MeshStandardMaterial({ name: 'paint_white', color: 0xe9e9e6, roughness: 0.38, metalness: 0.05 }),
  black: new THREE.MeshStandardMaterial({ name: 'rubber_black', color: 0x1c1d1f, roughness: 0.75, metalness: 0.1 }),
  brass: new THREE.MeshStandardMaterial({ name: 'zinc_bolt', color: 0xb9bcc0, roughness: 0.35, metalness: 1.0 })
};

/* stüdyo çekimi gerçekçiliği: boya portakal kabuğu, fırçalanmış 316 paslanmaz,
   kum döküm salmastra gövdesi, işlenmiş cıvata başları */
{
  const peel = orangePeel(4), peelD = orangePeel(3);
  const brush = brushed(4), brushPlate = brushed(6);
  const cast = sandCast(5), castFine = sandCast(3);
  const mach = machined(1);
  const skin = (mat, maps, nScale, env) => {
    Object.assign(mat, maps);
    if (maps.normalMap) mat.normalScale = new THREE.Vector2(nScale, nScale);
    mat.envMapIntensity = env;
    mat.needsUpdate = true;
  };
  skin(MAT.red, peel, 0.30, 1.05);
  skin(MAT.redDark, peelD, 0.34, 0.95);
  skin(MAT.white, peel, 0.26, 1.0);
  skin(MAT.inox, brush, 0.40, 1.4);
  skin(MAT.inoxRough, cast, 0.6, 1.05);
  skin(MAT.steel, brushPlate, 0.5, 1.15);
  skin(MAT.black, castFine, 0.5, 0.55);
  skin(MAT.brass, mach, 0.4, 1.4);
}

function mesh(geo, mat, name, parent) {
  const m = new THREE.Mesh(geo, mat);
  m.name = name;
  m.castShadow = true;
  m.receiveShadow = true;
  if (parent) parent.add(m);
  return m;
}

/* Cylinder whose axis lies along X */
function tube(rTop, rBot, len, seg, mat, name, parent, x = 0, open = false) {
  const g = new THREE.CylinderGeometry(rTop, rBot, len, seg, 1, open);
  g.rotateZ(Math.PI / 2);
  const m = mesh(g, mat, name, parent);
  m.position.x = x;
  return m;
}

function boltRing(radius, count, r = 0.012, h = 0.02, mat = MAT.brass, name = 'bolt', parent) {
  const g = new THREE.Group();
  g.name = name + '_ring';
  const geo = new THREE.CylinderGeometry(r, r, h, 12);
  geo.rotateZ(Math.PI / 2);
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const b = mesh(geo, mat, `${name}_${i}`, g);
    b.position.set(0, Math.cos(a) * radius, Math.sin(a) * radius);
    const head = mesh(new THREE.CylinderGeometry(r * 1.6, r * 1.6, h * 0.5, 6), mat, `${name}_head_${i}`, g);
    head.geometry.rotateZ(Math.PI / 2);
    head.position.set(h * 0.6, Math.cos(a) * radius, Math.sin(a) * radius);
  }
  if (parent) parent.add(g);
  return g;
}

/* -------- parametric swept propeller blade (thick shell) -------- */
function bladeGeometry({ rootR = 0.065, tipR = 0.42, maxChord = 0.34, sweep = 0.85,
  pitchRoot = 0.66, pitchTip = 0.30, thick = 0.014, segU = 44, segV = 16 }) {
  const chord = (u) => maxChord * (0.50 + 0.95 * u - 0.85 * u * u);
  const pitch = (u) => pitchRoot + (pitchTip - pitchRoot) * u;
  const P = (u, v, out) => {
    const r = rootR + (tipR - rootR) * u;
    const c = chord(u);
    const s = v * c;
    const p = pitch(u);
    const ang = sweep * u * u + (s * Math.cos(p)) / Math.max(r, 0.02);
    out.set(s * Math.sin(p), r * Math.cos(ang), r * Math.sin(ang));
    return out;
  };
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c2 = new THREE.Vector3();
  const du = new THREE.Vector3(), dv = new THREE.Vector3(), n = new THREE.Vector3();
  const e = 1e-3;
  const nu = segU + 1, nv = segV + 1;
  const top = [], bot = [], nTop = [], nBot = [];
  for (let i = 0; i < nu; i++) {
    const u = i / segU;
    for (let j = 0; j < nv; j++) {
      const v = j / segV - 0.5;
      P(u, v, a);
      P(Math.min(1, u + e), v, b); du.subVectors(b, a);
      P(u, Math.min(0.5, v + e), c2); dv.subVectors(c2, a);
      n.crossVectors(du, dv).normalize();
      // aerofoil-ish thickness: fat at mid-chord + root, thin at edges/tip
      const t = thick * (1 - Math.pow(Math.abs(2 * v), 2.2)) * (1 - 0.55 * u) * 0.5 + 0.0008;
      top.push(a.x + n.x * t, a.y + n.y * t, a.z + n.z * t);
      bot.push(a.x - n.x * t, a.y - n.y * t, a.z - n.z * t);
      nTop.push(n.x, n.y, n.z);
      nBot.push(-n.x, -n.y, -n.z);
    }
  }
  const pos = top.concat(bot);
  const nor = nTop.concat(nBot);
  const idx = [];
  const off = nu * nv;
  const id = (i, j) => i * nv + j;
  for (let i = 0; i < segU; i++) {
    for (let j = 0; j < segV; j++) {
      idx.push(id(i, j), id(i + 1, j), id(i + 1, j + 1), id(i, j), id(i + 1, j + 1), id(i, j + 1));
      idx.push(off + id(i, j), off + id(i + 1, j + 1), off + id(i + 1, j),
        off + id(i, j), off + id(i, j + 1), off + id(i + 1, j + 1));
    }
  }
  // stitch the four boundaries
  const stitch = (aIdx, bIdx) => idx.push(aIdx, bIdx, off + bIdx, aIdx, off + bIdx, off + aIdx);
  for (let i = 0; i < segU; i++) { stitch(id(i + 1, 0), id(i, 0)); stitch(id(i, segV), id(i + 1, segV)); }
  for (let j = 0; j < segV; j++) { stitch(id(0, j), id(0, j + 1)); stitch(id(segU, j + 1), id(segU, j)); }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function propeller(name, { hubR = 0.075, hubLen = 0.16, blades = 3, scale = 1 }) {
  const g = new THREE.Group();
  g.name = name;
  const hub = tube(hubR, hubR, hubLen, 40, MAT.red, name + '_hub', g);
  hub.geometry = new THREE.CylinderGeometry(hubR, hubR * 1.06, hubLen, 40).rotateZ(Math.PI / 2);
  tube(hubR * 1.28, hubR * 1.28, 0.022, 40, MAT.redDark, name + '_hub_collar', g, -hubLen / 2 + 0.012);
  tube(hubR * 1.22, hubR * 1.22, 0.02, 40, MAT.redDark, name + '_hub_collar_b', g, hubLen / 2 - 0.011);
  const bg = bladeGeometry({ rootR: hubR * 0.92, tipR: 0.42 * scale, maxChord: 0.34 * scale });
  for (let i = 0; i < blades; i++) {
    const b = mesh(bg, MAT.red, `${name}_blade_${i + 1}`, g);
    b.rotation.x = (i / blades) * Math.PI * 2;
  }
  // clamp bolts on the hub
  const bolt = new THREE.CylinderGeometry(0.011, 0.011, hubR * 2.4, 10);
  for (let i = 0; i < 2; i++) {
    const m = mesh(bolt, MAT.brass, `${name}_clamp_bolt_${i + 1}`, g);
    m.position.set(-hubLen * 0.28 + i * hubLen * 0.56, 0, 0);
    m.rotation.x = Math.PI / 2;
  }
  return g;
}

/* --------------------------- assembly --------------------------- */
export function buildAgitator() {
  const root = new THREE.Group();
  root.name = 'arma_mix_twin';
  const parts = [];
  const add = (group, cfg) => {
    group.userData.home = group.position.clone();
    group.userData.explode = cfg.explode;
    parts.push({ ...cfg, object: group });
    root.add(group);
    return group;
  };

  /* 1 — fan cowl + lifting eye */
  const cowl = new THREE.Group(); cowl.name = 'fan_cowl_assembly';
  tube(0.145, 0.115, 0.17, 40, MAT.red, 'fan_cowl', cowl, -0.085);
  for (let i = 0; i < 10; i++) {
    const s = mesh(new THREE.BoxGeometry(0.006, 0.11, 0.012), MAT.redDark, `cowl_slot_${i}`, cowl);
    const a = (i / 10) * Math.PI * 2;
    s.position.set(-0.168, Math.cos(a) * 0.07, Math.sin(a) * 0.07);
    s.rotation.x = -a;
  }
  const eye = mesh(new THREE.TorusGeometry(0.035, 0.008, 10, 24), MAT.red, 'lifting_eye', cowl);
  eye.position.set(-0.06, 0.155, 0); eye.rotation.y = Math.PI / 2;
  cowl.position.set(-1.02, 0, 0);
  add(cowl, {
    key: 'cowl', label: 'Fan kapağı & kaldırma halkası',
    desc: 'Motor soğutma fanı muhafazası; üstteki halka montaj sırasında vinç bağlantısı için.',
    explode: new THREE.Vector3(-1.35, 0.55, 0.1)
  });

  /* 2 — electric motor */
  const motor = new THREE.Group(); motor.name = 'motor_assembly';
  const body = tube(0.148, 0.148, 0.42, 48, MAT.red, 'motor_body', motor);
  body.geometry.computeVertexNormals();
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    const f = mesh(new THREE.BoxGeometry(0.40, 0.026, 0.009), MAT.red, `cooling_fin_${i}`, motor);
    f.position.set(0, Math.cos(a) * 0.158, Math.sin(a) * 0.158);
    f.rotation.x = -a;
  }
  tube(0.155, 0.155, 0.028, 48, MAT.redDark, 'motor_endbell_rear', motor, -0.215);
  tube(0.16, 0.13, 0.06, 48, MAT.redDark, 'motor_endbell_front', motor, 0.235);
  const box = mesh(new THREE.BoxGeometry(0.19, 0.085, 0.15), MAT.red, 'terminal_box', motor);
  box.position.set(-0.02, 0.20, 0);
  const lid = mesh(new THREE.BoxGeometry(0.20, 0.014, 0.16), MAT.redDark, 'terminal_box_lid', motor);
  lid.position.set(-0.02, 0.247, 0);
  const gland = mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.05, 16), MAT.black, 'cable_gland', motor);
  gland.position.set(-0.115, 0.20, 0.055); gland.rotation.z = Math.PI / 2; gland.rotation.y = 0.4;
  const plateTag = mesh(new THREE.BoxGeometry(0.11, 0.001, 0.07), MAT.inox, 'name_plate', motor);
  plateTag.position.set(0.05, 0.155, 0.06); plateTag.rotation.x = -1.1;
  {
    const d = decalPlane(decal(['ARMA MIX'], {
      w: 640, h: 200, color: '#f2f2f0', sub: 'TWIN'
    }), 0.115, 0.062);
    d.name = 'name_plate_text';
    d.position.set(0.05, 0.1565, 0.0625);
    d.rotation.set(-1.1 - Math.PI / 2, 0, 0);
    motor.add(d);
    const brand = decalPlane(decal(['ARMA MIX TWIN'], {
      w: 768, h: 150, color: '#f4f4f2', font: '700 74px "Barlow Condensed", Impact, sans-serif'
    }), 0.30, 0.058);
    brand.name = 'motor_brand_decal';
    brand.position.set(-0.02, 0.1595, 0);
    brand.rotation.x = -Math.PI / 2;
    motor.add(brand);
  }
  motor.position.set(-0.70, 0, 0);
  add(motor, {
    key: 'motor', label: 'Elektrik motoru (IE3)',
    desc: 'Kanatlı gövdeli asenkron motor. Klemens kutusu üstte, kablo rakoru yan tarafta — bakımda tek başına sökülebilir.',
    explode: new THREE.Vector3(-1.0, 0.28, -0.05)
  });

  /* 3 — motor lantern / coupling guard (white) */
  const lantern = new THREE.Group(); lantern.name = 'coupling_guard';
  tube(0.115, 0.115, 0.17, 36, MAT.white, 'guard_shell', lantern);
  tube(0.126, 0.126, 0.016, 36, MAT.inox, 'guard_flange_a', lantern, -0.078);
  tube(0.126, 0.126, 0.016, 36, MAT.inox, 'guard_flange_b', lantern, 0.078);
  lantern.position.set(-0.375, 0, 0);
  add(lantern, {
    key: 'guard', label: 'Kaplin muhafazası',
    desc: 'Motor mili ile redüktör girişi arasındaki elastik kaplini örten beyaz ara gövde.',
    explode: new THREE.Vector3(-0.62, -0.42, 0.05)
  });

  /* 4 — bevel drive / bearing housing */
  const drive = new THREE.Group(); drive.name = 'drive_housing';
  const dh = mesh(new THREE.CylinderGeometry(0.135, 0.175, 0.30, 40), MAT.red, 'gear_housing', drive);
  dh.geometry.rotateZ(Math.PI / 2);
  tube(0.185, 0.185, 0.03, 40, MAT.redDark, 'housing_flange', drive, 0.145);
  const rib = mesh(new THREE.BoxGeometry(0.26, 0.30, 0.016), MAT.red, 'housing_rib', drive);
  rib.position.set(0.01, -0.02, 0);
  const oilPlug = mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.03, 12), MAT.brass, 'oil_plug', drive);
  oilPlug.position.set(0.0, -0.17, 0);
  drive.position.set(-0.145, 0, 0);
  add(drive, {
    key: 'drive', label: 'Tahrik / yatak gövdesi',
    desc: 'Motor torkunu mile aktaran, çift sıra rulmanlı ana gövde. Eksenel yükü tavan plakasına iletir.',
    explode: new THREE.Vector3(-0.28, 0.48, 0.0)
  });

  /* 5 — bolt ring for the plate */
  const bolts = new THREE.Group(); bolts.name = 'flange_bolts';
  boltRing(0.235, 12, 0.013, 0.06, MAT.brass, 'flange_bolt', bolts);
  bolts.position.set(0.02, 0, 0);
  add(bolts, {
    key: 'bolts', label: 'Flanş cıvataları',
    desc: 'Tahrik gövdesini sızdırmazlık grubuna ve tavan plakasına bağlayan 12 adet paslanmaz cıvata.',
    explode: new THREE.Vector3(0.30, 0.62, 0.42)
  });

  /* 6 — mechanical seal / lantern ring on the wet side */
  const seal = new THREE.Group(); seal.name = 'seal_assembly';
  tube(0.20, 0.20, 0.075, 44, MAT.inoxRough, 'seal_housing', seal);
  tube(0.235, 0.235, 0.018, 44, MAT.inox, 'seal_flange', seal, -0.04);
  tube(0.145, 0.145, 0.09, 40, MAT.inoxRough, 'seal_nose', seal, 0.07);
  boltRing(0.21, 10, 0.009, 0.05, MAT.brass, 'seal_bolt', seal);
  seal.position.set(0.09, 0, 0);
  add(seal, {
    key: 'seal', label: 'Mekanik salmastra grubu',
    desc: 'Çift etkili mekanik salmastra — tank içindeki sıvıyı tahrik tarafından ayırır. Aşınan tek parça budur.',
    explode: new THREE.Vector3(0.42, -0.55, -0.05)
  });

  /* 7 — ceiling mounting plate */
  const plate = new THREE.Group(); plate.name = 'mounting_plate';
  const pl = mesh(new THREE.BoxGeometry(0.022, 0.92, 0.92), MAT.steel, 'plate_body', plate);
  pl.position.x = 0;
  const holeRing = boltRing(0.40, 16, 0.011, 0.03, MAT.brass, 'anchor_bolt', plate);
  holeRing.position.x = 0.012;
  const gasket = mesh(new THREE.BoxGeometry(0.006, 0.94, 0.94), MAT.black, 'plate_gasket', plate);
  gasket.position.x = -0.015;
  plate.position.set(0.0, 0, 0);
  add(plate, {
    key: 'plate', label: 'Tavan montaj plakası',
    desc: 'Betonarme tavana ankrajlanan taşıyıcı plaka; tüm ünitenin ağırlığını ve titreşimini karşılar.',
    explode: new THREE.Vector3(0, 0, 0)
  });

  /* 8 — support strut */
  const strut = new THREE.Group(); strut.name = 'support_strut';
  const rod = mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.78, 16), MAT.inox, 'strut_rod', strut);
  rod.rotation.z = 0.95; rod.rotation.y = 0.0;
  const e1 = mesh(new THREE.BoxGeometry(0.07, 0.05, 0.014), MAT.steel, 'strut_ear_a', strut);
  e1.position.set(0.31, 0.22, 0);
  const e2 = mesh(new THREE.BoxGeometry(0.07, 0.05, 0.014), MAT.steel, 'strut_ear_b', strut);
  e2.position.set(-0.31, -0.22, 0);
  strut.position.set(-0.30, -0.15, 0.13);
  add(strut, {
    key: 'strut', label: 'Destek çubuğu',
    desc: 'Konsol yükünü plakaya taşıyan ayarlanabilir gergi çubuğu; titreşimi ciddi biçimde azaltır.',
    explode: new THREE.Vector3(-0.35, -0.95, 0.55)
  });

  /* 9 — primary shaft */
  const shaft1 = new THREE.Group(); shaft1.name = 'shaft_section_1';
  tube(0.058, 0.058, 2.05, 32, MAT.inox, 'shaft_tube_1', shaft1);
  tube(0.066, 0.066, 0.05, 32, MAT.inoxRough, 'shaft_collar_1', shaft1, -0.99);
  shaft1.position.set(1.18, 0, 0);
  add(shaft1, {
    key: 'shaft1', label: 'Mil — 1. kademe',
    desc: 'Ø115 mm paslanmaz çekme boru. Tahrik gövdesinden çıkıp ilk pervaneyi taşır.',
    explode: new THREE.Vector3(0.55, 0.72, -0.35)
  });

  /* 10 — first propeller */
  const propA = propeller('propeller_1', { hubR: 0.078, hubLen: 0.17, scale: 1.0 });
  propA.position.set(1.30, 0, 0);
  add(propA, {
    key: 'propA', label: '1. pervane (üst)',
    desc: 'Üç kanatlı, geriye süpürmeli hidrolik profil. Tank orta katmanında eksenel akış üretir.',
    explode: new THREE.Vector3(0.25, -1.0, 0.45), spin: true
  });

  /* 11 — shaft coupling sleeve */
  const coupler = new THREE.Group(); coupler.name = 'shaft_coupling';
  tube(0.072, 0.072, 0.19, 36, MAT.inoxRough, 'coupling_sleeve', coupler);
  tube(0.079, 0.079, 0.016, 36, MAT.inox, 'coupling_lip_a', coupler, -0.087);
  tube(0.079, 0.079, 0.016, 36, MAT.inox, 'coupling_lip_b', coupler, 0.087);
  for (let i = 0; i < 4; i++) {
    const b = mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.15, 10), MAT.brass, `coupling_bolt_${i}`, coupler);
    b.position.set(-0.05 + (i % 2) * 0.1, 0, 0);
    b.rotation.x = Math.PI / 2;
    if (i > 1) b.rotation.x = 0;
  }
  coupler.position.set(2.26, 0, 0);
  add(coupler, {
    key: 'coupler', label: 'Mil kaplini',
    desc: 'İki mil kademesini birleştiren sıkma bilezik. Nakliye ve montaj için mil ikiye ayrılabilir.',
    explode: new THREE.Vector3(0.9, -0.85, -0.4)
  });

  /* 12 — secondary shaft */
  const shaft2 = new THREE.Group(); shaft2.name = 'shaft_section_2';
  tube(0.048, 0.048, 1.62, 32, MAT.inox, 'shaft_tube_2', shaft2);
  shaft2.position.set(3.15, 0, 0);
  add(shaft2, {
    key: 'shaft2', label: 'Mil — 2. kademe',
    desc: 'Daralan kesitli uç mili; alt pervaneyi tank tabanına yakın konumda tutar.',
    explode: new THREE.Vector3(1.35, 0.8, 0.3)
  });

  /* 13 — second propeller */
  const propB = propeller('propeller_2', { hubR: 0.068, hubLen: 0.15, scale: 1.12 });
  propB.position.set(3.85, 0, 0);
  add(propB, {
    key: 'propB', label: '2. pervane (alt)',
    desc: 'Biraz daha büyük çaplı ikinci pervane; çökeltiyi tabandan kaldırır, twin etkisini yaratır.',
    explode: new THREE.Vector3(1.75, -0.95, 0.35), spin: true
  });

  // centre the assembly on the origin
  const box3 = new THREE.Box3().setFromObject(root);
  const c = box3.getCenter(new THREE.Vector3());
  root.children.forEach(ch => { ch.position.x -= c.x; ch.userData.home.x -= c.x; });

  return { root, parts };
}
