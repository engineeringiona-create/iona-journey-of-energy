/**
 * Bir GLB'den dünya uzayında sınır kutuları — geometriyi ÇÖZMEDEN.
 *
 * glTF spesifikasyonu POSITION erişimcisinin `min`/`max` alanlarını zorunlu
 * kılar ve bu alanlar Draco sıkıştırmasından SONRA da JSON parçasında durur.
 * Yani yayına çıkan `iona-tesis-3d.draco.glb`'nin sınırları, tek bir üçgen
 * çözmeden okunabiliyor — Node tarafında Draco çözücüsü çalıştırmak
 * (tarayıcı Worker'ı + wasm) mümkün olmadığı için bu tek pratik yol.
 *
 * İki tüketicisi var: scripts/glb-bounds.mjs (komut satırı aracı) ve
 * tests/engineering.test.mjs (kamera çerçeveleme testi).
 */
import fs from 'node:fs';

/** GLB'nin JSON parçasını döndürür. */
export function readGlbJson(file) {
  const b = fs.readFileSync(file);
  if (b.readUInt32LE(0) !== 0x46546c67) throw new Error(`${file}: GLB değil (sihirli sayı tutmuyor)`);
  const jsonLen = b.readUInt32LE(12);
  return JSON.parse(b.subarray(20, 20 + jsonLen).toString());
}

const identity = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

function mul(a, c) {
  const r = new Array(16).fill(0);
  for (let i = 0; i < 4; i++) for (let k = 0; k < 4; k++) for (let x = 0; x < 4; x++)
    r[i * 4 + x] += a[k * 4 + x] * c[i * 4 + k];
  return r;
}

function nodeMatrix(n) {
  if (n.matrix) return n.matrix;
  const [tx, ty, tz] = n.translation ?? [0, 0, 0];
  const [qx, qy, qz, qw] = n.rotation ?? [0, 0, 0, 1];
  const [sx, sy, sz] = n.scale ?? [1, 1, 1];
  const x2 = qx + qx, y2 = qy + qy, z2 = qz + qz;
  const xx = qx * x2, xy = qx * y2, xz = qx * z2;
  const yy = qy * y2, yz = qy * z2, zz = qz * z2;
  const wx = qw * x2, wy = qw * y2, wz = qw * z2;
  return [
    (1 - (yy + zz)) * sx, (xy + wz) * sx, (xz - wy) * sx, 0,
    (xy - wz) * sy, (1 - (xx + zz)) * sy, (yz + wx) * sy, 0,
    (xz + wy) * sz, (yz - wx) * sz, (1 - (xx + yy)) * sz, 0,
    tx, ty, tz, 1,
  ];
}

function applyPoint(m, p) {
  return [
    m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
    m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
    m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
  ];
}

const emptyBox = () => ({ min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] });
const isEmpty = (box) => box.min[0] === Infinity;

function expand(box, point) {
  for (let i = 0; i < 3; i++) {
    if (point[i] < box.min[i]) box.min[i] = point[i];
    if (point[i] > box.max[i]) box.max[i] = point[i];
  }
}

/**
 * Sahneyi dolaşır ve her mesh'in yerel AABB'sinin sekiz köşesini dünya
 * matrisinden geçirerek `onMesh(name, corners)` çağırır.
 * Bir mesh'in gerçek sınırı, dönmüş bir kutuda köşelerin sarmalayanından
 * biraz büyük çıkabilir — kamera çerçevelemesi için güvenli yön budur
 * (fazladan pay bırakır, kırpmaz).
 */
function walkMeshes(json, onMesh) {
  const nodes = json.nodes ?? [];
  const scene = json.scenes?.[json.scene ?? 0];
  if (!scene) throw new Error('GLB içinde sahne yok');

  const visit = (idx, parentMatrix, ancestors) => {
    const n = nodes[idx];
    const world = mul(parentMatrix, nodeMatrix(n));
    const chain = n.name ? [...ancestors, n.name] : ancestors;

    if (n.mesh !== undefined) {
      const corners = [];
      for (const prim of json.meshes[n.mesh].primitives ?? []) {
        const acc = json.accessors[prim.attributes?.POSITION];
        if (!acc?.min || !acc?.max) continue;
        for (const x of [acc.min[0], acc.max[0]])
          for (const y of [acc.min[1], acc.max[1]])
            for (const z of [acc.min[2], acc.max[2]]) corners.push(applyPoint(world, [x, y, z]));
      }
      if (corners.length) onMesh(n.name ?? '', chain, corners);
    }
    for (const c of n.children ?? []) visit(c, world, chain);
  };

  for (const i of scene.nodes) visit(i, identity(), []);
}

/**
 * İstenen düğüm adlarının ALT AĞACINI kapsayan dünya uzayı sınır kutuları.
 * Adı geçen düğümün kendisi mesh taşımasa da (grup düğümü) altındaki tüm
 * mesh'ler toplanır — "digester" gibi seçilebilir yapılar tam olarak bu şekilde
 * kurulmuş.
 *
 * Dönen: Map<ad, {min:[x,y,z], max:[x,y,z]}>. Bulunamayan ad haritaya girmez,
 * böylece çağıran eksikliği sessizce yutmak yerine kontrol edebilir.
 */
export function subtreeBounds(json, names) {
  const wanted = new Set(names);
  const boxes = new Map(names.map((n) => [n, emptyBox()]));

  walkMeshes(json, (_name, ancestors, corners) => {
    for (const ancestor of ancestors) {
      if (!wanted.has(ancestor)) continue;
      const box = boxes.get(ancestor);
      for (const corner of corners) expand(box, corner);
    }
  });

  for (const [name, box] of boxes) if (isEmpty(box)) boxes.delete(name);
  return boxes;
}

/** Adı regex'e uyan mesh'lerin tek tek sınırları — komut satırı aracı için. */
export function meshBounds(json, re) {
  const out = [];
  walkMeshes(json, (name, _ancestors, corners) => {
    if (!re.test(name)) return;
    const box = emptyBox();
    for (const corner of corners) expand(box, corner);
    out.push({ name, ...box });
  });
  return out;
}
