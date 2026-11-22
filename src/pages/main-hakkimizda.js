
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { initFadeIn, initThemeToggle, initParallax, initSiteSearch, initMobileNav, initSmoothScroll, initPageCurtain, initFooterCurve, initDnaScroll } from '../common.js';
import { initI18n, initLangSwitcher } from '../i18n.js';
import { initQuoteModal } from '../lib/quoteModal.js';

gsap.registerPlugin(ScrollTrigger);
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
initDnaScroll();
initParallax();


/* Stat counters (20+ Yıllık Deneyim, etc.) — Phase 117 folded the old
   standalone #stats section into the #statements bento grid, so the
   trigger moved with it. */
const counters = document.querySelectorAll('[data-count-target]');
if (counters.length) {
  ScrollTrigger.create({
    trigger: '#statements',
    start: 'top 85%',
    once: true,
    onEnter: () => {
      counters.forEach((el) => {
        /* Hedef sayı artık yazının KENDİSİNDEN okunuyor ("20+" → 20 ve "+"):
           rakam admin editöründen değiştirilebilsin diye (anahtar
           site.stats.*_value, ana sayfadaki rakamlarla ortak). Sayıyla
           başlamayan bir metin girilirse sayaç oynamaz, yazı olduğu gibi kalır. */
        const m = /^(\d+)(.*)$/.exec((el.textContent || '').trim());
        if (!m) return;
        const target = Number(m[1]);
        const suffix = m[2];
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


