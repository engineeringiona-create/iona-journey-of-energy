import { initFadeIn, initThemeToggle, initSiteSearch, initMobileNav, initSmoothScroll, initPageCurtain, initFooterCurve } from '../common.js';
import { initI18n, initLangSwitcher } from '../i18n.js';
import { initQuoteModal } from '../lib/quoteModal.js';

await initI18n();
initSmoothScroll();
initPageCurtain();
initFooterCurve();
initLangSwitcher();
initQuoteModal();
initFadeIn();
initThemeToggle();
initSiteSearch();
initMobileNav();
