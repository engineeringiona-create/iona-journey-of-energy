import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import gsap from 'gsap';
import { reduceMotion } from '../../three/scene-utils.js';

/* Real facility scan, dropped in by the user (biyogaz-tesisi.glb ->
   public/models/iona-tesis-3d.glb). Root hierarchy is
   AuxScene > biogas_plant > { digester_1, digester_2, pump_room,
   engine_room_1, engine_room_2, scada_room, feed_pool_1, feed_pool_2,
   site_piping } — those 9 direct children of "biogas_plant" are the
   "major structures" clicks resolve to, regardless of which of their
   ~800 child meshes was actually hit. */
const MODEL_SRC = '/models/iona-tesis-3d.glb';
useGLTF.preload(MODEL_SRC);

const CAMERA_DURATION = reduceMotion ? 0.01 : 1.1;
const CAMERA_EASE = 'power2.inOut';
const CAMERA_FOV = 48;
const OVERVIEW_DIR = new THREE.Vector3(0.55, 0.85, 0.55).normalize();
const OVERVIEW_MARGIN = 1.1;
const FOCUS_DIR = new THREE.Vector3(0.65, 0.42, 0.75).normalize();
const FOCUS_MARGIN = 1.3;

/* Mock telemetry only — constants.js already flags real DataPanel.jsx
   stats as TODO/mock, this follows the same convention: readable
   placeholder numbers per structure, not live data. */
const STRUCTURE_INFO = {
  digester_1: { title: 'Çürütücü 1', status: 'Aktif', stats: [
    { label: 'Sıcaklık', value: '37.5°C' },
    { label: 'Biyogaz Debisi', value: '418 Nm³/h' },
    { label: 'pH Seviyesi', value: '7.2' }
  ] },
  digester_2: { title: 'Çürütücü 2', status: 'Aktif', stats: [
    { label: 'Sıcaklık', value: '38.1°C' },
    { label: 'Biyogaz Debisi', value: '402 Nm³/h' },
    { label: 'pH Seviyesi', value: '7.1' }
  ] },
  pump_room: { title: 'Pompa Odası', status: 'Çalışıyor', stats: [
    { label: 'Akış Hızı', value: '45 m³/h' },
    { label: 'Basınç', value: '3.2 bar' },
    { label: 'Aktif Pompa', value: '2 / 3' }
  ] },
  engine_room_1: { title: 'Kojenerasyon Odası 1', status: 'Çalışıyor', stats: [
    { label: 'Güç Çıkışı', value: '999 kW' },
    { label: 'Motor Sıcaklığı', value: '82°C' },
    { label: 'Çalışma Süresi', value: '14.230 sa' }
  ] },
  engine_room_2: { title: 'Kojenerasyon Odası 2', status: 'Çalışıyor', stats: [
    { label: 'Güç Çıkışı', value: '984 kW' },
    { label: 'Motor Sıcaklığı', value: '80°C' },
    { label: 'Çalışma Süresi', value: '11.860 sa' }
  ] },
  scada_room: { title: 'SCADA Kontrol Odası', status: 'Çevrimiçi', stats: [
    { label: 'Sistem Durumu', value: 'Normal' },
    { label: 'Aktif Alarm', value: '0' },
    { label: 'Çalışma Oranı', value: '%99.8' }
  ] },
  feed_pool_1: { title: 'Besleme Havuzu 1', status: 'Aktif', stats: [
    { label: 'Substrat Seviyesi', value: '%68' },
    { label: 'Besleme Hızı', value: '12 t/gün' },
    { label: 'Karıştırıcı', value: 'Çalışıyor' }
  ] },
  feed_pool_2: { title: 'Besleme Havuzu 2', status: 'Aktif', stats: [
    { label: 'Substrat Seviyesi', value: '%54' },
    { label: 'Besleme Hızı', value: '9 t/gün' },
    { label: 'Karıştırıcı', value: 'Çalışıyor' }
  ] },
  site_piping: { title: 'Saha Boru Hattı', status: 'Normal', stats: [
    { label: 'Gaz Hattı Basıncı', value: '1.8 bar' },
    { label: 'Isı Hattı Sıcaklığı', value: '78°C' },
    { label: 'Kaçak Alarmı', value: '0' }
  ] }
};

function humanize(name) {
  return name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function infoFor(name) {
  return STRUCTURE_INFO[name] ?? { title: humanize(name), status: 'Aktif', stats: [] };
}

/* Fits `camera` to `box` from unit direction `dir`, at `margin` x the
   distance needed for the box's largest dimension to fill the frame —
   shared by both the full-facility reset view and the per-structure
   focus so they behave identically, just with a different box/dir. */
function frameBox(box, camera, dir, margin) {
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z, 0.001);
  const fov = camera.fov * (Math.PI / 180);
  const distance = (maxDim / 2 / Math.tan(fov / 2)) * margin;
  const position = center.clone().addScaledVector(dir, distance);
  return { position, center };
}

function Model({ plantRootRef, onReady, onSelect }) {
  const { scene } = useGLTF(MODEL_SRC);

  const clay = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#c0c0c0', roughness: 1, metalness: 0.1 }),
    []
  );

  /* useLayoutEffect (not useEffect): forces the clay swap to happen
     synchronously before the browser paints the first frame of this
     scene, so there's no possible flash of the GLB's original PBR
     materials while a passive effect is still pending. */
  useLayoutEffect(() => {
    scene.traverse((child) => {
      if (!child.isMesh) return;
      child.material = clay;
      child.material.needsUpdate = true;
      child.castShadow = true;
      child.receiveShadow = true;
    });

    const plantRoot = scene.getObjectByName('biogas_plant') ?? scene;
    plantRootRef.current = plantRoot;
    onReady(plantRoot);
  }, [scene, clay, plantRootRef, onReady]);

  const handleClick = useCallback(
    (event) => {
      event.stopPropagation();
      const plantRoot = plantRootRef.current;
      if (!plantRoot) return;
      let node = event.object;
      while (node && node.parent !== plantRoot) node = node.parent;
      if (node) onSelect(node);
    },
    [plantRootRef, onSelect]
  );

  return <primitive object={scene} onClick={handleClick} />;
}

function Ground({ y }) {
  return (
    <mesh position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <circleGeometry args={[40, 64]} />
      <meshStandardMaterial color="#e4e4e4" roughness={1} metalness={0} />
    </mesh>
  );
}

/* Owns the camera/controls tweening + shadow-frustum fitting once the
   model's real bounding box is known, and the click -> focus / miss ->
   reset transitions. Kept inside <Canvas> since it needs useThree/
   useFrame. */
function Rig({ plantRootRef, selected, groundY, keyLightRef }) {
  const { camera } = useThree();
  const controlsRef = useRef(null);
  const overviewRef = useRef(null);
  const timelineRef = useRef(null);
  const framedRef = useRef(false);

  useEffect(() => {
    if (framedRef.current || !plantRootRef.current) return;
    framedRef.current = true;

    const box = new THREE.Box3().setFromObject(plantRootRef.current);
    const { position, center } = frameBox(box, camera, OVERVIEW_DIR, OVERVIEW_MARGIN);
    overviewRef.current = { position, center };

    camera.position.copy(position);
    controlsRef.current.target.copy(center);
    controlsRef.current.update();

    if (keyLightRef.current) {
      const light = keyLightRef.current;
      const size = box.getSize(new THREE.Vector3());
      const radius = Math.max(size.x, size.y, size.z) * 0.75;
      light.shadow.camera.left = -radius;
      light.shadow.camera.right = radius;
      light.shadow.camera.top = radius;
      light.shadow.camera.bottom = -radius;
      light.shadow.camera.near = 0.5;
      light.shadow.camera.far = radius * 4;
      light.shadow.camera.updateProjectionMatrix();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plantRootRef.current]);

  useEffect(() => {
    if (!controlsRef.current) return;
    timelineRef.current?.kill();

    let position;
    let center;
    if (selected) {
      const box = new THREE.Box3().setFromObject(selected);
      ({ position, center } = frameBox(box, camera, FOCUS_DIR, FOCUS_MARGIN));
    } else if (overviewRef.current) {
      ({ position, center } = overviewRef.current);
    } else {
      return;
    }

    const target = controlsRef.current.target;
    const tl = gsap.timeline();
    tl.to(camera.position, { x: position.x, y: position.y, z: position.z, duration: CAMERA_DURATION, ease: CAMERA_EASE }, 0);
    tl.to(target, { x: center.x, y: center.y, z: center.z, duration: CAMERA_DURATION, ease: CAMERA_EASE }, 0);
    timelineRef.current = tl;

    return () => tl.kill();
  }, [selected, camera]);

  useFrame(() => controlsRef.current?.update());

  return (
    <>
      <OrbitControls
        ref={controlsRef}
        enableDamping
        dampingFactor={0.08}
        minDistance={1}
        maxDistance={200}
        minPolarAngle={0.05}
        maxPolarAngle={Math.PI / 2 - 0.02}
      />
      <Ground y={groundY} />
    </>
  );
}

function DataCard({ info, onClose }) {
  return (
    <div className="absolute z-20 top-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-72 rounded-2xl border border-black/10 bg-white/85 backdrop-blur-xl shadow-[0_25px_60px_-25px_rgba(0,0,0,0.5)] p-5 text-gray-900">
      <div className="flex items-start justify-between gap-3 mb-1">
        <h3 className="font-label-caps text-label-caps text-gray-500">{info.title}</h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Kapat"
          className="text-gray-400 hover:text-gray-700 transition-colors duration-200 leading-none text-lg"
        >
          &times;
        </button>
      </div>
      <p className="text-sm font-semibold text-emerald-600 mb-3">
        {info.title} {info.status}
      </p>
      {info.stats.length > 0 && (
        <dl className="space-y-2">
          {info.stats.map((stat) => (
            <div key={stat.label} className="flex items-center justify-between text-sm">
              <dt className="text-gray-500">{stat.label}</dt>
              <dd className="font-semibold text-gray-900">{stat.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

export default function GltfTwinScene() {
  const [selected, setSelected] = useState(null);
  const plantRootRef = useRef(null);
  const keyLightRef = useRef(null);
  const [groundY, setGroundY] = useState(0);

  const handleReady = useCallback((plantRoot) => {
    const box = new THREE.Box3().setFromObject(plantRoot);
    setGroundY(box.min.y - 0.02);
  }, []);

  const handleSelect = useCallback((node) => setSelected(node), []);
  const handleReset = useCallback(() => setSelected(null), []);

  return (
    <div className="relative w-full h-full">
      <Canvas
        shadows
        camera={{ fov: CAMERA_FOV, near: 0.1, far: 500 }}
        dpr={[1, 2]}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        onPointerMissed={handleReset}
      >
        <color attach="background" args={['#eceeec']} />
        <ambientLight intensity={0.55} />
        <directionalLight
          ref={keyLightRef}
          position={[30, 45, 20]}
          intensity={1.6}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-bias={-0.0005}
        />
        <directionalLight position={[-25, 15, -20]} intensity={0.4} />

        <Model plantRootRef={plantRootRef} onReady={handleReady} onSelect={handleSelect} />
        <Rig
          plantRootRef={plantRootRef}
          selected={selected}
          groundY={groundY}
          keyLightRef={keyLightRef}
        />
      </Canvas>

      {selected && (
        <DataCard info={infoFor(selected.name)} onClose={handleReset} />
      )}
    </div>
  );
}
