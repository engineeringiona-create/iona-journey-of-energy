import { applyStructureOverrides } from '../src/components/DigitalTwin/plantStructureOverrides.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Box3, PerspectiveCamera, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { fitPerspectiveBox, fitPerspectiveObject } from '../src/components/DigitalTwin/cameraFit.js';
import { readGlbJson, subtreeBounds } from '../scripts/glbBounds.mjs';
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
/* Bu iki test 2026-09-19'a kadar `public/models/iona-tesis-3d.glb`'yi okuyordu.
   O dosya aynı gün model-lab/src/ altına taşındı — çalışma zamanında hiçbir şey
   onu yüklemiyor (site Draco'lu bake'i yüklüyor), yani 3 MB'lık build-time
   kaynağı her deploy'a kopyalanıyordu. Testler güncellenmediği için o günden
   beri ENOENT ile patlıyorlardı.

   Artık YAYINA ÇIKAN dosya sınanıyor: iona-tesis-3d.draco.glb. Geometri
   çözülmüyor — Node'da Draco çözücüsü çalıştırmak tarayıcı Worker'ı ister —
   bunun yerine glTF'in POSITION erişimcilerindeki min/max okunuyor; onlar
   Draco'dan sonra da JSON parçasında duruyor (bkz. scripts/glbBounds.mjs).
   Sınır kutusu gerçek geometrinin üst kümesi olduğu için "kırpılmıyor mu"
   kontrolü bu yolla ancak DAHA muhafazakâr olur, gevşek değil. */
const SHIPPED_GLB = fileURLToPath(new URL('../public/models/iona-tesis-3d.draco.glb', import.meta.url));
const SELECTABLE = ['digester', 'pump_room', 'engine_room', 'scada_room', 'feed_pool'];

test('Shipped GLB: the plant and every selectable structure fit all supported aspect ratios', () => {
  const boxes = subtreeBounds(readGlbJson(SHIPPED_GLB), ['biogas_plant', ...SELECTABLE]);
  for (const name of ['biogas_plant', ...SELECTABLE]) {
    const bounds = boxes.get(name);
    assert.ok(bounds, `Selectable building "${name}" missing from the shipped GLB`);
    const box = new Box3(new Vector3(...bounds.min), new Vector3(...bounds.max));
    for (const aspect of aspects) for (const view of views) checkFit(box, aspect, view);
  }
});

/* Kırpmamak yetmez: model karenin ortasında ufalıp kaybolmamalı da. Çalışma
   zamanı fitPerspectiveObject(..., 1.06) ile gerçek köşeleri çerçeveliyor;
   burada aynı payla sınır kutusu çerçeveleniyor, ki bu doluluk için alt sınır
   verir — gerçek geometri kutudan küçük olduğuna göre en az bu kadar doldurur. */
test('Shipped GLB: the plant fills the frame instead of floating in the middle of it', () => {
  const bounds = subtreeBounds(readGlbJson(SHIPPED_GLB), ['biogas_plant']).get('biogas_plant');
  assert.ok(bounds, 'Expected facility hierarchy');
  const box = new Box3(new Vector3(...bounds.min), new Vector3(...bounds.max));
  for (const aspect of aspects) {
    const camera = new PerspectiveCamera(35, aspect, .1, 5000);
    const fit = fitPerspectiveBox(box, camera, new Vector3(1, .8, 1), 1.06);
    camera.position.copy(fit.position);
    camera.lookAt(fit.center);
    camera.updateMatrixWorld(true);
    let extent = 0;
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
      const ndc = new Vector3(x, y, z).project(camera);
      extent = Math.max(extent, Math.abs(ndc.x), Math.abs(ndc.y));
    }
    assert.ok(extent > .9, `Model wastes camera space at ${aspect}: ${extent}`);
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


/* Bu test gerçek köşe noktalarını tek tek izdüşürdüğü için sıkıştırılmamış
   geometriye ihtiyaç duyar, dolayısıyla yayındaki Draco'lu dosyayla
   çalıştırılamaz. Girdisi model-lab/src/iona-tesis-3d.glb: 3 MB'lık ham,
   bake edilmemiş model — build-time kaynağı, kasten depoda tutulmuyor
   (bkz. scripts/model-lab/bake-plant.mjs).

   Dosya yoksa test ATLANIR, patlamaz. Sessizce geçmez de: atlama sebebi
   çıktıda yazar. Yayına çıkan modelin çerçevelenmesini yukarıdaki iki test
   her koşulda sınıyor; burada ek olarak sınananlar, applyStructureOverrides'ın
   çalışma zamanında EKLEDİĞİ parçaların (pervaneler, fenerler, fan göbekleri)
   kadraja sığması. */
const RAW_GLB = fileURLToPath(new URL('../model-lab/src/iona-tesis-3d.glb', import.meta.url));
const rawModelAvailable = existsSync(RAW_GLB);

test('Geometry framing contains the overridden plant at phone, tablet and desktop sizes', {
  skip: rawModelAvailable ? false : `model-lab/src/iona-tesis-3d.glb yok — ham model depoda tutulmuyor (build-time kaynağı). Bu testi çalıştırmak için model-lab/ dizinini getirin.`
}, async () => {
  const bytes = await readFile(RAW_GLB);
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  const root = gltf.scene.getObjectByName('biogas_plant');
  assert.ok(root, 'Expected facility hierarchy');
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
