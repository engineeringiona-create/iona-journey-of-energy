import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import * as THREE from 'three';
import { reduceMotion } from '../../three/scene-utils.js';

const RING_COLORS = ['#78dc77', '#ff751f']; // brand green / brand orange, alternating per structure
const RING_INNER_RADIUS = 2.2;
const RING_OUTER_RADIUS = 2.6;
const RING_MAX_SCALE = 2.4;
const RING_DURATION = 2.2;
const RING_STAGGER = 0.35;

function SonarRing({ position, color, delay }) {
  const meshRef = useRef(null);
  const materialRef = useRef(null);

  useEffect(() => {
    const mesh = meshRef.current;
    const material = materialRef.current;
    if (!mesh || !material || reduceMotion) return;

    mesh.scale.setScalar(1);
    material.opacity = 0.85;

    /* One GSAP timeline per ring, looping forever (repeat: -1) — each
       cycle restarts from the values captured when the timeline was
       created (scale 1 / opacity 0.85), so this is a self-resetting
       pulse with no manual reset logic needed. Killed on unmount, which
       is exactly what happens the instant `active` goes false (see
       SonarRings below) — the rings stop and vanish together. */
    const tl = gsap.timeline({ repeat: -1, delay });
    tl.to(mesh.scale, { x: RING_MAX_SCALE, y: RING_MAX_SCALE, z: RING_MAX_SCALE, duration: RING_DURATION, ease: 'power1.out' }, 0);
    tl.to(material, { opacity: 0, duration: RING_DURATION, ease: 'power1.out' }, 0);

    return () => tl.kill();
  }, [delay]);

  return (
    <mesh ref={meshRef} position={position} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
      <ringGeometry args={[RING_INNER_RADIUS, RING_OUTER_RADIUS, 48]} />
      <meshBasicMaterial
        ref={materialRef}
        color={color}
        transparent
        opacity={0.85}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}

/* "Sonar" discoverability hint — pulsing rings hovering just above the
   roof of each of the 5 clickable major structures, so a first-time
   visitor can tell at a glance that the model is interactive. Pure
   affordance, not part of the facility itself: gone for good the
   instant the visitor clicks any structure (see `active`, driven by
   GltfTwinScene's hasInteracted state — returning null here fully
   unmounts every ring, which also kills their GSAP timelines via the
   cleanup above, so nothing keeps animating in the background). */
export default function SonarRings({ rings, active }) {
  if (!active || rings.length === 0) return null;
  return (
    <>
      {rings.map((ring, index) => (
        <SonarRing
          key={ring.name}
          position={ring.position}
          color={RING_COLORS[index % RING_COLORS.length]}
          delay={index * RING_STAGGER}
        />
      ))}
    </>
  );
}
