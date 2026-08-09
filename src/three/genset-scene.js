import * as THREE from 'three';
import { buildGenset } from './models/cg170b-model.js';
import {
  MOBILE_BREAKPOINT, reduceMotion, buildRig, collectMaterials,
  makeDisassembleController, buildEnvironment, createRenderer, addStudioLights,
  isDarkMode, relightScene
} from './scene-utils.js';

/* Etki page's sole model: the CAT CG170B-20 genset. Full-screen fixed
   canvas dedicated to this one page. */
export function initGensetScene(canvas) {
  const renderer = createRenderer(canvas);
  const scene = new THREE.Scene();
  let currentEnv = buildEnvironment(renderer, isDarkMode());
  scene.environment = currentEnv;
  let currentLights = addStudioLights(scene, isDarkMode());

  document.addEventListener('themechange', (e) => {
    const { env, lights } = relightScene(scene, renderer, currentEnv, currentLights, e.detail.dark);
    currentEnv = env;
    currentLights = lights;
    scene.environment = currentEnv;
  });

  const camera = new THREE.PerspectiveCamera(32, window.innerWidth / window.innerHeight, 0.1, 400);
  camera.position.set(0, 0.6, 16);
  camera.lookAt(0, 0, 0);

  const { root, parts, anim } = buildGenset();
  const rig = buildRig(scene, root, 9.4, { y: Math.PI * 0.18 });
  const materials = collectMaterials(root);
  const heatMaterials = Array.from(new Set(anim.heatMats || []));
  heatMaterials.forEach((m) => { m.emissiveIntensity = 0; });

  const base = new THREE.Vector2();
  const setProgress = makeDisassembleController(rig.outer, rig.spin, parts, {
    getBase: () => base,
    spinRad: 2.9,
    keyframes: [
      { p: 0.00, dx: -3.8, dy: -5.4, scale: 0.5, explode: 0 },
      { p: 0.30, dx: 0, dy: 0, scale: 1.0, explode: 0.2 },
      { p: 0.55, dx: 1.4, dy: 1.0, scale: 1.45, explode: 1.0 },
      { p: 0.80, dx: -0.3, dy: -0.15, scale: 1.0, explode: 0.15 },
      { p: 1.00, dx: -3.6, dy: 5.2, scale: 0.55, explode: 0 }
    ]
  });

  let lastProgress = 0;

  function layout() {
    const mobile = window.innerWidth < MOBILE_BREAKPOINT;
    base.set(mobile ? 0 : 3.4, mobile ? -2.6 : -0.5);
    camera.fov = mobile ? 40 : 32;
    camera.position.z = mobile ? 21 : 16;
    camera.updateProjectionMatrix();
    setProgress(lastProgress);
  }

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    layout();
  }
  window.addEventListener('resize', resize);
  resize();

  let lastTime = performance.now();
  const rotSpeed = reduceMotion ? 0 : 1;
  function frame(now) {
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;
    if (anim.crank) anim.crank.rotation.x += dt * 2.6 * rotSpeed;
    if (anim.flywheel) anim.flywheel.rotation.x += dt * 2.6 * rotSpeed;
    if (anim.rotor) anim.rotor.rotation.x += dt * 2.6 * rotSpeed;
    (anim.turbos || []).forEach((r) => { r.rotation.x += dt * 11 * rotSpeed; });
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  return {
    camera,
    renderer,
    outer: rig.outer,
    materials,
    heatMaterials,
    setProgress: (p) => { lastProgress = p; setProgress(p); }
  };
}
