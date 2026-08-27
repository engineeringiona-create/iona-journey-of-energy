import * as THREE from 'three';
import { reduceMotion } from './scene-utils.js';

/* Ported from a claude.ai/design Design Compendium component
   ("Three.js sarmalı scroll animasyonu" / Helix Background.dc.html) —
   that file only runs inside the design-canvas runtime (support.js's
   DCLogic/React wrapper, THREE loaded from a CDN script tag), so this
   is the same helix-build/scroll-animate logic rewritten as a plain
   ES module against this project's own `three` npm dependency,
   matching the initXScene(canvas) shape of expo-scene.js/
   genset-scene.js. Homepage-only (main-anasayfa.js) — the other pages
   keep the lightweight flat-SVG .iona-dna-bg watermark instead of a
   second WebGL context each. */

const TURNS = 3.2;
const DOT_SIZE = 1;
const SPIN = 1;
const SHOW_RUNGS = true;
const RADIUS = 3.2;
const HEIGHT = 22;

/* yellow -> olive -> green -> teal ramp, from the original design. */
const RAMP_STOPS = [
  [0.0, '#f4bf00'],
  [0.22, '#c9b21c'],
  [0.42, '#8a9a2b'],
  [0.6, '#2f8f3e'],
  [0.78, '#0f8a63'],
  [1.0, '#b8c62a']
];

function rampColor(t) {
  let a = RAMP_STOPS[0];
  let b = RAMP_STOPS[RAMP_STOPS.length - 1];
  for (let i = 0; i < RAMP_STOPS.length - 1; i++) {
    if (t >= RAMP_STOPS[i][0] && t <= RAMP_STOPS[i + 1][0]) {
      a = RAMP_STOPS[i];
      b = RAMP_STOPS[i + 1];
      break;
    }
  }
  const f = (t - a[0]) / Math.max(1e-6, b[0] - a[0]);
  return new THREE.Color(a[1]).lerp(new THREE.Color(b[1]), f);
}

function dotTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.beginPath();
  g.arc(32, 32, 30, 0, Math.PI * 2);
  g.fillStyle = '#fff';
  g.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

function buildHelix(tex) {
  const steps = Math.round(TURNS * 44);
  const group = new THREE.Group();

  const dotPos = [];
  const dotCol = [];
  const dotScale = [];
  const linePos = [];
  const lineCol = [];

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const ang = t * TURNS * Math.PI * 2;
    const y = (t - 0.5) * HEIGHT;
    const col = rampColor(t);
    const p1 = new THREE.Vector3(Math.cos(ang) * RADIUS, y, Math.sin(ang) * RADIUS);
    const p2 = new THREE.Vector3(Math.cos(ang + Math.PI) * RADIUS, y, Math.sin(ang + Math.PI) * RADIUS);

    [p1, p2].forEach((p, k) => {
      dotPos.push(p.x, p.y, p.z);
      dotCol.push(col.r, col.g, col.b);
      dotScale.push((k === 0 ? 1 : 0.86) * (0.8 + 0.35 * Math.abs(Math.sin(ang))));
    });

    if (SHOW_RUNGS && i % 2 === 0) {
      const segs = 8;
      for (let s = 0; s < segs; s++) {
        const a = p1.clone().lerp(p2, s / segs);
        const b = p1.clone().lerp(p2, (s + 1) / segs);
        linePos.push(a.x, a.y, a.z, b.x, b.y, b.z);
        lineCol.push(col.r, col.g, col.b, col.r, col.g, col.b);
      }
      const mid = p1.clone().lerp(p2, 0.34 + (0.3 * ((i / 2) % 3)) / 3);
      dotPos.push(mid.x, mid.y, mid.z);
      dotCol.push(col.r, col.g, col.b);
      dotScale.push(0.34);
    }
  }

  const dg = new THREE.BufferGeometry();
  dg.setAttribute('position', new THREE.Float32BufferAttribute(dotPos, 3));
  dg.setAttribute('color', new THREE.Float32BufferAttribute(dotCol, 3));
  dg.setAttribute('aScale', new THREE.Float32BufferAttribute(dotScale, 1));

  const mat = new THREE.ShaderMaterial({
    uniforms: { uTex: { value: tex }, uSize: { value: 26 * DOT_SIZE } },
    vertexShader: `
      attribute float aScale; varying vec3 vC;
      uniform float uSize;
      void main(){
        vC = color;
        vec4 mv = modelViewMatrix * vec4(position,1.0);
        gl_PointSize = uSize * aScale * (1.0 / -mv.z) * 8.0;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform sampler2D uTex; varying vec3 vC;
      void main(){
        float a = texture2D(uTex, gl_PointCoord).a;
        if (a < 0.35) discard;
        gl_FragColor = vec4(vC, a);
      }`,
    transparent: true,
    vertexColors: true,
    depthWrite: false
  });
  group.add(new THREE.Points(dg, mat));

  if (SHOW_RUNGS) {
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.Float32BufferAttribute(linePos, 3));
    lg.setAttribute('color', new THREE.Float32BufferAttribute(lineCol, 3));
    group.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.75 })));
  }
  return group;
}

/* progress (0..1) is read straight off real document scroll, same as
   the original design — Lenis smooths the *visual* scroll but doesn't
   virtualize it into a transform (see initSmoothScroll's own comment
   in common.js), so window.scrollY stays a valid, real progress
   source here without needing to plug into GSAP/ScrollTrigger. */
export function initHelixScrollBg(canvas) {
  if (!canvas) return undefined;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 200);
  camera.position.set(0, 0, 34);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(window.innerWidth, window.innerHeight);

  const helix = buildHelix(dotTexture());
  scene.add(helix);
  renderer.render(scene, camera);

  if (reduceMotion) return () => renderer.dispose();

  const points = helix.children[0];
  const lines = helix.children[1];
  const colorAttr = points.geometry.attributes.color;
  const lineColorAttr = lines ? lines.geometry.attributes.color : null;

  let target = 0;
  let current = 0;
  let frame;

  const onScroll = () => {
    const doc = document.documentElement;
    const max = Math.max(1, doc.scrollHeight - window.innerHeight);
    target = (window.scrollY || doc.scrollTop || 0) / max;
  };
  const onResize = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize);
  onScroll();

  const loop = () => {
    current += (target - current) * 0.08;
    const p = current;
    helix.rotation.y = p * Math.PI * 4 * SPIN;
    helix.rotation.z = -0.14 + p * 0.1;
    helix.position.y = p * 8;
    camera.position.z = 34 - p * 6;

    const n = colorAttr.count;
    for (let i = 0; i < n; i++) {
      const col = rampColor((i / n + p * 0.9) % 1);
      colorAttr.array[i * 3] = col.r;
      colorAttr.array[i * 3 + 1] = col.g;
      colorAttr.array[i * 3 + 2] = col.b;
    }
    colorAttr.needsUpdate = true;

    if (lineColorAttr) {
      const m = lineColorAttr.count;
      for (let i = 0; i < m; i++) {
        const col = rampColor((i / m + p * 0.9) % 1);
        lineColorAttr.array[i * 3] = col.r;
        lineColorAttr.array[i * 3 + 1] = col.g;
        lineColorAttr.array[i * 3 + 2] = col.b;
      }
      lineColorAttr.needsUpdate = true;
    }

    renderer.render(scene, camera);
    frame = requestAnimationFrame(loop);
  };
  loop();

  return () => {
    cancelAnimationFrame(frame);
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onResize);
    renderer.dispose();
  };
}
