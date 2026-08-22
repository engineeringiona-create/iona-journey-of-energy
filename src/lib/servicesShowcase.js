import { gsap } from 'gsap';

const TEXT_DURATION = 0.4;
/* Small dolly punch on the shared expo camera each time a step fires —
   the 3 machines already crossfade at nearly the same base position
   (see expo-scene.js's agBase/gsBase/pmBase), so there's no per-machine
   framing to dolly *to*; this is a push-in/settle-back read as "the
   camera reacted to the switch" without redesigning that shared-camera
   layout. */
const CAMERA_DURATION = 0.8;
const CAMERA_PUNCH = 0.6;

/* Click-driven slider between the 3 services machines — arrows + pill
   tabs only, no scroll involvement whatsoever. A ScrollTrigger-pinned,
   wheel/touch-hijacking version of this shipped twice and broke (text
   overlapping/bleeding) both times; it's gone for good, along with the
   300vh scroll track, wheel listeners and Lenis scrollTo locks that
   came with it. The page scrolls exactly like any other section now —
   this component only ever reacts to button clicks. */
export function initServicesShowcase({ slides, machines, camera, tabs, prevBtn, nextBtn }) {
  if (!slides.length || !machines.length) return;

  const lastIndex = slides.length - 1;
  const baseCameraZ = camera.position.z;
  let activeIndex = 0;
  let animating = false;

  function setSlideState(el, active) {
    el.classList.toggle('is-active-slide', active);
    el.style.visibility = active ? 'visible' : 'hidden';
    el.style.pointerEvents = active ? 'auto' : 'none';
    gsap.set(el, { opacity: active ? 1 : 0 });
  }
  slides.forEach((el, i) => setSlideState(el, i === 0));

  function setTabState(i) {
    tabs.forEach((tab, idx) => {
      const active = idx === i;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', String(active));
    });
  }

  /* Only one slide is ever visible+interactable at rest: the incoming
     slide flips to visible/interactable up front, the outgoing slide's
     visibility/pointer-events only flip off once its fade-out tween
     actually completes — both "on" only for the genuine ~0.4s crossfade
     window, never longer. Plain classList + explicit visibility, no
     GSAP `className` morphing (that was the root cause of the earlier
     overlap bug: className diffs computed style between class states,
     which fights an explicit opacity set in the same call). */
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
    tl.to(camera.position, { z: baseCameraZ - CAMERA_PUNCH, duration: CAMERA_DURATION * 0.5, ease: 'power2.inOut' });
    tl.to(camera.position, { z: baseCameraZ, duration: CAMERA_DURATION * 0.5, ease: 'power2.inOut' });
  }

  function goTo(i) {
    if (i === activeIndex || animating || i < 0 || i > lastIndex) return;
    animating = true;
    crossfadeSlide(i);
    punchCamera();
    machines[i].enterSection();
    setTabState(i);
    activeIndex = i;
    gsap.delayedCall(CAMERA_DURATION, () => { animating = false; });
  }

  /* Arrows wrap around (Pompa -> Sonraki goes back to Karıştırma, and
     vice versa) rather than disabling at the ends — simpler for a
     fixed 3-item slider than adding a disabled-state affordance for
     what's a pretty natural "cycle through" gesture either way. */
  prevBtn?.addEventListener('click', () => goTo(activeIndex === 0 ? lastIndex : activeIndex - 1));
  nextBtn?.addEventListener('click', () => goTo(activeIndex === lastIndex ? 0 : activeIndex + 1));
  tabs.forEach((tab, i) => tab.addEventListener('click', () => goTo(i)));

  machines[0].enterSection();
}
