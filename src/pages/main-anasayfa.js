import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { initFadeIn, initThemeToggle, initParallax, initSiteSearch, initCardSpotlight, initMobileNav } from '../common.js';
import { initI18n, initLangSwitcher } from '../i18n.js';

gsap.registerPlugin(ScrollTrigger);
await initI18n();
initLangSwitcher();
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

/* ---------------- Hero slider ----------------
   Slide copy comes from the active i18n dictionary (home.hero.slideN_*)
   instead of a hardcoded array, so it re-renders in the new language
   when the visitor switches. */
function initHeroSlider() {
  const slides = document.querySelectorAll('.hero-slide');
  const headline = document.getElementById('hero-headline');
  const subhead = document.getElementById('hero-subhead');
  const indicatorCurrent = document.getElementById('hero-indicator-current');
  const prevBtn = document.getElementById('hero-prev');
  const nextBtn = document.getElementById('hero-next');
  if (!slides.length || !headline) return;

  function buildContent(dict) {
    return [1, 2, 3].map((n) => ({
      headline: dict[`home.hero.slide${n}_title`] || '',
      subhead: dict[`home.hero.slide${n}_sub`] || ''
    }));
  }

  let content = buildContent(window.__ionaDict || {});
  let current = 0;
  let timer = null;
  let animating = false;

  function renderText(index, animate = true) {
    if (!animate) {
      headline.textContent = content[index].headline;
      subhead.textContent = content[index].subhead;
      return;
    }
    const tl = gsap.timeline();
    tl.to([headline, subhead], {
      y: -24, opacity: 0, duration: 0.4, ease: 'power2.in', stagger: 0.05
    });
    tl.call(() => {
      headline.textContent = content[index].headline;
      subhead.textContent = content[index].subhead;
    });
    tl.fromTo([headline, subhead], {
      y: 24, opacity: 0
    }, {
      y: 0, opacity: 1, duration: 0.6, ease: 'power2.out', stagger: 0.08,
      onComplete: () => { animating = false; }
    });
  }

  function goTo(index) {
    if (animating || index === current) return;
    animating = true;
    const nextIndex = (index + slides.length) % slides.length;
    const outgoing = slides[current];
    const incoming = slides[nextIndex];

    gsap.to(outgoing, { opacity: 0, duration: 0.9, ease: 'power2.inOut' });
    gsap.to(incoming, { opacity: 1, duration: 0.9, ease: 'power2.inOut' });
    renderText(nextIndex);

    indicatorCurrent.textContent = String(nextIndex + 1).padStart(2, '0');
    current = nextIndex;
  }

  function next() { goTo(current + 1); }
  function prev() { goTo(current - 1); }

  function startAutoplay() {
    clearInterval(timer);
    timer = setInterval(next, 6000);
  }

  nextBtn?.addEventListener('click', () => { next(); startAutoplay(); });
  prevBtn?.addEventListener('click', () => { prev(); startAutoplay(); });

  document.addEventListener('i18nchange', (e) => {
    content = buildContent(e.detail.dict);
    renderText(current, false);
  });

  startAutoplay();
}
initHeroSlider();

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
