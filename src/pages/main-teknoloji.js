import { initSolutionsCarousel } from '../lib/solutionsCarousel.js';
import { initFadeIn, initThemeToggle, initParallax, initSiteSearch, initCardSpotlight, initMobileNav, initSmoothScroll, initPageCurtain, initFooterCurve, initDnaScroll } from '../common.js';
import { initI18n, initLangSwitcher } from '../i18n.js';
import { initQuoteModal } from '../lib/quoteModal.js';

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

/* 2026-09-19: bu sayfada artık three.js YOK. Hizmetler açılışındaki
   3 makinelik WebGL vitrini (initExpoScene + initServicesShowcase)
   kaldırıldı — IONA ekipman satmıyor, anahtar teslim tesis kuruyor;
   bkz. teknoloji.html'deki #expo yorumu. Kaynak dosyalar
   .backups/removed-services-3d/ altında duruyor. */

