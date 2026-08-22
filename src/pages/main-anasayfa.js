import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { initFadeIn, initThemeToggle, initParallax, initSiteSearch, initCardSpotlight, initMobileNav, initSmoothScroll } from '../common.js';
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
initCardSpotlight();

/* ---------------- Intro preloader ---------------- */
function runPreloader() {
  const preloader = document.getElementById('preloader');
  if (!preloader) return;
  const star = document.getElementById('preloader-star');
  const glow = document.getElementById('preloader-glow');

  const pulse = gsap.timeline({ repeat: -1, yoyo: true, defaults: { duration: 0.75, ease: 'sine.inOut' } });
  pulse.to(star, { scale: 1.18, rotate: 8 }, 0);
  pulse.to(glow, { opacity: 0.9, scale: 1.35 }, 0);

  gsap.delayedCall(1.5, () => {
    pulse.kill();
    gsap.to(preloader, {
      opacity: 0,
      duration: 0.8,
      ease: 'power2.inOut',
      onComplete: () => preloader.remove()
    });
  });
}
runPreloader();

/* ---------------- Hero: 3D twin drill-down + mobile activation ----------------
   The hero canvas + click/zoom logic live in React (GltfTwinScene.jsx);
   the title/badge overlay is plain markup here. Two independent things
   both want to control #hero-copy's opacity, so they're combined into
   one function instead of two separate listeners fighting the same
   inline style:
   1. GltfTwinScene dispatches 'twinlevelchange' whenever its internal
      currentLevel state changes (0 overview / >0 focused) — the copy
      should be out of the way whenever a structure is focused.
   2. On mobile, #mobile-3d-cta "activates" the twin (see below) — the
      copy should also be out of the way for as long as that's active,
      independent of currentLevel.
   syncHeroCopy() applies both conditions together so neither one can
   silently undo the other (e.g. drilling into a structure while
   mobile-activated, then backing out, must NOT bring the copy back
   since mobile activation is still on).

   Mobile 3D activation: #iona-digital-twin-root is visible everywhere
   now (faded/non-interactive by default on mobile — see the `@media
   (max-width: 767px)` rule in base.css), not gated behind a separate
   full-screen modal. #mobile-3d-cta brings it to full opacity +
   pointer-events and reveals #mobile-3d-close; 'mobiletwinactivate' is
   dispatched for GltfTwinScene's own small zoom-in cue on activation
   (see Rig in GltfTwinScene.jsx). No manual mount call needed here —
   the container's already laid out/in-viewport on mobile now, so
   mount.jsx's own IntersectionObserver mounts it the same way it does
   on desktop. */
function initHeroTwin() {
  const hero = document.getElementById('hero');
  const copy = document.getElementById('hero-copy');
  const cta = document.getElementById('mobile-3d-cta');
  const closeBtn = document.getElementById('mobile-3d-close');
  if (!hero || !copy) return;

  let twinLevel = 0;
  let mobileActive = false;

  function syncHeroCopy() {
    copy.style.opacity = twinLevel === 0 && !mobileActive ? '1' : '0';
  }

  document.addEventListener('twinlevelchange', (e) => {
    twinLevel = e.detail.level;
    syncHeroCopy();
  });

  if (cta && closeBtn) {
    cta.addEventListener('click', () => {
      mobileActive = true;
      hero.classList.add('twin-active');
      syncHeroCopy();
      document.dispatchEvent(new CustomEvent('mobiletwinactivate'));
    });
    closeBtn.addEventListener('click', () => {
      mobileActive = false;
      hero.classList.remove('twin-active');
      syncHeroCopy();
    });
    window.matchMedia('(min-width: 768px)').addEventListener('change', (e) => {
      if (!e.matches || !mobileActive) return;
      mobileActive = false;
      hero.classList.remove('twin-active');
      syncHeroCopy();
    });
  }
}
initHeroTwin();

/* ---------------- Services: stagger fade-in on scroll ---------------- */
function initServiceCards() {
  const cards = gsap.utils.toArray('.service-card');
  if (!cards.length) return;
  gsap.set(cards, { opacity: 0, y: 48 });
  ScrollTrigger.create({
    trigger: '#services-highlight',
    start: 'top 78%',
    once: true,
    onEnter: () => {
      gsap.to(cards, {
        opacity: 1, y: 0, duration: 0.9, ease: 'power3.out', stagger: 0.18
      });
    }
  });
}
initServiceCards();

/* ---------------- Why Choose Us: click-to-pin accordion ---------------- */
function initAccordion() {
  const items = document.querySelectorAll('.accordion-item');
  if (!items.length) return;
  items.forEach((item) => {
    item.addEventListener('click', () => {
      const wasActive = item.classList.contains('is-active');
      items.forEach((i) => i.classList.remove('is-active'));
      if (!wasActive) item.classList.add('is-active');
    });
  });
}
initAccordion();
