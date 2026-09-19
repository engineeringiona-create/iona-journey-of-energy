// World-space bounding boxes for meshes whose name matches a regex.
// node scripts/glb-bounds.mjs <file.glb> <name-regex> [limit]
//
// Geometriyi çözmez, GLB'nin JSON parçasındaki erişimci min/max değerlerini
// okur — Draco'lu dosyalarda da çalışmasının sebebi bu. Asıl iş
// scripts/glbBounds.mjs'te; aynı kodu tests/engineering.test.mjs de kullanıyor.
import { readGlbJson, meshBounds } from './glbBounds.mjs';

const [file, pattern, limitArg] = process.argv.slice(2);
if (!file) {
  console.error('kullanım: node scripts/glb-bounds.mjs <file.glb> <name-regex> [limit]');
  process.exit(1);
}
const limit = Number(limitArg ?? 40);
const results = meshBounds(readGlbJson(file), new RegExp(pattern ?? '.', 'i')).map((b) => {
  const size = b.max.map((v, i) => +(v - b.min[i]).toFixed(3));
  const center = b.max.map((v, i) => +((v + b.min[i]) / 2).toFixed(2));
  return `${b.name} size=${size.join('x')} center=${center.join(',')}`;
});
console.log(results.slice(0, limit).join('\n'));
console.log(`(matched ${results.length})`);
