// One-off GLB inspector: node scripts/inspect-glb.mjs <file.glb> [--tree]
import fs from 'node:fs';

const file = process.argv[2];
const showTree = process.argv.includes('--tree');
const b = fs.readFileSync(file);
const jsonLen = b.readUInt32LE(12);
const j = JSON.parse(b.subarray(20, 20 + jsonLen).toString());
const nodes = j.nodes ?? [];

console.log('file bytes:', b.length);
console.log('nodes:', nodes.length, ' meshes:', (j.meshes ?? []).length, ' images:', (j.images ?? []).length);
console.log('MATERIALS:');
for (const m of j.materials ?? []) {
  const p = m.pbrMetallicRoughness ?? {};
  const c = (p.baseColorFactor ?? []).map((x) => +x.toFixed(3)).join(',');
  console.log(`  - ${m.name} | rgba ${c} | metal ${p.metallicFactor} | rough ${p.roughnessFactor} | tex ${p.baseColorTexture ? 'yes' : 'no'}`);
}

const sceneNodes = j.scenes[j.scene ?? 0].nodes;
const name = (i) => nodes[i].name ?? '#' + i;

console.log('TOP LEVEL:');
for (const i of sceneNodes) console.log('  *', name(i), 'children:', (nodes[i].children ?? []).length);

// per top-level structure: unique base mesh names (with material index)
const meshMat = (mi) => (j.meshes[mi].primitives ?? []).map((p) => p.material).join('/');
function collect(i, set) {
  const n = nodes[i];
  if (n.mesh !== undefined) {
    const base = (n.name ?? '').replace(/_\d+$/, '');
    set.add(`${base} [mat ${meshMat(n.mesh)}]`);
  }
  for (const c of n.children ?? []) collect(c, set);
}
const roots = [];
for (const i of sceneNodes) {
  if ((nodes[i].children ?? []).length && nodes[i].mesh === undefined) roots.push(i);
}
const tops = roots.length === 1 ? (nodes[roots[0]].children ?? []) : sceneNodes;
console.log('STRUCTURES:');
for (const i of tops) {
  const set = new Set();
  collect(i, set);
  console.log(`\n== ${name(i)} (${set.size} unique) ==`);
  console.log('  ' + [...set].sort().join('\n  '));
}

if (showTree) {
  const dump = (i, d) => {
    const n = nodes[i];
    console.log(' '.repeat(d * 2) + (n.name ?? '#' + i) + (n.mesh !== undefined ? ' [mesh]' : ''));
    for (const c of n.children ?? []) dump(c, d + 1);
  };
  for (const i of sceneNodes) dump(i, 0);
}
