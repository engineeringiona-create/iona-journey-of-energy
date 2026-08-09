import * as THREE from 'three';
import { gsap } from 'gsap';
import { buildAgitator } from './models/agitator-model.js';
import { buildGenset } from './models/cg170b-model.js';
import { buildPump } from './models/pump-model.js';
import {
  MOBILE_BREAKPOINT, buildRig, collectMaterials, buildEnvironment, createRenderer, addStudioLights,
  isDarkMode, relightScene
} from './scene-utils.js';

/* ---------------------------------------------------------------
   The Teknoloji "Expo": one shared canvas hosting both product
   models. Each machine plays a one-time cinematic assembly the
   first time its text block scrolls into view — parts fly in from
   off-canvas, twirl, and snap together — then stays assembled
   forever (it is never re-exploded). Once assembled it idles with
   its own "operating" animation plus a continuous mechanical
   shake. Moving between sections shrinks the leaving machine down
   and drops it away below frame, then grows/raises it back on
   return — the underlying geometry itself never resets.
---------------------------------------------------------------- */

const ENTRY_EXPLODE_MULT = 4.2;
const ASSEMBLE_DURATION = 1.7;
const SHAKE_POS_AMP = 0.012;
const SHAKE_ROT_AMP = 0.006;

function armMachine(mode) {
  mode.parts.forEach((part) => {
    const o = part.object;
    if (!o.userData.home || !part.explode) return;
    o.position.copy(o.userData.home).addScaledVector(part.explode, ENTRY_EXPLODE_MULT);
  });
  mode.outer.position.set(mode.base.x + mode.entry.dx, mode.base.y + mode.entry.dy, mode.entry.dz);
  mode.outer.scale.setScalar(mode.entry.scale);
  mode.spin.rotation.y = mode.baseRotationY + mode.entry.spin;
  mode.materials.forEach((m) => { m.opacity = 0; });
}

function playAssemble(mode, canvas, updateStacking) {
  if (mode.assembled || mode.playing) return;
  mode.playing = true;
  updateStacking();

  const tl = gsap.timeline({
    onComplete: () => { mode.assembled = true; mode.playing = false; updateStacking(); }
  });

  tl.to(mode.materials, { opacity: 1, duration: 1.0, ease: 'power1.out' }, 0);
  tl.to(mode.outer.position, { x: mode.base.x, y: mode.base.y, z: 0, duration: ASSEMBLE_DURATION, ease: 'power3.out' }, 0.1);
  tl.to(mode.outer.scale, { x: 1, y: 1, z: 1, duration: ASSEMBLE_DURATION, ease: 'back.out(1.4)' }, 0.1);
  tl.to(mode.spin.rotation, { y: mode.baseRotationY, duration: ASSEMBLE_DURATION + 0.15, ease: 'power3.out' }, 0.1);
  if (mode.heatMaterials && mode.heatMaterials.length) {
    tl.to(mode.heatMaterials, { emissiveIntensity: 0.85, duration: 2.2, ease: 'power1.inOut' }, 0.3);
  }

  const proxy = { e: 1 };
  tl.to(proxy, {
    e: 0,
    duration: ASSEMBLE_DURATION,
    ease: 'back.out(1.6)',
    onUpdate: () => {
      mode.parts.forEach((part) => {
        const o = part.object;
        if (!o.userData.home || !part.explode) return;
        o.position.copy(o.userData.home).addScaledVector(part.explode, proxy.e * ENTRY_EXPLODE_MULT);
      });
    }
  }, 0.15);
}

/* Hand-off between machines is a retreat/return in scale + position, not
   an opacity dissolve — the leaving machine shrinks and drops away below
   frame instead of fading in place. mode.base is the same Vector2 the
   per-frame shake in applyShake() reads every tick, so tweening it (rather
   than mode.outer.position directly) survives the shake overwrite. */
const RETREAT_DROP = 4.2;
const RETREAT_SCALE = 0.01;

function enterSection(mode) {
  if (!mode.assembled) return;
  mode.retreating = false;
  gsap.to(mode.materials, { opacity: 1, duration: 0.5, ease: 'power2.out', overwrite: true });
  gsap.to(mode.outer.scale, { x: 1, y: 1, z: 1, duration: 0.85, ease: 'power3.out', overwrite: 'auto' });
  gsap.to(mode.base, { x: mode.homeX, y: mode.homeY, duration: 0.85, ease: 'power3.out', overwrite: 'auto' });
}

function leaveSection(mode, updateStacking) {
  if (!mode.assembled) return;
  mode.retreating = true;
  gsap.to(mode.outer.scale, {
    x: RETREAT_SCALE, y: RETREAT_SCALE, z: RETREAT_SCALE,
    duration: 0.6, ease: 'power2.out', overwrite: 'auto'
  });
  gsap.to(mode.base, {
    y: mode.homeY - RETREAT_DROP,
    duration: 0.6, ease: 'power2.out', overwrite: 'auto',
    onComplete: () => { mode.retreating = false; updateStacking(); }
  });
}

export function initExpoScene(canvas) {
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

  /* ---------------- Agitator ---------------- */
  const { root: agRoot, parts: agParts } = buildAgitator();
  const agRig = buildRig(scene, agRoot, 5.6, { z: Math.PI * 0.07, y: Math.PI * 0.05 });
  const agMaterials = collectMaterials(agRoot);
  const agSpinners = agParts.filter((p) => p.spin).map((p) => p.object);
  const agBase = new THREE.Vector2();
  const agMode = {
    outer: agRig.outer, spin: agRig.spin, parts: agParts, materials: agMaterials,
    base: agBase, homeX: 0, homeY: 0, baseRotationY: 0, assembled: false, playing: false, retreating: false, seed: 3.1,
    entry: { dx: 2.0, dy: -6.0, dz: 1.6, scale: 0.3, spin: Math.PI * 3 }
  };

  /* ---------------- CAT genset ---------------- */
  const { root: gsRoot, parts: gsParts, anim: gsAnim } = buildGenset();
  const gsRig = buildRig(scene, gsRoot, 6.8, { y: Math.PI * 0.18 });
  const gsMaterials = collectMaterials(gsRoot);
  const gsHeatMaterials = Array.from(new Set(gsAnim.heatMats || []));
  gsHeatMaterials.forEach((m) => { m.emissiveIntensity = 0; });
  const gsBase = new THREE.Vector2();
  const gsMode = {
    outer: gsRig.outer, spin: gsRig.spin, parts: gsParts, materials: gsMaterials,
    heatMaterials: gsHeatMaterials,
    base: gsBase, homeX: 0, homeY: 0, baseRotationY: Math.PI * 0.18, assembled: false, playing: false, retreating: false, seed: 9.7,
    entry: { dx: 2.0, dy: 6.0, dz: 1.6, scale: 0.3, spin: -Math.PI * 3 }
  };

  /* ---------------- Mono pump (GLTF, loads async) ---------------- */
  const pmBase = new THREE.Vector2();
  const pmMode = {
    outer: null, spin: null, parts: [], materials: [],
    base: pmBase, homeX: 0, homeY: 0, baseRotationY: Math.PI * 0.05, assembled: false, playing: false, retreating: false, seed: 5.4,
    entry: { dx: 2.0, dy: -6.0, dz: 1.6, scale: 0.3, spin: Math.PI * 3 },
    ready: false, pendingEnter: false
  };
  let pmSpinners = [];

  buildPump().then(({ root: pmRoot, parts: pmParts }) => {
    const pmRig = buildRig(scene, pmRoot, 6.2, { y: Math.PI * 0.05 });
    pmMode.outer = pmRig.outer;
    pmMode.spin = pmRig.spin;
    pmMode.parts = pmParts;
    pmMode.materials = collectMaterials(pmRoot);
    pmSpinners = pmParts.filter((p) => p.spin).map((p) => p.object);
    pmMode.ready = true;
    layout();
    if (pmMode.pendingEnter) {
      pmMode.pendingEnter = false;
      playAssemble(pmMode, canvas, updateCanvasStacking);
    }
  });

  /* Only lift the canvas above the reading text while a machine is doing
     its one-time fly-in cinematic. If another machine is still retreating
     (mid hand-off, see leaveSection) we hold off — otherwise that shrinking
     machine gets carried along above the text too, since z-index applies
     to the whole shared canvas, not to individual meshes. */
  function updateCanvasStacking() {
    const anyRetreating = agMode.retreating || gsMode.retreating || pmMode.retreating;
    const inFront = !anyRetreating && (agMode.playing || gsMode.playing || pmMode.playing);
    canvas.style.zIndex = inFront ? '20' : '0';
  }

  /* With the hand-off gaps as short as they are now, a new section's own
     ScrollTrigger can fire onEnter *before* the previous section's onLeave
     — the two triggers are independent and don't know about each other.
     Left alone, that means the incoming machine starts its cinematic (and
     the z-index lift that comes with it) while the outgoing one is still
     sitting there fully assembled, dragging it above the text too. So
     entering any machine explicitly retreats every other still-forward
     machine first, instead of relying on that machine's own onLeave to
     have already fired. */
  function retreatOthers(except) {
    [agMode, gsMode, pmMode].forEach((m) => {
      if (m !== except && m.assembled && !m.retreating) leaveSection(m, updateCanvasStacking);
    });
  }

  function layout() {
    const mobile = window.innerWidth < MOBILE_BREAKPOINT;
    agBase.set(mobile ? 0 : 4.6, mobile ? 0.5 : 0.2);
    gsBase.set(mobile ? 0 : 5.1, mobile ? -0.5 : -0.3);
    pmBase.set(mobile ? 0 : 4.8, mobile ? 0.5 : 0.1);
    agMode.homeX = agBase.x; agMode.homeY = agBase.y;
    gsMode.homeX = gsBase.x; gsMode.homeY = gsBase.y;
    pmMode.homeX = pmBase.x; pmMode.homeY = pmBase.y;
    camera.fov = mobile ? 40 : 32;
    camera.position.z = mobile ? 22 : 16;
    camera.updateProjectionMatrix();
    if (!agMode.assembled && !agMode.playing) armMachine(agMode);
    if (!gsMode.assembled && !gsMode.playing) armMachine(gsMode);
    if (pmMode.ready && !pmMode.assembled && !pmMode.playing) armMachine(pmMode);
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
  function applyShake(mode, t) {
    if (!mode.assembled) return;
    const sx = Math.sin(t * 17.3 + mode.seed) * 0.5 + Math.sin(t * 9.1 + mode.seed * 1.7) * 0.3 + Math.sin(t * 29 + mode.seed * 2.3) * 0.2;
    const sy = Math.sin(t * 15.1 + mode.seed * 1.3) * 0.5 + Math.sin(t * 23.7 + mode.seed * 0.6) * 0.3 + Math.sin(t * 8.3 + mode.seed * 3.1) * 0.2;
    const sz = Math.sin(t * 19.9 + mode.seed * 2.1) * 0.6 + Math.sin(t * 11.4 + mode.seed * 0.9) * 0.4;
    const rx = Math.sin(t * 21.7 + mode.seed * 1.9) * 0.6 + Math.sin(t * 13.3 + mode.seed * 2.7) * 0.4;
    const rz = Math.sin(t * 16.4 + mode.seed * 0.4) * 0.6 + Math.sin(t * 27.8 + mode.seed * 1.1) * 0.4;
    mode.outer.position.x = mode.base.x + sx * SHAKE_POS_AMP;
    mode.outer.position.y = mode.base.y + sy * SHAKE_POS_AMP;
    mode.outer.position.z = sz * SHAKE_POS_AMP;
    mode.spin.rotation.x = rx * SHAKE_ROT_AMP;
    mode.spin.rotation.y = mode.baseRotationY;
    mode.spin.rotation.z = rz * SHAKE_ROT_AMP;
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    const t = now / 1000;
    lastTime = now;

    if (agMode.assembled) {
      agSpinners.forEach((o) => { o.rotation.x += dt * 1.7; });
      applyShake(agMode, t);
    }
    if (gsMode.assembled) {
      if (gsAnim.crank) gsAnim.crank.rotation.x += dt * 2.6;
      if (gsAnim.flywheel) gsAnim.flywheel.rotation.x += dt * 2.6;
      if (gsAnim.rotor) gsAnim.rotor.rotation.x += dt * 2.6;
      (gsAnim.turbos || []).forEach((r) => { r.rotation.x += dt * 11; });
      applyShake(gsMode, t);
    }
    if (pmMode.ready && pmMode.assembled) {
      pmSpinners.forEach((o) => { o.rotation.x += dt * 2.2; });
      applyShake(pmMode, t);
    }

    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  return {
    camera,
    renderer,
    agitator: {
      outer: agRig.outer,
      enterSection: () => {
        retreatOthers(agMode);
        agMode.assembled ? enterSection(agMode) : playAssemble(agMode, canvas, updateCanvasStacking);
      },
      leaveSection: () => leaveSection(agMode, updateCanvasStacking)
    },
    genset: {
      outer: gsRig.outer,
      enterSection: () => {
        retreatOthers(gsMode);
        gsMode.assembled ? enterSection(gsMode) : playAssemble(gsMode, canvas, updateCanvasStacking);
      },
      leaveSection: () => leaveSection(gsMode, updateCanvasStacking)
    },
    pump: {
      get outer() { return pmMode.outer; },
      enterSection: () => {
        retreatOthers(pmMode);
        if (!pmMode.ready) { pmMode.pendingEnter = true; return; }
        pmMode.assembled ? enterSection(pmMode) : playAssemble(pmMode, canvas, updateCanvasStacking);
      },
      leaveSection: () => { if (pmMode.ready) leaveSection(pmMode, updateCanvasStacking); }
    }
  };
}
