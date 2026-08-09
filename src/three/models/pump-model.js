import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/* ---------------------------------------------------------------
   Iona mono pompa (progressive cavity pump) — the only expo machine
   loaded from a pre-built GLB instead of authored as code like
   buildAgitator()/buildGenset(). Every node in the GLB carries
   extras: { baseX, k } — baseX is its position along the pump's
   main axis, k is the assembly's explode-distance factor — so
   grouping nodes by `k` reconstructs the same named-part shape
   { object, explode, home } the other two models build by hand.
---------------------------------------------------------------- */

const BRAND_ORANGE = 0xff751f;

const GROUPS = [
  { key: 'base', k: 0, label: 'Taban Plakası',
    desc: 'Pompa gövdesini zemine sabitleyen taban plakası ve ayak grubu; montaj hizasını korur, patlama animasyonunda yerinde kalır.',
    explode: [0, 0, 0] },
  { key: 'discharge', k: 2.6, label: 'Basınç Ağzı',
    desc: 'Pompalanan malzemenin çıkış flanşı; 8 cıvatalı bağlantı deliğiyle boru hattına sızdırmazlıkla bağlanır.',
    explode: [-1.55, 0.85, 0.4] },
  { key: 'front_casing', k: 2.1, label: 'Ön Gövde',
    desc: 'Basınç tarafı gövdesi; rotor-stator temas bölgesini sistem basıncına karşı kapatır.',
    explode: [-1.2, -0.7, 0.5] },
  { key: 'end_plates', k: 1.85, label: 'Uç Plakaları',
    desc: 'Stator gövdesini iki taraftan sıkıştıran baskı plakaları.',
    explode: [-0.9, 0.7, -0.65] },
  { key: 'stator', k: 3.4, label: 'Stator',
    desc: 'Çift dişli helis elastomer kovan — sistemin en çok aşınan parçası; rotor bunun içinde eksantrik döner.',
    explode: [0.05, 1.5, 0.05] },
  { key: 'tie_rods', k: 2.4, label: 'Gergi Çubukları',
    desc: 'Ön gövdeden motor tarafına kadar tüm paketi bir arada tutan 4 adet paslanmaz gergi çubuğu.',
    explode: [0.15, -1.25, 0.95] },
  { key: 'suction', k: 0.35, label: 'Emiş Gövdesi',
    desc: 'Malzemenin pompaya girdiği emiş hunisi, giriş flanşı ve taşıyıcı ayak grubu.',
    explode: [0.55, -0.55, 0.4] },
  { key: 'lantern', k: 0.9, label: 'Fener Gövdesi',
    desc: 'Redüktör ile stator arasındaki mili örten, bakım için tek başına açılabilen ara gövde.',
    explode: [0.55, 0.6, -0.5] },
  { key: 'gearbox', k: 1.0, label: 'Redüktör',
    desc: 'Motor devrini pompanın ihtiyaç duyduğu düşük devire indiren dişli kutusu.',
    explode: [0.75, -0.9, 0.55] },
  { key: 'motor', k: 1.5, label: 'Elektrik Motoru',
    desc: 'Fanlı gövdeli tahrik motoru; klemens kutusu ve kaldırma gözü üstte, bakımda tek başına sökülebilir.',
    explode: [1.7, 0.5, -0.5] }
];

export function buildPump() {
  const loader = new GLTFLoader();
  return loader.loadAsync('/models/iona-mono-pompa.glb').then((gltf) => {
    const source = gltf.scene.children.find((c) => c.name === 'iona_mono_pump') || gltf.scene.children[0];

    const root = new THREE.Group();
    root.name = 'iona_mono_pump';

    const buckets = new Map();
    GROUPS.forEach((g) => {
      const bucket = new THREE.Group();
      bucket.name = g.key;
      buckets.set(g.k, bucket);
      root.add(bucket);
    });

    let rotorAssembly = null;
    [...source.children].forEach((child) => {
      if (child.name === 'rotor_assembly') { rotorAssembly = child; return; }
      const bucket = buckets.get(child.userData.k);
      (bucket || root).add(child);
    });

    const parts = GROUPS.map((g) => {
      const object = buckets.get(g.k);
      object.userData.home = object.position.clone();
      return {
        key: g.key, label: g.label, desc: g.desc,
        explode: new THREE.Vector3(...g.explode),
        object
      };
    });

    if (rotorAssembly) {
      root.add(rotorAssembly);
      rotorAssembly.userData.home = rotorAssembly.position.clone();
      parts.push({
        key: 'rotor', label: 'Rotor',
        desc: 'Krom kaplı çelik rotor; stator içinde eksantrik dönerek malzemeyi nabızsız, sabit debiyle iletir.',
        explode: new THREE.Vector3(0.35, 0.05, -0.85),
        object: rotorAssembly, spin: true
      });
    }

    /* Brand accent: the GLB's own accent material ("iona_yellow", used
       on the brand tag and inlet tag decals) gets pinned to the exact
       brand orange instead of its approximate procedural hue. */
    root.traverse((o) => {
      if (!o.isMesh) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m) => { if (m.name === 'iona_yellow') m.color.set(BRAND_ORANGE); });
    });

    return { root, parts };
  });
}
