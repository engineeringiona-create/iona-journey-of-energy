import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { initFadeIn, initThemeToggle, initParallax, initSiteSearch, initCardSpotlight, initMobileNav } from '../common.js';
import { initI18n, initLangSwitcher } from '../i18n.js';
import { initQuoteModal } from '../lib/quoteModal.js';
import { initExpoScene } from '../three/expo-scene.js';

gsap.registerPlugin(ScrollTrigger);
await initI18n();
initLangSwitcher();
initQuoteModal();
initFadeIn();
initThemeToggle();
initSiteSearch();
initMobileNav();
initParallax();
initCardSpotlight();

const canvas = document.getElementById('webgl-stage');
const { agitator, genset, pump } = initExpoScene(canvas);

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
