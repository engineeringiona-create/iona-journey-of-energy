import { initSolutionsCarousel } from '../lib/solutionsCarousel.js';
import { initFadeIn, initThemeToggle, initParallax, initSiteSearch, initCardSpotlight, initMobileNav, initSmoothScroll, initPageCurtain, initFooterCurve, initDnaScroll } from '../common.js';
import { initI18n, initLangSwitcher } from '../i18n.js';
import { initQuoteModal } from '../lib/quoteModal.js';
import { initExpoScene } from '../three/expo-scene.js';
import { initServicesShowcase } from '../lib/servicesShowcase.js';

await initI18n();
initSolutionsCarousel();
initSmoothScroll();
initPageCurtain();
initFooterCurve();
initLangSwitcher();
initQuoteModal();
initFadeIn();
initThemeToggle();
initSiteSearch();
initMobileNav();
initDnaScroll();
initParallax();
initCardSpotlight();

const canvas = document.getElementById('webgl-stage');
const { agitator, genset, pump, camera } = initExpoScene(canvas);

/* Click-driven slider (arrows + pill tabs) between the 3 machines —
   no ScrollTrigger, no scroll-position logic of any kind left on this
   page. See servicesShowcase.js's own header comment for why the
   earlier scroll-pinned version was removed entirely rather than kept
   as a fallback path. */
initServicesShowcase({
  slides: Array.from(document.querySelectorAll('.services-3d-slide')),
  machines: [agitator, genset, pump],
  camera,
  tabs: Array.from(document.querySelectorAll('.services-3d-tab')),
  prevBtn: document.getElementById('services-3d-prev'),
  nextBtn: document.getElementById('services-3d-next')
});

