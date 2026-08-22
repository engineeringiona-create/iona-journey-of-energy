import * as THREE from 'three';
import { gsap } from 'gsap';

/* ---------------------------------------------------------------
   Shared helpers for the per-page Three.js scenes: genset-scene.js
   (etki.html, CAT genset only) and expo-scene.js (teknoloji.html,
   both the agitator and the genset in one scrollable expo). This
   module holds the math/utility code common across them.
---------------------------------------------------------------- */

export const MOBILE_BREAKPOINT = 768;
export const reduceMotion = typeof matchMedia === 'function'
  && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function isDarkMode() {
  return typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
}

export function centerAndScale(root, targetRadius) {
  let box = new THREE.Box3().setFromObject(root);
  const center = box.getCenter(new THREE.Vector3());
  root.position.sub(center);
  box = new THREE.Box3().setFromObject(root);
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  const scale = sphere.radius > 0 ? targetRadius / sphere.radius : 1;
  root.scale.setScalar(scale);
}

export function collectMaterials(root) {
  const set = new Set();
  root.traverse((o) => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    mats.forEach((m) => {
      m.transparent = true;
      m.opacity = 0;
      set.add(m);
    });
  });
  return Array.from(set);
}

function smoothstep(t) {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
}

const easeCache = new Map();
function resolveEase(name) {
  if (!name) return smoothstep;
  if (!easeCache.has(name)) easeCache.set(name, gsap.parseEase(name));
  const fn = easeCache.get(name);
  return (t) => fn(Math.min(1, Math.max(0, t)));
}

/* Piecewise interpolation across hand-authored keyframes, e.g.
   [{p:0, dx,dy,dz,scale,explode}, {p:0.5, ease:'power3.out', ...}, {p:1, ...}].
   Each keyframe's optional `ease` (a GSAP ease name) shapes the segment
   *arriving* at it, so the entrance can snap together heavily
   (power3.out) while the exit gets flung away with a different feel
   (power3.in) — segments without an explicit ease fall back to a plain
   smoothstep. `dz` is optional and defaults to 0 (screen-plane depth,
   no camera-ward push) so existing keyframe sets without it keep
   working unchanged. */
function samplePath(p, keys) {
  const withDz = (k) => ({ dz: 0, ...k });
  if (p <= keys[0].p) return withDz(keys[0]);
  const last = keys[keys.length - 1];
  if (p >= last.p) return withDz(last);
  for (let i = 0; i < keys.length - 1; i++) {
    const a = withDz(keys[i]), b = withDz(keys[i + 1]);
    if (p >= a.p && p <= b.p) {
      const ease = resolveEase(b.ease);
      const t = ease((p - a.p) / (b.p - a.p));
      const lerp = (k) => a[k] + (b[k] - a[k]) * t;
      return { dx: lerp('dx'), dy: lerp('dy'), dz: lerp('dz'), scale: lerp('scale'), explode: lerp('explode') };
    }
  }
  return withDz(last);
}

/* Drives the full scroll-reactive pose of a model: screen-space X/Y travel
   (added on top of the responsive base position from layout()), fluid
   rotation, a significant scale pump, and part-by-part disassembly using
   the model's own built-in explode vectors — all from one scrub progress
   value 0..1 supplied by a GSAP ScrollTrigger (scrub: 1) in the page's
   entry script. Movement only ever happens in response to setProgress
   being called, i.e. only while the user is actually scrolling. */
export function makeDisassembleController(outer, spin, parts, opts) {
  const { keyframes, spinRad, baseRotationY = 0, getBase } = opts;
  return function setProgress(p) {
    const s = samplePath(p, keyframes);
    parts.forEach((part) => {
      const o = part.object;
      if (!o.userData.home || !part.explode) return;
      o.position.copy(o.userData.home).addScaledVector(part.explode, s.explode);
    });
    const base = getBase();
    outer.position.x = base.x + s.dx;
    outer.position.y = base.y + s.dy;
    outer.position.z = s.dz;
    spin.rotation.y = baseRotationY + p * spinRad;
    spin.scale.setScalar(s.scale);
    return s.explode;
  };
}

/* "Obsidian & Emerald" studio environment — generated on a canvas, no
   external HDRI. A vertical gradient plus several softbox-style
   highlights at different equirect positions, so metallic surfaces
   pick up varied, moving specular glints as they rotate instead of
   one flat blob of light — this is what actually sells "glossy
   metal" on a PBR material, since metalness relies almost entirely
   on what the environment reflects.

   `dark` swaps the base gradient from a bright daylight-studio wash
   to a black-glass showroom (Tesla/Apple dark-hero style): the base
   goes near-black so metal reflects the room instead of a wall of
   white, while the same rim/kicker highlights stay bright so the
   models still read as crisply, dramatically lit rather than dim. */
export function buildEnvironment(renderer, dark = false) {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 512;
  const x = c.getContext('2d');

  const g = x.createLinearGradient(0, 0, 0, 512);
  if (dark) {
    g.addColorStop(0, '#2a302c');
    g.addColorStop(0.32, '#181b19');
    g.addColorStop(0.62, '#0c0e0d');
    g.addColorStop(1, '#020302');
  } else {
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.32, '#eef1ec');
    g.addColorStop(0.62, '#c7ccc3');
    g.addColorStop(1, '#75796f');
  }
  x.fillStyle = g; x.fillRect(0, 0, 1024, 512);

  const glow = (cx, cy, w, h, color, a) => {
    const rg = x.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h));
    rg.addColorStop(0, color.replace('ALPHA', a));
    rg.addColorStop(0.6, color.replace('ALPHA', a * 0.35));
    rg.addColorStop(1, color.replace('ALPHA', 0));
    x.fillStyle = rg; x.beginPath(); x.ellipse(cx, cy, w, h, 0, 0, Math.PI * 2); x.fill();
  };

  /* large soft key softbox, upper-left */
  glow(260, 90, 320, 120, 'rgba(255,255,255,ALPHA)', dark ? 0.9 : 1);
  /* tight bright kicker streak, upper-right — the crisp specular pop */
  glow(760, 60, 130, 46, 'rgba(255,255,255,ALPHA)', 1);
  /* wide top strip light */
  glow(512, 20, 420, 34, 'rgba(255,255,255,ALPHA)', dark ? 0.65 : 0.85);
  /* brand-green rim glow, lower-left */
  glow(140, 400, 260, 110, 'rgba(79,189,119,ALPHA)', dark ? 0.75 : 0.55);
  /* secondary green accent, right side */
  glow(900, 320, 220, 130, 'rgba(34,112,60,ALPHA)', dark ? 0.65 : 0.4);
  /* soft warm bounce off the floor (skipped in dark: a black-glass
     floor doesn't bounce warm light back the way a white cove does) */
  if (!dark) glow(520, 470, 380, 60, 'rgba(255,244,224,ALPHA)', 0.3);
  /* brand-orange accent kicker, low-right — dark mode only, the
     showroom's second "hero light" */
  if (dark) glow(860, 440, 200, 90, 'rgba(255,138,61,ALPHA)', 0.35);

  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromEquirectangular(tex).texture;
  pmrem.dispose(); tex.dispose();
  return env;
}

export function buildRig(scene, root, targetRadius, tilt) {
  centerAndScale(root, targetRadius);
  if (tilt) {
    root.rotation.x = tilt.x || 0;
    root.rotation.y = tilt.y || 0;
    root.rotation.z = tilt.z || 0;
  }
  const spin = new THREE.Group();
  spin.add(root);
  const outer = new THREE.Group();
  outer.add(spin);
  scene.add(outer);
  return { outer, spin, root };
}

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, alpha: true, powerPreference: 'high-performance'
  });
  /* Hard-locked to 1.0, not scaled by devicePixelRatio at all (was
     clamped to 1.75) — retina/high-DPI screens render visibly softer
     this way, a deliberate trade against the studio env map + ACES
     tonemapping's per-fragment cost, which was still tipping weaker
     GPUs below 60fps even at the 1.75 clamp. No variable pixel ratio:
     always exactly 1, on every device. */
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.setClearColor(0x000000, 0);
  return renderer;
}

/* Antialias is a WebGLRenderer constructor-only option — there's no way
   to flip it off mid-session without destroying and rebuilding the
   whole renderer/context, too disruptive to do automatically on a
   struggling machine. Pixel ratio, unlike antialias, *can* be dropped
   live (setPixelRatio triggers its own internal resize), so that's the
   actual lever here: sample a rolling average frame time, and if it's
   held under targetFps for a full sampleWindow of frames, drop the
   pixel ratio once (down to `floor`, still <= createRenderer's own 1.0
   ceiling) and stop sampling — a one-way downgrade, never upgraded back
   mid-session, since flip-flopping on noisy frame timing would itself
   be a visible stutter. Call sample(dt) once per rendered frame. */
export function createFpsGovernor(renderer, { targetFps = 45, sampleWindow = 90, floor = 0.75 } = {}) {
  let frames = 0;
  let accum = 0;
  let downgraded = false;
  return function sample(dt) {
    if (downgraded || dt <= 0) return;
    frames += 1;
    accum += dt;
    if (frames < sampleWindow) return;
    if (frames / accum < targetFps) {
      downgraded = true;
      renderer.setPixelRatio(floor);
    }
    frames = 0;
    accum = 0;
  };
}

/* Product-photography five-point rig: a strong key, a tight specular
   kicker for the "is this actually metal" glint, a brand-tinted rim for
   edge separation, a soft top fill, and a warm ground bounce — plus a
   gentle hemisphere for ambient occlusion fill so shadow sides never
   go fully dead. Paired with buildEnvironment() for the reflections
   that make metalness/roughness actually read as glossy.

   In dark mode the fills back off (less bounce light available in a
   black-glass room) while key/kicker/rim stay strong, so the model
   pops with more contrast against the page instead of going flat. */
export function addStudioLights(scene, dark = false) {
  const key = new THREE.DirectionalLight(0xfff7ec, dark ? 3.4 : 3.2);
  key.position.set(5, 7.5, 6);
  scene.add(key);

  const kicker = new THREE.DirectionalLight(0xffffff, 2.1);
  kicker.position.set(-2.5, 5, 8);
  scene.add(kicker);

  const rim = new THREE.DirectionalLight(0x4fbd77, dark ? 2.4 : 1.8);
  rim.position.set(-6, 2.5, -5);
  scene.add(rim);

  const fillTop = new THREE.DirectionalLight(0xffffff, dark ? 0.4 : 0.65);
  fillTop.position.set(0, 10, -3);
  scene.add(fillTop);

  const bounce = new THREE.DirectionalLight(0xffe9c7, dark ? 0.2 : 0.4);
  bounce.position.set(1, -6, 4);
  scene.add(bounce);

  const hemi = new THREE.HemisphereLight(0xf6f7f2, 0x2c2f29, dark ? 0.3 : 0.55);
  scene.add(hemi);

  return [key, kicker, rim, fillTop, bounce, hemi];
}

/* Rebuilds the environment map + studio lights for a mode switch:
   disposes the old env texture and lights, re-adds fresh ones tuned
   for `dark`. Returns the new env texture (caller sets
   scene.environment) and light array (caller keeps if it wants to
   relight again later). */
export function relightScene(scene, renderer, oldEnv, oldLights, dark) {
  oldLights.forEach((l) => scene.remove(l));
  if (oldEnv) oldEnv.dispose();
  const env = buildEnvironment(renderer, dark);
  const lights = addStudioLights(scene, dark);
  return { env, lights };
}
