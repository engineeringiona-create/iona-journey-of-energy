/** Fit the desktop introduction into the available viewport without scaling text. */
export function initHeroViewport() {
  const hero = document.getElementById('hero');
  const root = document.getElementById('iona-digital-twin-root');
  if (!hero || !root) return;
  let frame;
  const measure = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const viewport = root.querySelector('.twin-viewport');
      if (!viewport) return;
      const desktop = matchMedia('(min-width: 1024px) and (min-height: 700px)').matches;
      if (!desktop) {
        hero.style.removeProperty('--plant-viewport-height'); return;
      }
      if (hero.classList.contains('is-inspecting')) return;
      const heroTop = hero.getBoundingClientRect().top + scrollY;
      const viewportTop = viewport.getBoundingClientRect().top + scrollY;
      const tail = hero.getBoundingClientRect().bottom - viewport.getBoundingClientRect().bottom;
      const available = innerHeight - (viewportTop - heroTop) - tail - 10;
      const height = Math.max(280, Math.floor(available));
      const value = `${height}px`;
      if (hero.style.getPropertyValue('--plant-viewport-height') !== value) hero.style.setProperty('--plant-viewport-height', value);
    });
  };
  const resize = new ResizeObserver(measure);
  resize.observe(hero); resize.observe(root);
  ['.hero-copy', '.hero-metrics', '.hero-model-caption'].forEach(selector => {const el = hero.querySelector(selector); if (el) resize.observe(el);});
  const mutation = new MutationObserver(measure); mutation.observe(root, {childList: true, subtree: true});
  window.addEventListener('resize', measure, {passive: true});
  document.addEventListener('twinlevelchange', measure);
  document.fonts?.ready.then(measure);
  measure();
}
