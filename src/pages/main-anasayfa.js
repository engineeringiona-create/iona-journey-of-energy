import { initEditorialMotion } from '../lib/editorialMotion.js';
import { initHelixScrollBg } from '../three/helix-scroll-bg.js';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { initFadeIn, initThemeToggle, initParallax, initSiteSearch, initCardSpotlight, initMobileNav, initSmoothScroll, initPageCurtain, initFooterCurve } from '../common.js';
import { initI18n, initLangSwitcher } from '../i18n.js';
import { initQuoteModal } from '../lib/quoteModal.js';
import { initBiogasCalculator } from '../lib/biogasCalculator.js';

gsap.registerPlugin(ScrollTrigger);
await initI18n();
initEditorialMotion();
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

initParallax();
initHelixScrollBg(document.getElementById('helix-scroll-bg'));

function initHeroTwin() {
  const copy = document.getElementById('hero-copy');
  if (!copy) return;
  document.addEventListener('twinlevelchange', (e) => {
    document.getElementById('hero').classList.toggle('is-inspecting', e.detail.level !== 0);
    copy.inert = e.detail.level !== 0;
  });
}
initHeroTwin();

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
    ease: 'power3.out',
    stagger: 0.12,
    delay: 0.2
  });
}
initHeroReveal();

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

function initServiceCards() {
  const cards = gsap.utils.toArray('.service-card');
  if (!cards.length) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
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

function initAccordion() {
  const items = [...document.querySelectorAll('#why-choose-us .accordion-item')];
  const setOpen = (item, open) => {
    item.classList.toggle('is-active', open);
    item.querySelector('button').setAttribute('aria-expanded', String(open));
    item.querySelector('.accordion-row').inert = !open;
  };
  items.forEach(item => item.querySelector('button')?.addEventListener('click', () => {
    const open = !item.classList.contains('is-active');
    items.forEach(other => setOpen(other, other === item && open));
  }));
}
initAccordion();

function initServiceStack() {
  const rows = [...document.querySelectorAll('.services-exhibit-row')];
  let frame;
  const measure = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => rows.forEach((row, i) => {
      row.classList.toggle('stack-too-tall', row.scrollHeight + 116 + i * 12 > innerHeight);
    }));
  };
  const observer = new ResizeObserver(measure);
  rows.forEach(row => observer.observe(row));
  window.addEventListener('resize', measure, { passive: true });
  measure();
}
initServiceStack();


