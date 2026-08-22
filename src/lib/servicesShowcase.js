import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { getLenis } from '../common.js';

gsap.registerPlugin(ScrollTrigger);

const STEP_DURATION = 0.8;
const TEXT_DURATION = 0.4;
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

/* Pins #services-3d-showcase and steps discretely between its 3 slides,
   one wheel/swipe gesture at a time, instead of a continuous scroll.
   Desktop + motion-OK only (see the caller in main-teknoloji.js) —
   mobile and prefers-reduced-motion visitors never reach this function.

   Text crossfade is plain opacity + visibility toggling via classList,
   nothing else — an earlier version drove the "add is-active-slide"
   step through GSAP's `className` special property in the same .set()
   call that also set opacity/y directly. That property diffs the
   computed style of the with/without-class states and blends toward
   it, which fights an explicit opacity/y set in the same vars object;
   the visible result was slides landing at inconsistent
   opacity/position and reads as "text bleeding into other text". Kept
   here as a paper trail, not because that code still exists below. */
export function initServicesShowcase({ wrapper, slides, machines, camera }) {
  if (!wrapper || !slides.length || !machines.length) return;

  wrapper.classList.add('is-pinned');
  wrapper.querySelectorAll('.services-3d-gap').forEach((el) => { el.style.display = 'none'; });
  slides.forEach((el, i) => setSlideState(el, i === 0));

  const lastIndex = slides.length - 1;
  const baseCameraZ = camera.position.z;
  let activeIndex = 0;
  let animating = false;
  let pinActive = false;
  let lockUntil = 0;

  function setSlideState(el, active) {
    el.classList.toggle('is-active-slide', active);
    el.style.visibility = active ? 'visible' : 'hidden';
    el.style.pointerEvents = active ? 'auto' : 'none';
    gsap.set(el, { opacity: active ? 1 : 0 });
  }

  /* Only one slide is ever visible+interactable at a time: the incoming
     slide flips to visible/interactable up front (so it's in the DOM's
     hit-testing/paint the instant its fade-in starts), the outgoing
     slide's visibility/pointer-events flip to hidden/none only once its
     fade-out tween actually finishes — never both "on" at rest, only
     for the ~0.4s the two opacities are genuinely crossing. */
  function crossfadeSlide(i) {
    const outgoing = slides[activeIndex];
    const incoming = slides[i];

    gsap.killTweensOf([outgoing, incoming]);

    incoming.classList.add('is-active-slide');
    incoming.style.visibility = 'visible';
    incoming.style.pointerEvents = 'auto';
    gsap.fromTo(incoming, { opacity: 0 }, { opacity: 1, duration: TEXT_DURATION, ease: 'power2.inOut' });

    outgoing.style.pointerEvents = 'none';
    gsap.to(outgoing, {
      opacity: 0,
      duration: TEXT_DURATION,
      ease: 'power2.inOut',
      onComplete: () => {
        outgoing.classList.remove('is-active-slide');
        outgoing.style.visibility = 'hidden';
      }
    });
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

  /* 300vh total pinned scroll track for 3 slides: a stop every 100vh
     (0 / 100 / 200), plus one spare 100vh of dwell after the last stop
     so reaching Pompa doesn't release on the very same gesture that
     arrived there — the next full scroll gesture past that cushion is
     what actually carries the page past `end` and unpins. */
  const st = ScrollTrigger.create({
    trigger: wrapper,
    start: 'top top',
    end: () => '+=' + window.innerHeight * slides.length,
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
