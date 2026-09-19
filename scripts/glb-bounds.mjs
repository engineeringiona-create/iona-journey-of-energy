// World-space bounding boxes for meshes whose name matches a regex.
// node scripts/glb-bounds.mjs <file.glb> <name-regex> [limit]
import fs from 'node:fs';

const [file, pattern, limitArg] = process.argv.slice(2);
const limit = Number(limitArg ?? 40);
const re = new RegExp(pattern, 'i');
const b = fs.readFileSync(file);
const jsonLen = b.readUInt32LE(12);
const j = JSON.parse(b.subarray(20, 20 + jsonLen).toString());
const nodes = j.nodes ?? [];

function mat4Identity() { return [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]; }
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

const results = [];
function walk(idx, parentM) {
  const n = nodes[idx];
  const world = mul(parentM, nodeMatrix(n));
  if (n.mesh !== undefined && re.test(n.name ?? '')) {
    const prims = j.meshes[n.mesh].primitives ?? [];
    let mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
    for (const p of prims) {
      const acc = j.accessors[p.attributes.POSITION];
      if (!acc?.min || !acc?.max) continue;
      // All 8 corners of the local AABB through the world matrix.
      for (const cx of [acc.min[0], acc.max[0]])
        for (const cy of [acc.min[1], acc.max[1]])
          for (const cz of [acc.min[2], acc.max[2]]) {
            const w = applyPoint(world, [cx, cy, cz]);
            for (let i = 0; i < 3; i++) { mn[i] = Math.min(mn[i], w[i]); mx[i] = Math.max(mx[i], w[i]); }
          }
    }
    if (mn[0] !== Infinity) {
      const size = mx.map((v, i) => +(v - mn[i]).toFixed(3));
      const center = mx.map((v, i) => +((v + mn[i]) / 2).toFixed(2));
      results.push(`${n.name} size=${size.join('x')} center=${center.join(',')}`);
    }
  }
  for (const c of n.children ?? []) walk(c, world);
}
for (const i of j.scenes[j.scene ?? 0].nodes) walk(i, mat4Identity());
console.log(results.slice(0, limit).join('\n'));
console.log(`(matched ${results.length})`);
