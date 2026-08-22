import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { initFadeIn, initThemeToggle, initParallax, initSiteSearch, initCardSpotlight, initMobileNav, initSmoothScroll } from '../common.js';
import { initI18n, initLangSwitcher } from '../i18n.js';
import { initQuoteModal } from '../lib/quoteModal.js';
import { initExpoScene } from '../three/expo-scene.js';
import { MOBILE_BREAKPOINT, reduceMotion } from '../three/scene-utils.js';
import { initServicesShowcase } from '../lib/servicesShowcase.js';

gsap.registerPlugin(ScrollTrigger);
await initI18n();
initSmoothScroll();
initLangSwitcher();
initQuoteModal();
initFadeIn();
initThemeToggle();
initSiteSearch();
initMobileNav();
initParallax();
initCardSpotlight();

const canvas = document.getElementById('webgl-stage');
const { agitator, genset, pump, camera } = initExpoScene(canvas);

/* Each machine's block owns one ScrollTrigger spanning its own
   viewport entry/exit. The first time it's entered, the machine
   plays its one-time fly-in/assemble cinematic (see expo-scene.js);
   every entry after that just crossfades it back in already fully
   assembled — it is never re-exploded. Leaving a section only fades
   it out, it never disassembles. */
function wireMachine(blockSelector, machine) {
  ScrollTrigger.create({
    trigger: blockSelector,
    start: 'top 80%',
    end: 'bottom 20%',
    onEnter: () => machine.enterSection(),
    onEnterBack: () => machine.enterSection(),
    onLeave: () => machine.leaveSection(),
    onLeaveBack: () => machine.leaveSection()
  });
}

/* Phase 44: pinned discrete snap between the 3 machines, desktop +
   motion-OK only — see servicesShowcase.js's own header comment for
   why. Everyone else (mobile, prefers-reduced-motion) keeps the
   original Phase 42 continuous scroll-crossfade wireMachine() path
   completely unchanged, including its own immediate-entry kick for
   the Agitator. */
if (window.innerWidth >= MOBILE_BREAKPOINT && !reduceMotion) {
  initServicesShowcase({
    wrapper: document.getElementById('services-3d-showcase'),
    slides: Array.from(document.querySelectorAll('.services-3d-slide')),
    machines: [agitator, genset, pump],
    camera
  });
} else {
  wireMachine('#expo-agitator', agitator);
  wireMachine('#expo-genset', genset);
  wireMachine('#expo-pump', pump);

  /* The Agitator's section now sits above the fold with no scroll
     required to see it, so its cinematic must not wait for a scroll
     event. ScrollTrigger's onEnter already fires immediately if the
     trigger region is satisfied at creation time, but we also kick it
     directly here so the assembly always starts the instant the page
     (and its fonts/layout) settle, with zero dependency on scroll math. */
  agitator.enterSection();
}
