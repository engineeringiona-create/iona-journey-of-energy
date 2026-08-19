import { useEffect, useRef } from 'react';
import { reduceMotion } from '../../three/scene-utils.js';

/* Static dot-grid background, replacing the old radiating particle
   field. Dots never move — only their color reacts to cursor
   proximity, easing to black near the pointer and back to a subtle
   grey when the pointer moves away. Plain 2D canvas on its own DOM
   layer (not part of the R3F scene), so it stays strictly behind the
   facility model via z-index and never touches OrbitControls or the
   model's own render loop. */

const GRID_SPACING = 28; // px between dots
const DOT_RADIUS = 1.4; // px
const HOVER_RADIUS = 140; // px, proximity reach around cursor
const EASE_PER_MS = 0.006; // exponential-smoothing rate, frame-rate independent
const BASE_COLOR = [15, 23, 42, 0.16]; // subtle dark-slate, matches light twin-root bg
const ACTIVE_COLOR = [0, 0, 0, 1]; // black

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function mixColor(t) {
  const r = lerp(BASE_COLOR[0], ACTIVE_COLOR[0], t);
  const g = lerp(BASE_COLOR[1], ACTIVE_COLOR[1], t);
  const b = lerp(BASE_COLOR[2], ACTIVE_COLOR[2], t);
  const a = lerp(BASE_COLOR[3], ACTIVE_COLOR[3], t);
  return `rgba(${r | 0}, ${g | 0}, ${b | 0}, ${a})`;
}

export default function StaticDotGridBackground() {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return undefined;
    const ctx = canvas.getContext('2d');

    let cols = 0;
    let rows = 0;
    let width = 0;
    let height = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    // t[i] holds each dot's current blend toward black (0 = subtle, 1 = black).
    let t = new Float32Array(0);
    const active = new Set(); // indices currently easing (t > 0 or target > 0)
    let baseBitmap = null; // cached fully-subtle grid, redrawn only on resize
    const pointer = { x: -9999, y: -9999 };
    let rafId = null;
    let lastTime = 0;

    function dotIndex(col, row) {
      return row * cols + col;
    }

    function drawBaseBitmap() {
      const off = document.createElement('canvas');
      off.width = canvas.width;
      off.height = canvas.height;
      const offCtx = off.getContext('2d');
      offCtx.scale(dpr, dpr);
      offCtx.fillStyle = mixColor(0);
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          offCtx.beginPath();
          offCtx.arc(col * GRID_SPACING, row * GRID_SPACING, DOT_RADIUS, 0, Math.PI * 2);
          offCtx.fill();
        }
      }
      baseBitmap = off;
    }

    function rebuildGrid() {
      const rect = container.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      cols = Math.floor(width / GRID_SPACING) + 1;
      rows = Math.floor(height / GRID_SPACING) + 1;
      t = new Float32Array(cols * rows);
      active.clear();
      drawBaseBitmap();
      renderFrame();
    }

    function renderFrame() {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (baseBitmap) ctx.drawImage(baseBitmap, 0, 0);

      if (active.size === 0) return;
      ctx.scale(dpr, dpr);
      for (const index of active) {
        const col = index % cols;
        const row = (index / cols) | 0;
        ctx.beginPath();
        ctx.fillStyle = mixColor(t[index]);
        ctx.arc(col * GRID_SPACING, row * GRID_SPACING, DOT_RADIUS, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    function wakeLoop() {
      if (rafId != null) return;
      lastTime = performance.now();
      rafId = requestAnimationFrame(tick);
    }

    function tick(now) {
      const dt = now - lastTime;
      lastTime = now;
      const ease = 1 - Math.pow(1 - EASE_PER_MS, dt);

      let stillActive = false;
      for (const index of active) {
        const target = targetFor(index);
        t[index] += (target - t[index]) * ease;
        if (Math.abs(target - t[index]) < 0.003) {
          t[index] = target;
          if (target === 0) {
            active.delete(index);
            continue;
          }
        }
        stillActive = true;
      }

      renderFrame();

      if (stillActive) {
        rafId = requestAnimationFrame(tick);
      } else {
        rafId = null;
      }
    }

    // Recomputed per pointer move: is this dot currently inside the
    // hover radius? Kept as a function (not stored) so a dot easing
    // back out doesn't need its own stale-target bookkeeping.
    let hoveredSet = new Set();
    function targetFor(index) {
      return hoveredSet.has(index) ? 1 : 0;
    }

    function handlePointerMove(event) {
      const rect = container.getBoundingClientRect();
      pointer.x = event.clientX - rect.left;
      pointer.y = event.clientY - rect.top;
      if (pointer.x < -HOVER_RADIUS || pointer.x > width + HOVER_RADIUS ||
          pointer.y < -HOVER_RADIUS || pointer.y > height + HOVER_RADIUS) {
        hoveredSet = new Set();
        wakeLoop();
        return;
      }

      const minCol = Math.max(0, Math.floor((pointer.x - HOVER_RADIUS) / GRID_SPACING));
      const maxCol = Math.min(cols - 1, Math.ceil((pointer.x + HOVER_RADIUS) / GRID_SPACING));
      const minRow = Math.max(0, Math.floor((pointer.y - HOVER_RADIUS) / GRID_SPACING));
      const maxRow = Math.min(rows - 1, Math.ceil((pointer.y + HOVER_RADIUS) / GRID_SPACING));

      const next = new Set();
      for (let row = minRow; row <= maxRow; row++) {
        for (let col = minCol; col <= maxCol; col++) {
          const dx = col * GRID_SPACING - pointer.x;
          const dy = row * GRID_SPACING - pointer.y;
          if (dx * dx + dy * dy <= HOVER_RADIUS * HOVER_RADIUS) {
            const index = dotIndex(col, row);
            next.add(index);
            active.add(index);
          }
        }
      }
      // Dots that were hovered last move but aren't anymore still need
      // to stay in `active` so they ease back to 0 — only drop them
      // once fully settled (handled in tick()).
      for (const index of hoveredSet) {
        if (!next.has(index)) active.add(index);
      }
      hoveredSet = next;
      wakeLoop();
    }

    rebuildGrid();

    const resizeObserver = new ResizeObserver(() => rebuildGrid());
    resizeObserver.observe(container);

    if (!reduceMotion) {
      window.addEventListener('pointermove', handlePointerMove);
    }

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('pointermove', handlePointerMove);
      if (rafId != null) cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div ref={containerRef} className="absolute inset-0 z-0 pointer-events-none">
      <canvas ref={canvasRef} />
    </div>
  );
}
