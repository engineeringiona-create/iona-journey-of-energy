import { applyStructureOverrides } from '../src/components/DigitalTwin/plantStructureOverrides.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Box3, PerspectiveCamera, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { fitPerspectiveBox, fitPerspectiveObject } from '../src/components/DigitalTwin/cameraFit.js';
import { computeYield, WASTE_PROFILES, normalizeTons } from '../src/lib/biogasMath.js';

const views = [[1, .8, 1], [.65, .42, .75], [-1, .5, 1]];
const aspects = [320 / 460, 390 / 460, 768 / 580, 1, 1.4, 2, 3.5];
function checkFit(box, aspect, direction) {
  const camera = new PerspectiveCamera(35, aspect, .1, 5000);
  const fit = fitPerspectiveBox(box, camera, new Vector3(...direction));
  camera.position.copy(fit.position);
  camera.lookAt(fit.center);
  camera.updateMatrixWorld(true);
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
    const ndc = new Vector3(x, y, z).project(camera);
    assert.ok(Math.abs(ndc.x) < 1 && Math.abs(ndc.y) < 1 && ndc.z > -1 && ndc.z < 1,
      `Clipped corner: aspect=${aspect}, point=${ndc.toArray()}`);
  }
}
test('Perspective fit contains a deep facility in portrait, landscape and translated coordinates', () => {
  for (const aspect of aspects) for (const view of views) {
    checkFit(new Box3(new Vector3(-45, -2, -39), new Vector3(45, 35, 39)), aspect, view);
    checkFit(new Box3(new Vector3(250, 90, -100), new Vector3(350, 150, -5)), aspect, view);
  }
});
test('Actual GLB and each selectable structure fit all supported aspect ratios', async () => {
  const bytes = await readFile(new URL('../public/models/iona-tesis-3d.glb', import.meta.url));
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  const root = gltf.scene.getObjectByName('biogas_plant');
  assert.ok(root, 'Expected facility hierarchy');
  for (const node of [root, ...['digester', 'pump_room', 'engine_room', 'scada_room', 'feed_pool'].map(name => root.getObjectByName(name))]) {
    assert.ok(node, 'Selectable building exists');
    const box = new Box3().setFromObject(node);
    for (const aspect of aspects) for (const view of views) checkFit(box, aspect, view);
  }
});
test('CHP calculations conserve the configured electrical/thermal energy split', () => {
  for (const profile of Object.values(WASTE_PROFILES)) for (const tons of [10, 50, 500]) {
    const result = computeYield(tons, profile);
    const dailyEnergy = tons * profile.yieldM3PerTon * profile.ch4 * 9.94;
    assert.ok(Math.abs((result.installedElectricalKWe + result.installedThermalKWth) * 24 - dailyEnergy * .85) < 1e-6);
    assert.ok(Math.abs(result.annualElectricityMWh - result.installedElectricalKWe * 8760 * .92 / 1000) < 1e-6);
    assert.ok(Math.abs(result.annualCO2AvoidedTon - result.annualElectricityMWh * .45) < 1e-6);
    assert.ok(Object.values(result).every(Number.isFinite));
  }
  assert.equal(computeYield(50, WASTE_PROFILES.cattle).installedElectricalKWe, 124.25);
});
test('Number-field commits handle cleared drafts, invalid values, limits and slider step', () => {
  for (const [value, expected] of [['', 50], ['invalid', 50], [Infinity, 50], [-50, 10], [0, 10], [13, 15], [497, 495], [999, 500]]) {
    assert.equal(normalizeTons(value), expected);
  }
  assert.equal(normalizeTons('', 125), 125);
});


test('Geometry framing contains the overridden plant at phone, tablet and desktop sizes', async () => {
  const bytes = await readFile(new URL('../public/models/iona-tesis-3d.glb', import.meta.url));
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  const root = gltf.scene.getObjectByName('biogas_plant');
  applyStructureOverrides(root);
  for (const aspect of aspects) {
    const camera = new PerspectiveCamera(35, aspect, .1, 5000);
    const fit = fitPerspectiveObject(root, camera, new Vector3(1, .8, 1), 1.06);
    camera.position.copy(fit.position); camera.lookAt(fit.center); camera.updateMatrixWorld(true);
    let extent = 0;
    const point = new Vector3();
    root.traverseVisible(node => {
      const positions = node.geometry?.attributes?.position;
      if (!node.isMesh || !positions) return;
      for (let i = 0; i < positions.count; i++) {
        point.fromBufferAttribute(positions, i).applyMatrix4(node.matrixWorld).project(camera);
        assert.ok(Math.abs(point.x) <= 1 && Math.abs(point.y) <= 1 && point.z > -1 && point.z < 1, `Clipped geometry at ${aspect}`);
        extent = Math.max(extent, Math.abs(point.x), Math.abs(point.y));
      }
    });
    assert.ok(extent > .9, `Model wastes camera space at ${aspect}: ${extent}`);
  }
});
