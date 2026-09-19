/* Bake the runtime plant overrides into one GLB.
   node scripts/model-lab/bake-plant.mjs [in.glb] [out.glb]

   Input is model-lab/src/iona-tesis-3d.glb — the raw, un-baked plant. It lived
   in public/models/ until 2026-09-19 and was moved out because nothing loads
   it at runtime (the site loads the Draco'd bake), so 3 MB of build-time-only
   source was being copied into every deploy.

   That raw model is what the browser used to rebuild parts of on the fly
   (src/components/DigitalTwin/plantStructureOverrides.js:
   trapez wall, interior heating coils, opened deck, pool cover, mixers,
   canopy...). This script runs exactly that pass in Node and writes the
   result as a single GLB, so the asset IS the plant the visitor sees — ready
   for Draco (scripts/model-lab/compress-plant.sh) and reusable elsewhere.
   Node names are preserved, so GltfTwinScene's name-based material pass and
   click handling work unchanged; plantRoot.userData.ionaBaked tells the
   runtime to skip the override pass. Materials are NOT baked: the runtime
   assigns every mesh its recipe by name, exactly as before. */
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { applyStructureOverrides } from '../../src/components/DigitalTwin/plantStructureOverrides.js';

if (typeof globalThis.FileReader === 'undefined') {
  globalThis.FileReader = class {
    readAsArrayBuffer(blob) { blob.arrayBuffer().then((r) => { this.result = r; this.onloadend?.(); }); }
    readAsDataURL(blob) {
      blob.arrayBuffer().then((r) => {
        this.result = 'data:application/octet-stream;base64,' + Buffer.from(r).toString('base64');
        this.onloadend?.();
      });
    }
  };
}

const inFile = path.resolve(process.argv[2] ?? 'model-lab/src/iona-tesis-3d.glb');
const outFile = path.resolve(process.argv[3] ?? 'model-lab/out/iona-tesis-baked.glb');

const data = fs.readFileSync(inFile);
const arrayBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);

const gltf = await new Promise((resolve, reject) => {
  new GLTFLoader().parse(arrayBuffer, '', resolve, reject);
});
const scene = gltf.scene;
scene.updateMatrixWorld(true);
const plantRoot = scene.getObjectByName('biogas_plant') ?? scene;

const before = countMeshes(plantRoot);
applyStructureOverrides(plantRoot);
plantRoot.userData.ionaBaked = true;
plantRoot.userData.ionaBakedAt = new Date().toISOString();

/* Override meshes are created without a material (the runtime assigns one by
   name); the exporter needs something to write, so give those a plain
   placeholder. It is never seen: GltfTwinScene replaces it on load. */
const placeholder = new THREE.MeshStandardMaterial({ name: 'placeholder', color: '#ffffff' });
plantRoot.traverse((node) => { if (node.isMesh && !node.material) node.material = placeholder; });
scene.updateMatrixWorld(true);

const after = countMeshes(plantRoot);
const result = await new Promise((resolve, reject) => {
  new GLTFExporter().parse(scene, resolve, reject, { binary: true });
});
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, Buffer.from(result));
console.log(`in : ${inFile} (${(data.length / 1024 / 1024).toFixed(2)} MB, ${before.meshes} mesh / ${before.tris} tri)`);
console.log(`out: ${outFile} (${(fs.statSync(outFile).size / 1024 / 1024).toFixed(2)} MB, ${after.meshes} mesh / ${after.tris} tri)`);

function countMeshes(root) {
  let meshes = 0, tris = 0;
  root.traverse((n) => {
    if (!n.isMesh) return;
    meshes++;
    const idx = n.geometry.index;
    tris += Math.round((idx ? idx.count : n.geometry.attributes.position.count) / 3);
  });
  return { meshes, tris };
}
