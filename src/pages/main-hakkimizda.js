import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { initFadeIn, initThemeToggle, initParallax, initSiteSearch, initMobileNav, initSmoothScroll } from '../common.js';
import { initI18n, initLangSwitcher } from '../i18n.js';
import { initQuoteModal } from '../lib/quoteModal.js';

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

/* Stat counters (20+ Yıllık Deneyim, etc.) */
const counters = document.querySelectorAll('[data-count-target]');
if (counters.length) {
  ScrollTrigger.create({
    trigger: '#stats',
    start: 'top 85%',
    once: true,
    onEnter: () => {
      counters.forEach((el) => {
        const target = Number(el.dataset.countTarget || '0');
        const suffix = el.dataset.countSuffix || '';
        const counter = { value: 0 };
        gsap.to(counter, {
          value: target,
          duration: 1.8,
          ease: 'power2.out',
          onUpdate: () => { el.textContent = Math.round(counter.value) + suffix; }
        });
      });
    }
  });
}
