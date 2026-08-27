import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { initFadeIn, initThemeToggle, initParallax, initSiteSearch, initCardSpotlight, initMobileNav, initSmoothScroll, initPageCurtain, initFooterCurve, initDnaScroll } from '../common.js';
import { initI18n, initLangSwitcher } from '../i18n.js';
import { initQuoteModal } from '../lib/quoteModal.js';
import { initBiogasCalculator } from '../lib/biogasCalculator.js';

gsap.registerPlugin(ScrollTrigger);
await initI18n();
initSmoothScroll();
initPageCurtain();
initFooterCurve();
initLangSwitcher();
initQuoteModal();
initBiogasCalculator();
initFadeIn();
initThemeToggle();
initSiteSearch();
initMobileNav();
initDnaScroll();
initParallax();
initCardSpotlight();

/* ---------------- Intro preloader (Phase 77: IonaPreloader) ----------------
   The mark is real Quicksand text (.iona-wordmark-text), not hand-drawn SVG
   line art — an earlier stroke-draw version looked nothing like the actual
   iona logo, so this reveals the four letters in sequence with a
   blur/opacity/rise-in instead (CSS transition on .preloader-letter.is-in,
   see base.css), then the slogan shimmers in. Exit waits for both a minimum
   read-time AND the window 'load' event (this is a static multi-page site
   with no client hydration step, so 'load' is the closest equivalent to
   "asset-hydration ready"), capped by a safety timeout so a slow asset can
   never strand the preloader on screen. The dissolve itself is a pure CSS
   class (#preloader.is-leaving) so it never fights this timeline. */
function runPreloader() {
  const preloader = document.getElementById('preloader');
  if (!preloader) return;
  const glow = document.getElementById('preloader-glow');
  const slogan = document.getElementById('preloader-slogan');
  const letters = ['pl-letter-i', 'pl-letter-o', 'pl-letter-n', 'pl-letter-a']
    .map((id) => document.getElementById(id))
    .filter(Boolean);

  const glowPulse = gsap.to(glow, {
    opacity: 0.85,
    scale: 1.15,
    duration: 1.3,
    repeat: -1,
    yoyo: true,
    ease: 'sine.inOut',
    transformOrigin: '50% 50%'
  });

  const STEP = 0.22;
  letters.forEach((letter, i) => {
    gsap.delayedCall(i * STEP, () => letter.classList.add('is-in'));
  });
  const sloganAt = letters.length * STEP + 0.15;
  gsap.delayedCall(sloganAt, () => slogan.classList.add('is-in'));

  const minVisibleMs = (sloganAt + 0.55) * 1000;

  const exit = () => {
    glowPulse.kill();
    preloader.classList.add('is-leaving');
    preloader.addEventListener('transitionend', () => preloader.remove(), { once: true });
  };

  const pageReady = new Promise((resolve) => {
    if (document.readyState === 'complete') resolve();
    else window.addEventListener('load', () => resolve(), { once: true });
  });
  const minTimer = new Promise((resolve) => setTimeout(resolve, minVisibleMs));
  const safetyCap = new Promise((resolve) => setTimeout(resolve, 4000));

  Promise.race([Promise.all([pageReady, minTimer]), safetyCap]).then(exit);
}
runPreloader();

/* ---------------- Hero: 3D twin drill-down ----------------
   The hero canvas + click/zoom logic live in React (GltfTwinScene.jsx);
   the title/badge overlay is plain markup here. GltfTwinScene dispatches
   'twinlevelchange' whenever its internal currentLevel state changes (0
   overview / >0 focused) — the copy fades out of the way whenever a
   structure is focused, since the DetailPanel that appears then wants
   the room.

   Phase 83 retired the old mobile-only "tap #mobile-3d-cta to activate,
   #mobile-3d-close to back out" system this function used to also own —
   the 3D box is a normal-flow, always-interactive element in its own
   right-hand grid column (stacked below the copy on narrow viewports)
   now, not a faded full-bleed layer behind the text needing a separate
   activation state. */
function initHeroTwin() {
  const copy = document.getElementById('hero-copy');
  if (!copy) return;
  document.addEventListener('twinlevelchange', (e) => {
    copy.style.opacity = e.detail.level === 0 ? '1' : '0';
  });
}
initHeroTwin();

/* ---------------- Phase 88: hero line-reveal on load ----------------
   Masks each .js-reveal-line element behind its own overflow-hidden
   parent (set in index.html) and slides it up from fully below that
   mask into place. Reduced-motion visitors get the final state with no
   animation at all, same accessibility contract GltfTwinScene's own
   `reduceMotion` check already uses elsewhere on this page. */
function initHeroReveal() {
  const lines = gsap.utils.toArray('.js-reveal-line');
  if (!lines.length) return;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) {
    gsap.set(lines, { yPercent: 0, opacity: 1 });
    return;
  }
  gsap.set(lines, { yPercent: 100 });
  gsap.to(lines, {
    yPercent: 0,
    duration: 1.1,
    ease: 'cubic-bezier(0.76, 0, 0.24, 1)',
    stagger: 0.12,
    delay: 0.2
  });
}
initHeroReveal();

/* Phase 90 note: the old scroll-linked DNA parallax (initDnaParallax,
   targeting a hero-only #hero-dna-grid element) is gone. That element
   no longer exists — Phase 90 replaced it with .iona-dna-bg, a single
   fixed-position sitewide watermark driven purely by CSS keyframes
   (sway + color-breathe, see base.css), not scroll position, so there
   was no scroll listener left to port over. */

/* ---------------- Phase 88: custom identity cursor ----------------
   Tracks the pointer and toggles .is-active on #iona-cursor whenever
   it's over a .iona-cursor-target (hero CTA, 3D canvas column — see
   index.html). Targets also get .iona-cursor-target's own `cursor:none`
   (base.css) so the OS pointer doesn't fight the custom one. Desktop/
   fine-pointer only: base.css already hides #iona-cursor under
   (hover:none)/(pointer:coarse), so this just skips wiring up the
   listeners at all on touch devices rather than wiring dead code. */
function initCustomCursor() {
  const cursor = document.getElementById('iona-cursor');
  if (!cursor) return;
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  window.addEventListener(
    'pointermove',
    (e) => {
      cursor.style.left = `${e.clientX}px`;
      cursor.style.top = `${e.clientY}px`;
    },
    { passive: true }
  );

  /* Phase 89: widened from just the hero CTA/3D canvas to every
     clickable item worth calling out — the mega-menu's own big links
     and the services exhibition rows, both index.html-only elements
     added this phase. */
  document.querySelectorAll('.iona-cursor-target, .mobile-nav-link, .mobile-nav-cta, .services-exhibit-row').forEach((el) => {
    el.addEventListener('mouseenter', () => cursor.classList.add('is-active'));
    el.addEventListener('mouseleave', () => cursor.classList.remove('is-active'));
  });
}
initCustomCursor();

/* ---------------- Phase 88: magnetic hero CTA ----------------
   Subtle "follows the cursor" pull on .hero-editorial-cta while the
   pointer is inside it, eased back to rest on leave — the classic
   agency-site magnetic-button feel. Capped at MAGNETIC_STRENGTH of the
   raw offset (not a 1:1 follow) so the button visibly reacts without
   the label text feeling like it's chasing the mouse. */
function initMagneticButtons() {
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const MAGNETIC_STRENGTH = 0.35;
  document.querySelectorAll('.hero-editorial-cta').forEach((btn) => {
    btn.addEventListener('mousemove', (e) => {
      const rect = btn.getBoundingClientRect();
      const x = (e.clientX - (rect.left + rect.width / 2)) * MAGNETIC_STRENGTH;
      const y = (e.clientY - (rect.top + rect.height / 2)) * MAGNETIC_STRENGTH;
      gsap.to(btn, { x, y, duration: 0.3, ease: 'power2.out' });
    });
    btn.addEventListener('mouseleave', () => {
      gsap.to(btn, { x: 0, y: 0, duration: 0.5, ease: 'elastic.out(1, 0.4)' });
    });
  });
}
initMagneticButtons();

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
