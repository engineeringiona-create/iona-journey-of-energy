import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { initFadeIn, initThemeToggle, initParallax, initSiteSearch, initCardSpotlight, initMobileNav, initSmoothScroll, initPageCurtain, initFooterCurve } from '../common.js';
import { initI18n, initLangSwitcher } from '../i18n.js';
import { initQuoteModal } from '../lib/quoteModal.js';
import { initBiogasCalculator } from '../lib/biogasCalculator.js';
import { initHelixScrollBg } from '../three/helix-scroll-bg.js';

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
initHelixScrollBg(document.getElementById('helix-scroll-bg'));
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
    /* Phase 97: lets initHeroCinematicIntro start its own 1.5s hold the
       moment the preloader actually starts dissolving, instead of on a
       fixed timer from script-eval — otherwise that hold would tick
       away invisibly while the opaque preloader still covers it. */
    document.dispatchEvent(new CustomEvent('preloaderdone'));
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

/* ---------------- Phase 97: cinematic hero intro ----------------
   The headline starts perfectly centered on screen at scale 1.2 over a
   blurred/dimmed backdrop (#hero-intro-overlay), holds there while the
   preloader is still up, then — once the preloader actually starts
   dissolving (see the 'preloaderdone' dispatch in runPreloader above)
   — waits 1.5s and animates back to its real in-flow position as the
   overlay fades out. This is a FLIP-style transform (measure the real
   rect, gsap.set an offsetting transform, tween back to identity)
   rather than a Framer Motion layout animation: the site's whole
   motion layer is already GSAP end to end (see initHeroReveal just
   above, initMagneticButtons below), and the 3D inspection mode this
   headline hands off to (click-to-select, camera fit, X-ray dimming,
   the slide-in detail panel) already exists and works inside
   GltfTwinScene.jsx — pulling in a second animation library for just
   this one element would fight that existing system for no visual
   gain. The gsap.set below runs at script-eval time, before the
   preloader has dissolved, so there's no flash of the headline
   snapping into its offset position — the opaque preloader is still
   covering it. */
function initHeroCinematicIntro() {
  const overlay = document.getElementById('hero-intro-overlay');
  const headline = document.querySelector('#hero-copy h1');
  if (!overlay || !headline) return;

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    overlay.remove();
    return;
  }

  const rect = headline.getBoundingClientRect();
  const dx = window.innerWidth / 2 - (rect.left + rect.width / 2);
  const dy = window.innerHeight / 2 - (rect.top + rect.height / 2);
  gsap.set(headline, { x: dx, y: dy, scale: 1.2, transformOrigin: '50% 50%' });

  document.addEventListener(
    'preloaderdone',
    () => {
      const tl = gsap.timeline({ delay: 1.5 });
      tl.to(overlay, {
        opacity: 0,
        duration: 0.9,
        ease: 'power2.out',
        onComplete: () => overlay.remove()
      }).to(
        headline,
        { x: 0, y: 0, scale: 1, duration: 1.2, ease: 'power3.inOut' },
        '<'
      );
    },
    { once: true }
  );
}
initHeroCinematicIntro();

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

  /* Phase 101: the cursor's own SVG reuses the exact same green-fill/
     yellow-ring motif as the hero heading icon (see index.html) — with
     good reason (matching), but that means whenever it's left active
     over the 3D canvas right as #hero-copy fades into Inspection Mode,
     it reads as "the icon didn't fade with the rest of the text". It's
     a separate element that was never going to fade with hero-copy (it
     has to keep working for the still-visible 3D column), so the real
     fix is suppressing .is-active for the duration of Inspection Mode
     instead, via the same 'twinlevelchange' event hero-copy's own fade
     listens to. */
  let inspecting = false;
  document.addEventListener('twinlevelchange', (e) => {
    inspecting = e.detail.level !== 0;
    if (inspecting) cursor.classList.remove('is-active');
  });

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
    el.addEventListener('mouseenter', () => {
      if (!inspecting) cursor.classList.add('is-active');
    });
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
