import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import gsap from 'gsap';
import { reduceMotion } from '../../three/scene-utils.js';
import { DEFAULT_CAMERA_POSITION, DEFAULT_CAMERA_TARGET, TWIN_COMPONENTS } from './constants.js';

/* prefers-reduced-motion: near-instant instead of skipping the tween
   outright, so this stays the same GSAP timeline/onUpdate/onComplete
   code path either way (camera.lookAt still gets driven every step,
   just over ~1 frame instead of ~1s) rather than a separate branch
   that sets final values directly and has to be kept in sync by hand. */
const CAMERA_DURATION = reduceMotion ? 0.01 : 0.8;
const CAMERA_EASE = 'power2.inOut';

/* The cutaway reveal and the other-stations dim are a second, shorter
   beat layered on top of the camera move rather than run in lockstep
   with it — starting at the camera tween's halfway point so the shell
   is visibly peeling open/other parts fading as the camera settles,
   not fighting the punch-in for attention, and not waiting for it to
   fully finish either. */
const REVEAL_START = CAMERA_DURATION * 0.5;
const REVEAL_DURATION = reduceMotion ? 0.01 : 0.5;
const DIMMED_OPACITY = 0.35;

export default function CameraRig({ selected, materialRefs, clipPlanes, onArrive, onDepart }) {
  const { camera } = useThree();
  const target = useRef({
    x: DEFAULT_CAMERA_TARGET[0],
    y: DEFAULT_CAMERA_TARGET[1],
    z: DEFAULT_CAMERA_TARGET[2]
  });
  const timeline = useRef(null);

  useEffect(() => {
    camera.lookAt(target.current.x, target.current.y, target.current.z);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    onDepart();
    timeline.current?.kill();

    const [px, py, pz] = selected ? selected.focus.cameraPosition : DEFAULT_CAMERA_POSITION;
    const [tx, ty, tz] = selected ? selected.focus.target : DEFAULT_CAMERA_TARGET;

    const tl = gsap.timeline({
      onComplete: () => {
        if (selected) onArrive();
      }
    });
    tl.to(camera.position, { x: px, y: py, z: pz, duration: CAMERA_DURATION, ease: CAMERA_EASE }, 0);
    tl.to(
      target.current,
      {
        x: tx,
        y: ty,
        z: tz,
        duration: CAMERA_DURATION,
        ease: CAMERA_EASE,
        onUpdate: () => camera.lookAt(target.current.x, target.current.y, target.current.z)
      },
      0
    );

    // Cutaway: open the selected station's shell (if it has one), close everyone else's.
    TWIN_COMPONENTS.forEach((component) => {
      const plane = clipPlanes.get(component.id);
      if (!plane) return;
      const isThisSelected = Boolean(selected) && selected.id === component.id;
      const targetConstant = isThisSelected ? component.cutaway.clipOpen : component.cutaway.clipOffset;
      tl.to(plane, { constant: targetConstant, duration: REVEAL_DURATION, ease: CAMERA_EASE }, REVEAL_START);
    });

    // Dim every non-selected station's parts; restore to full opacity when nothing is selected.
    TWIN_COMPONENTS.forEach((component) => {
      const refs = materialRefs.get(component.id) ?? [];
      const isDimmed = Boolean(selected) && selected.id !== component.id;
      const targetOpacity = isDimmed ? DIMMED_OPACITY : 1;
      refs.forEach((ref) => {
        if (!ref.current) return;
        tl.to(ref.current, { opacity: targetOpacity, duration: REVEAL_DURATION, ease: CAMERA_EASE }, REVEAL_START);
      });
    });

    timeline.current = tl;

    return () => tl.kill();
  }, [selected, camera, onArrive, onDepart, materialRefs, clipPlanes]);

  return null;
}
