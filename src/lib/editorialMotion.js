/** Small, one-shot accents; no scroll trapping or continuous animation loops. */
export function initEditorialMotion() {
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  if (preference.matches) return;
  const animations = new Set();
  function play(element, frames, options) {
    const animation = element.animate(frames, { duration: 850, easing: 'cubic-bezier(.22,.68,.2,1)', ...options });
    animations.add(animation);
    animation.finished.then(() => animations.delete(animation)).catch(() => animations.delete(animation));
  }
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      observer.unobserve(entry.target);
      const element = entry.target;
      if (element.matches('.engineering-drawing')) {
        element.querySelectorAll('path, ellipse, line, circle, rect').forEach((path, i) => {
          const length = path.getTotalLength();
          play(path, [{ strokeDasharray: `${length}`, strokeDashoffset: length, opacity: .15 }, { strokeDasharray: `${length}`, strokeDashoffset: 0, opacity: 1 }], {duration: 1400, delay: i * 25});
        });
      } else if (element.matches('.partners-grid')) {
        Array.from(element.children).forEach((card, i) => play(card,
          [{ transform: `translateY(${28 + i * 4}px) rotate(${i % 2 ? 1 : -1}deg)`, opacity: .25 }, { transform: 'translateY(0) rotate(0deg)', opacity: 1 }], { delay: i * 75 }));
      } else {
        play(element, [{ clipPath: 'inset(12% 0 0 0)', transform: 'scale(1.06)' }, { clipPath: 'inset(0% 0 0 0)', transform: 'scale(1)' }], {duration: 1100});
      }
    });
  }, { threshold: .18 });
  document.querySelectorAll('.engineering-drawing, .partners-grid, .bento-card-media img').forEach(element => observer.observe(element));
  preference.addEventListener('change', event => {
    if (event.matches) { observer.disconnect(); animations.forEach(animation => animation.cancel()); }
  });
}
