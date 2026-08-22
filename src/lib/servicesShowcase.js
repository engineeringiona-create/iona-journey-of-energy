import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { getLenis } from '../common.js';

gsap.registerPlugin(ScrollTrigger);

const STEP_DURATION = 0.8;
/* GSAP's power2.inOut, hand-rolled as a plain function so Lenis's
   scrollTo (which takes a (t) => number easing fn, not a GSAP ease
   string) and the GSAP tweens below animate on the exact same curve —
   two different easing implementations that only *approximate* each
   other would show up as the camera/text and the scroll position
   visibly drifting apart mid-snap. */
const EASE = (t) => (t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2);
const WHEEL_THRESHOLD = 6;
const TOUCH_THRESHOLD = 40;
const RELOCK_MS = STEP_DURATION * 1000 + 150;
/* Small dolly punch on the shared expo camera each time a step fires —
   the 3 machines already crossfade at nearly the same base position
   (see expo-scene.js's agBase/gsBase/pmBase), so there's no per-machine
   framing to dolly *to*; this is a push-in/settle-back read as "the
   camera reacted to the snap" without redesigning that shared-camera
   layout. */
const CAMERA_PUNCH = 0.6;

/* Phase 44: pins #services-3d-wrapper and steps discretely between its
   3 slides, one wheel/swipe gesture at a time, instead of the
   continuous scroll-crossfade Phase 42 shipped. Desktop + motion-OK
   only (see the caller in main-teknoloji.js) — mobile and
   prefers-reduced-motion visitors never reach this function at all. */
export function initServicesShowcase({ wrapper, slides, machines, camera }) {
  if (!wrapper || !slides.length || !machines.length) return;

  wrapper.classList.add('is-pinned');
  slides.forEach((el, i) => el.classList.toggle('is-active-slide', i === 0));
  wrapper.querySelectorAll('.services-3d-gap').forEach((el) => { el.style.display = 'none'; });

  const lastIndex = slides.length - 1;
  const baseCameraZ = camera.position.z;
  let activeIndex = 0;
  let animating = false;
  let pinActive = false;
  let lockUntil = 0;

  function crossfadeSlide(i) {
    const outgoing = slides[activeIndex];
    const incoming = slides[i];
    const dir = i > activeIndex ? 1 : -1;
    outgoing.style.pointerEvents = 'none';
    incoming.style.pointerEvents = 'auto';
    gsap.killTweensOf([outgoing, incoming]);
    gsap.set(incoming, { opacity: 0, y: dir * 24, className: '+=is-active-slide' });
    gsap.to(outgoing, {
      opacity: 0, y: dir * -24, duration: STEP_DURATION, ease: 'power2.inOut',
      onComplete: () => outgoing.classList.remove('is-active-slide')
    });
    gsap.to(incoming, { opacity: 1, y: 0, duration: STEP_DURATION, ease: 'power2.inOut' });
  }

  function punchCamera() {
    gsap.killTweensOf(camera.position);
    const tl = gsap.timeline();
    tl.to(camera.position, { z: baseCameraZ - CAMERA_PUNCH, duration: STEP_DURATION * 0.5, ease: 'power2.inOut' });
    tl.to(camera.position, { z: baseCameraZ, duration: STEP_DURATION * 0.5, ease: 'power2.inOut' });
  }

  function stepTo(i) {
    if (i === activeIndex || animating) return;
    animating = true;
    crossfadeSlide(i);
    punchCamera();
    machines[i].enterSection();
    activeIndex = i;
    gsap.delayedCall(STEP_DURATION, () => { animating = false; });
  }

  const st = ScrollTrigger.create({
    trigger: wrapper,
    start: 'top top',
    end: () => '+=' + window.innerHeight * lastIndex,
    pin: true,
    pinSpacing: true,
    anticipatePin: 1,
    onEnter: () => { pinActive = true; },
    onEnterBack: () => { pinActive = true; stepTo(lastIndex); },
    onLeave: () => { pinActive = false; },
    onLeaveBack: () => { pinActive = false; stepTo(0); }
  });

  function scrollToIndex(i) {
    const targetY = st.start + i * window.innerHeight;
    const lenis = getLenis();
    if (lenis) lenis.scrollTo(targetY, { duration: STEP_DURATION, easing: EASE, lock: true });
    else window.scrollTo({ top: targetY, behavior: 'smooth' });
  }

  /* Both the wheel and touch handlers below only ever preventDefault
     while a step is actually taken (or while one is still animating) —
     at either end of the trio (index 0 scrolling up, lastIndex scrolling
     down) the event is left alone so it falls straight through to
     Lenis/native scroll, which is what carries the page out of the pin
     and into normal document flow (release) or back up above the
     wrapper. No manual "unpin" call needed; ScrollTrigger's own
     start/end boundaries do that once real scroll passes them. */
  function handleStep(dir) {
    if (dir > 0 && activeIndex === lastIndex) return false;
    if (dir < 0 && activeIndex === 0) return false;
    stepTo(activeIndex + dir);
    scrollToIndex(activeIndex);
    return true;
  }

  function onWheel(e) {
    if (!pinActive) return;
    const now = performance.now();
    if (now < lockUntil) {
      if (Math.abs(e.deltaY) >= WHEEL_THRESHOLD) e.preventDefault();
      return;
    }
    if (Math.abs(e.deltaY) < WHEEL_THRESHOLD) return;
    const dir = e.deltaY > 0 ? 1 : -1;
    if (handleStep(dir)) {
      e.preventDefault();
      lockUntil = now + RELOCK_MS;
    }
  }
  window.addEventListener('wheel', onWheel, { passive: false });

  let touchStartY = null;
  function onTouchStart(e) { touchStartY = e.touches[0].clientY; }
  function onTouchMove(e) {
    if (!pinActive || touchStartY == null) return;
    const now = performance.now();
    if (now < lockUntil) { e.preventDefault(); return; }
    const dy = touchStartY - e.touches[0].clientY;
    if (Math.abs(dy) < TOUCH_THRESHOLD) return;
    const dir = dy > 0 ? 1 : -1;
    if (handleStep(dir)) {
      e.preventDefault();
      touchStartY = e.touches[0].clientY;
      lockUntil = now + RELOCK_MS;
    }
  }
  window.addEventListener('touchstart', onTouchStart, { passive: true });
  window.addEventListener('touchmove', onTouchMove, { passive: false });

  machines[0].enterSection();
}
