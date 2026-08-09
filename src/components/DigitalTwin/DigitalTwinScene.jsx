import { Component, createElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bounds, ContactShadows, Html, Outlines, useCursor } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import {
  ACESFilmicToneMapping,
  CanvasTexture,
  CatmullRomCurve3,
  DoubleSide,
  Plane,
  RepeatWrapping,
  SRGBColorSpace,
  Vector3
} from 'three';
import { addStudioLights, buildEnvironment, isDarkMode, MOBILE_BREAKPOINT, relightScene } from '../../three/scene-utils.js';
import {
  CAMERA_FOV,
  DEFAULT_CAMERA_POSITION,
  MATERIAL_METALNESS,
  MATERIAL_ROUGHNESS,
  SCENE_COLORS,
  TWIN_COMPONENTS,
  UI_TEXT
} from './constants.js';
import CameraRig from './CameraRig.jsx';
import DataPanel from './DataPanel.jsx';
import useBrandColors from './useBrandColors.js';
import useI18n from './useI18n.js';

/* Coarse pointer (touch) devices have no real "hover" — checked once
   at module load, same convention as scene-utils.js's reduceMotion
   (an environmental fact, not something that changes mid-session). */
const isCoarsePointer = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

function detectCapability() {
  if (typeof document === 'undefined') return false;
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  if (!gl) return false;
  // Undefined (older Safari) is "unknown", not "low" — only bail out on a confirmed low core count.
  if (typeof navigator.hardwareConcurrency === 'number' && navigator.hardwareConcurrency < 4) return false;
  return true;
}

/* Shown instead of the 3D scene when WebGL/hardware capability check
   fails, and as the ErrorBoundary's fallback if the scene crashes at
   runtime — same UI either way so there's one visual "can't show the
   live model" state, not two. */
function DigitalTwinFallback() {
  const t = useI18n();
  return (
    <div className="relative w-full h-full overflow-hidden rounded-xl">
      <img
        src="/images/twin-digesters-overcast.jpg"
        alt={t(UI_TEXT.fallbackAlt)}
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
      <p className="absolute bottom-6 left-6 right-6 md:max-w-md text-white text-body-md">
        {t(UI_TEXT.fallbackDescription)}
      </p>
    </div>
  );
}

class DigitalTwinErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    // eslint-disable-next-line no-console
    console.error('[DigitalTwin] scene crashed, falling back to a static poster', error);
  }

  render() {
    return this.state.hasError ? <DigitalTwinFallback /> : this.props.children;
  }
}

/* tubeGeometry can't take plain JSON args like the other primitives —
   its path is a real THREE.Curve, not serializable data — so it's the
   one type reconstructed here instead of passed straight through. */
function buildGeometryArgs(part) {
  if (part.type === 'tubeGeometry') {
    const curve = new CatmullRomCurve3(part.points.map(([x, y, z]) => new Vector3(x, y, z)));
    return [curve, part.tubularSegments, part.radius, part.radialSegments, false];
  }
  return part.args;
}

/* Hover is suppressed whenever anything is selected (point 6) — once a
   station is zoomed into, a second highlight on top of (or next to)
   the selected one would just be visual noise, so isHoverActive is
   already false-gated by the caller in that state.

   `materialRefContainers` is a stable array of plain {current: null}
   objects, one per `component.geometry` entry, created once by the
   parent and handed down by identity — CameraRig.jsx reads
   `.current` off these to GSAP-tween opacity when a *different*
   station is selected, without DigitalTwinScene needing to re-render
   or CameraRig needing to know anything about JSX structure.
   `clipPlane` is the shared THREE.Plane CameraRig animates the
   `constant` of on arrival/departure for the one part flagged
   `clip: true` in constants.js (only the digester has one right now);
   every other part ignores it entirely. */
function Station({
  component,
  isSelected,
  isHoverActive,
  onSelect,
  onHoverStart,
  onHoverEnd,
  outlineColor,
  materialRefContainers,
  clipPlane,
  t
}) {
  /* component (from the static TWIN_COMPONENTS export) never changes
     identity across re-renders, so this only ever computes once per
     station for its lifetime — without it, every selection/hover
     change re-renders all 4 Stations and rebuilds the pipeline's
     CatmullRomCurve3 + Vector3 array from scratch for no reason. */
  const geometryArgsList = useMemo(() => component.geometry.map(buildGeometryArgs), [component]);
  const internalArgsList = useMemo(
    () => (component.cutaway.available ? component.cutaway.internals.map(buildGeometryArgs) : []),
    [component]
  );

  return (
    <group
      position={component.origin}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(component.id);
      }}
      onPointerOver={(event) => {
        event.stopPropagation();
        onHoverStart(component.id);
      }}
      onPointerOut={(event) => {
        event.stopPropagation();
        onHoverEnd(component.id);
      }}
    >
      {component.geometry.map((part, i) => (
        <mesh key={i} position={part.position} rotation={part.rotation}>
          {createElement(part.type, { args: geometryArgsList[i] })}
          <meshStandardMaterial
            ref={(material) => {
              materialRefContainers[i].current = material;
            }}
            color={isSelected ? SCENE_COLORS.selected : part.color}
            roughness={MATERIAL_ROUGHNESS}
            metalness={MATERIAL_METALNESS}
            transparent
            side={part.clip ? DoubleSide : undefined}
            clippingPlanes={part.clip && clipPlane ? [clipPlane] : undefined}
          />
          {isHoverActive && <Outlines thickness={0.025} color={outlineColor} angle={Math.PI} />}
        </mesh>
      ))}

      {component.cutaway.available &&
        component.cutaway.internals.map((part, i) => (
          <mesh key={`internal-${i}`} position={part.position} rotation={part.rotation}>
            {createElement(part.type, { args: internalArgsList[i] })}
            <meshStandardMaterial color={part.color} roughness={MATERIAL_ROUGHNESS} metalness={MATERIAL_METALNESS} />
          </mesh>
        ))}

      {isHoverActive && (
        <Html position={component.hoverLabel.map((v, i) => v - component.origin[i])} center>
          <span className="pointer-events-none whitespace-nowrap rounded-full border border-[var(--border-strong)] bg-[var(--surface)]/90 backdrop-blur-md px-3 py-1 font-label-caps text-label-caps text-[var(--text)] shadow-[0_10px_30px_-12px_rgba(0,0,0,0.35)]">
            {t(component.labelKey)}
          </span>
        </Html>
      )}
    </group>
  );
}

/* Same studio rig every other Three.js scene on the site uses
   (src/three/scene-utils.js) — a 5-point directional-light setup plus
   a procedural PMREM environment map for PBR reflections — called
   imperatively here since it's plain Three.js API operating on
   state.scene/state.gl, which R3F exposes directly via useThree().
   Re-lights on the same 'themechange' event common.js's theme toggle
   dispatches, exactly like src/three/expo-scene.js already does, so
   this scene's lighting mode tracks the site's dark/light toggle the
   same way the other scenes' do. */
/* addStudioLights() is shared with every other Three.js scene on the
   site (genset-scene.js, expo-scene.js) and tuned for THOSE scenes'
   framing — noticeably too hot for this one's tighter, more numerous
   low-poly surfaces ("sahne patlamışsa"). Rather than edit the shared
   rig (which would shift every other page), the returned lights are
   scaled down in place, here only, after each call — same relative
   balance between key/kicker/rim/fill/bounce, just dimmer overall. */
const LIGHT_INTENSITY_SCALE = 0.6;

function scaleLights(lights) {
  lights.forEach((light) => {
    light.intensity *= LIGHT_INTENSITY_SCALE;
  });
  return lights;
}

function LightingRig() {
  const { scene, gl } = useThree();
  const stateRef = useRef({ env: null, lights: [] });

  useEffect(() => {
    const dark = isDarkMode();
    const env = buildEnvironment(gl, dark);
    const lights = scaleLights(addStudioLights(scene, dark));
    scene.environment = env;
    stateRef.current = { env, lights };

    const handleThemeChange = (event) => {
      const { env: nextEnv, lights: nextLights } = relightScene(
        scene,
        gl,
        stateRef.current.env,
        stateRef.current.lights,
        event.detail.dark
      );
      scaleLights(nextLights);
      scene.environment = nextEnv;
      stateRef.current = { env: nextEnv, lights: nextLights };
    };
    document.addEventListener('themechange', handleThemeChange);

    return () => {
      document.removeEventListener('themechange', handleThemeChange);
      stateRef.current.lights.forEach((light) => scene.remove(light));
      if (stateRef.current.env) stateRef.current.env.dispose();
    };
  }, [scene, gl]);

  return null;
}

/* A faint engineering-blueprint grid on the ground plane, generated on
   a canvas rather than an image asset (same technique as
   buildEnvironment's procedural sky in scene-utils.js). Paired with
   drei's ContactShadows for the soft contact shadow underneath the
   facility. */
function Ground() {
  const texture = useMemo(() => {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#f3f4f5';
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = 'rgba(20,24,20,0.06)';
    ctx.lineWidth = 1;
    const step = size / 16;
    for (let i = 0; i <= size; i += step) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(size, i);
      ctx.stroke();
    }
    const tex = new CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = RepeatWrapping;
    tex.repeat.set(6, 6);
    tex.colorSpace = SRGBColorSpace;
    return tex;
  }, []);

  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <>
      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        {/* r=14 (from the old, much wider linear layout) dwarfed the
            compacted facility (~5-unit span) once the camera pulled in
            to fit it tightly — a huge empty floor made the whole model
            read as small and adrift instead of "sitting" in frame.
            r=7 keeps a visible margin around the cluster without the
            excess. */}
        <circleGeometry args={[7, 48]} />
        <meshStandardMaterial map={texture} roughness={0.9} metalness={0} />
      </mesh>
      <ContactShadows position={[0, 0.01, 0]} opacity={0.35} scale={7} blur={2.5} far={10} resolution={1024} color="#0c0e0c" />
    </>
  );
}

/* Plain DOM overlay, not 3D — sits as a sibling of <Canvas>, absolutely
   positioned over it, so it gets normal focus/tab order and screen
   reader semantics for free instead of fighting R3F's pointer events
   for keyboard support. Keyboard nav is scoped to this subtree (an
   onKeyDown here only fires once a real descendant <button> has
   focus and the event bubbles up) rather than a window-level
   listener, so it doesn't fight the site's own Escape handlers
   elsewhere on the page (common.js closes the search/lang dropdowns
   on Escape too).

   Dot clicks reuse the same toggling onSelect the 3D stations use
   (click the active dot to deselect, same as clicking the station
   itself); arrow-key stepping uses onSelectDirect instead, since
   toggling would make "step forward" occasionally step backward to
   nothing — a keyboard-only distinction, not a different feature. */
function Controls({ selectedId, onBack, onSelect, onSelectDirect, onReset, t }) {
  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      onReset();
      return;
    }
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const count = TWIN_COMPONENTS.length;
    const currentIndex = TWIN_COMPONENTS.findIndex((component) => component.id === selectedId);
    const nextIndex =
      event.key === 'ArrowRight'
        ? currentIndex === -1
          ? 0
          : (currentIndex + 1) % count
        : currentIndex === -1
          ? count - 1
          : (currentIndex - 1 + count) % count;
    onSelectDirect(TWIN_COMPONENTS[nextIndex].id);
  };

  return (
    /* drei's <Html> (hover label, DataPanel) assigns its own inline
       z-index per-frame based on camera distance — zIndexRange defaults
       to [16777271, 0], so a mounted Html element sits in the tens-of-
       millions range (see Html.js: objectZIndex()). A plain z-10 here
       loses to that outright whenever a station is hovered/selected,
       which is exactly when the Back button needs to be visible — this
       was the actual cause of "overlay kayboluyor", not a layout bug.
       z-[2000000000] safely clears drei's max regardless of camera/FOV/
       near-far tuning. pointer-events:none on the wrapper (this div
       covers the whole canvas via inset-0) keeps it from blocking
       clicks on the 3D scene between the two real controls, which
       re-enable pointer-events themselves. */
    <div className="absolute inset-0 z-[2000000000] pointer-events-none" onKeyDown={handleKeyDown}>
      {selectedId && (
        <button
          type="button"
          onClick={onBack}
          className="absolute top-4 left-4 pointer-events-auto inline-flex items-center gap-1.5 rounded-full px-4 py-2 font-label-caps text-[12px] font-bold tracking-[0.06em] text-[var(--text)] bg-[var(--surface)]/90 border border-[var(--border-strong)] backdrop-blur-md shadow-[0_10px_30px_-12px_rgba(0,0,0,0.35)] transition-colors duration-200 hover:bg-[var(--surface-2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
        >
          {t(UI_TEXT.back)}
        </button>
      )}

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-auto flex items-center gap-2">
        {TWIN_COMPONENTS.map((component) => (
          <button
            key={component.id}
            type="button"
            onClick={() => onSelect(component.id)}
            aria-label={t(component.labelKey)}
            aria-current={selectedId === component.id}
            className={`rounded-full transition-all duration-300 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] ${
              selectedId === component.id
                ? 'w-6 h-2 bg-[var(--brand)]'
                : 'w-2 h-2 bg-[var(--text-muted)]/50 hover:bg-[var(--text-muted)]'
            }`}
          />
        ))}
      </div>
    </div>
  );
}

function DigitalTwinCanvasScene() {
  const [selectedId, setSelectedId] = useState(null);
  const [arrived, setArrived] = useState(false);
  const [hoveredId, setHoveredId] = useState(null);
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT
  );
  const [frameloop, setFrameloop] = useState('always');
  const wrapperRef = useRef(null);
  const { brand } = useBrandColors();
  const t = useI18n();

  const selected = TWIN_COMPONENTS.find((component) => component.id === selectedId) ?? null;

  const handleSelect = useCallback((id) => {
    setSelectedId((current) => (current === id ? null : id));
  }, []);

  const handleReset = useCallback(() => setSelectedId(null), []);
  const handleSelectDirect = useCallback((id) => setSelectedId(id), []);

  const handleHoverStart = useCallback((id) => setHoveredId(id), []);
  const handleHoverEnd = useCallback(
    (id) => setHoveredId((current) => (current === id ? null : current)),
    []
  );

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  /* Rendering itself is only ever gated by isMobile *inside* the
     Canvas tree (hover/keyboard styling stays the same either way);
     mount.jsx already deferred loading this whole module until the
     section first entered the viewport — this second observer keeps
     watching afterwards so the render loop (and GPU/battery cost)
     pauses again once the visitor scrolls past it, without tearing
     down and re-creating the WebGL context on every scroll in/out. */
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el || typeof IntersectionObserver !== 'function') return;
    const observer = new IntersectionObserver(
      ([entry]) => setFrameloop(entry.isIntersecting ? 'always' : 'never'),
      { rootMargin: '150px 0px', threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useCursor(Boolean(hoveredId) && !selectedId && !isCoarsePointer);

  /* Stable-by-identity registries, created once and handed down to
     Station (which fills them in) and CameraRig (which reads them) —
     see the Station docblock above for why this is a plain ref
     registry instead of React state: dimming/clipping are GSAP-driven
     imperative tweens, not something that should cause React
     re-renders on every animation frame. */
  const materialRefs = useMemo(() => {
    const map = new Map();
    TWIN_COMPONENTS.forEach((component) => {
      map.set(
        component.id,
        component.geometry.map(() => ({ current: null }))
      );
    });
    return map;
  }, []);

  const clipPlanes = useMemo(() => {
    const map = new Map();
    TWIN_COMPONENTS.forEach((component) => {
      if (component.cutaway.available) {
        map.set(component.id, new Plane(new Vector3(...component.cutaway.clipNormal), component.cutaway.clipOffset));
      }
    });
    return map;
  }, []);

  return (
    <div ref={wrapperRef} className="relative w-full h-full">
      <Canvas
        camera={{ position: DEFAULT_CAMERA_POSITION, fov: CAMERA_FOV }}
        dpr={[1, 2]}
        frameloop={frameloop}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
          outputColorSpace: SRGBColorSpace,
          toneMapping: ACESFilmicToneMapping,
          toneMappingExposure: 0.9,
          localClippingEnabled: true
        }}
        onPointerMissed={handleReset}
      >
        <LightingRig />
        <Ground />

        {/* Auto-fits the camera to the whole facility on mount and on
            resize (observe), using the same margin the hand-derived
            DEFAULT_CAMERA_POSITION/TARGET in constants.js were computed
            with — see that constant's docblock. Scoped to just the
            station group (not Ground/CameraRig/DataPanel) so it only
            ever measures the facility's own bounding box. */}
        <Bounds fit clip observe margin={1.25}>
          {TWIN_COMPONENTS.map((component) => (
            <Station
              key={component.id}
              component={component}
              isSelected={selectedId === component.id}
              isHoverActive={hoveredId === component.id && !selectedId && !isCoarsePointer}
              onSelect={handleSelect}
              onHoverStart={handleHoverStart}
              onHoverEnd={handleHoverEnd}
              outlineColor={brand}
              materialRefContainers={materialRefs.get(component.id)}
              clipPlane={clipPlanes.get(component.id) ?? null}
              t={t}
            />
          ))}
        </Bounds>

        <CameraRig
          selected={selected}
          materialRefs={materialRefs}
          clipPlanes={clipPlanes}
          onArrive={() => setArrived(true)}
          onDepart={() => setArrived(false)}
        />

        {/* Desktop: the panel stays 3D-anchored next to the focused
            station via <Html>. Mobile: a viewport-width DataPanel
            floating at that same 3D point would cover most of a small
            screen, so it renders outside the Canvas instead (below,
            variant="sheet") as a bottom sheet that only ever takes the
            lower portion of the viewport. */}
        {selected && !isMobile && (
          <Html position={selected.focus.target} center>
            <DataPanel component={selected} visible={arrived} onClose={handleReset} />
          </Html>
        )}
      </Canvas>

      <Controls
        selectedId={selectedId}
        onBack={handleReset}
        onSelect={handleSelect}
        onSelectDirect={handleSelectDirect}
        onReset={handleReset}
        t={t}
      />

      {selected && isMobile && (
        <DataPanel component={selected} visible={arrived} onClose={handleReset} variant="sheet" />
      )}
    </div>
  );
}

export default function DigitalTwinScene() {
  const [capable] = useState(detectCapability);

  if (!capable) return <DigitalTwinFallback />;

  return (
    <DigitalTwinErrorBoundary>
      <DigitalTwinCanvasScene />
    </DigitalTwinErrorBoundary>
  );
}
