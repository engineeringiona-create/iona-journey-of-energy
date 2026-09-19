/** Decorative digestion cycles and pipe routing; never an additional WebGL context. */
export function initProcessAccents() {
  if (!document.body.classList.contains('iona-brand') || document.body.dataset.processAccents) return;
  document.body.dataset.processAccents = 'true';
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  const entries = new Map();
  const update = () => entries.forEach((visible, node) => {
    node.classList.toggle('is-running', visible && !document.hidden && !preference.matches);
  });
  const observer = new IntersectionObserver(records => {
    records.forEach(record => entries.set(record.target, record.isIntersecting)); update();
  }, {threshold:0.05});
  const diagrams = {
    'contact-hero': `<circle cx="160" cy="110" r="76"/><circle cx="160" cy="110" r="50"/><path d="M84 110h26m100 0h26"/><g class="process-orbit"><circle cx="160" cy="34" r="5" fill="currentColor"/><circle cx="160" cy="186" r="5" fill="currentColor"/></g>`,
    'flux-live': `<path d="M0 160h95q30 0 30-30V90q0-30 30-30h55q30 0 30 30v20q0 30 30 30h50"/><path class="process-pulse" stroke-width="3" d="M0 160h95q30 0 30-30V90q0-30 30-30h55q30 0 30 30v20q0 30 30 30h50"/><circle cx="125" cy="110" r="7"/><circle cx="240" cy="110" r="7"/>`
  };
  const cycle = `<path d="M-30 140h85q35 0 35-35v-5a65 65 0 0 1 130 0v5q0 35 35 35h95"/><path class="process-warm" d="M-30 166h85q61 0 61-61v-5a39 39 0 0 1 78 0v5q0 61 61 61h95"/><circle cx="90" cy="105" r="5" fill="currentColor"/><circle class="process-warm" cx="220" cy="105" r="5" fill="currentColor"/>`;
  const reactor = `<ellipse cx="154" cy="70" rx="77" ry="24"/><path d="M77 70v90c0 33 154 33 154 0V70M77 125h-42v55H0M231 128h40q15 0 15-15V60h34"/><ellipse cx="154" cy="160" rx="77" ry="24"/><path class="process-warm" d="M100 70q54-74 108 0M154 105v40m-25-16 50 0"/><circle cx="285" cy="100" r="7"/><path class="process-pulse" d="M231 128h40q15 0 15-15V60h34"/>`;
  diagrams['about-teaser'] = reactor;
  diagrams['biogaz-hesaplayici'] = reactor;
  diagrams['solutions'] = cycle;
  diagrams['partners'] = `<defs><linearGradient id="iona-field-curve" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#2d9937"/><stop offset="1" stop-color="#ffc700"/></linearGradient></defs><path d="M40 -20C70 95 210 95 280 240" stroke="url(#iona-field-curve)" stroke-width="5" stroke-linecap="round"/>`;
  diagrams['contact-form'] = cycle;
  Object.entries(diagrams).forEach(([id, markup]) => {
    const host = document.getElementById(id);
    if (!host || host.querySelector('.process-accent')) return;
    host.classList.add('process-accent-host');
    const node = document.createElement('div');
    node.className = 'process-accent'; node.setAttribute('aria-hidden', 'true');
    node.innerHTML = `<svg viewBox="0 0 320 220" fill="none" stroke="currentColor" stroke-width="1.5">${markup}</svg>`;
    host.append(node); entries.set(node, false); observer.observe(node);
  });
  let frame = 0;
  function position() {
    frame = 0;
    entries.forEach((visible, node) => {
      if (!visible) return;
      const y = preference.matches ? 0 : Math.max(-24, Math.min(24, (innerHeight / 2 - node.parentElement.getBoundingClientRect().top) * .035));
      node.style.setProperty('--process-shift', `${y.toFixed(1)}px`);
    });
  }
  function schedule() {
    if (!document.hidden && !preference.matches && !frame) frame = requestAnimationFrame(position);
  }
  window.addEventListener('scroll', schedule, {passive:true});
  window.addEventListener('resize', schedule, {passive:true});
  preference.addEventListener('change', position);
  const rules = document.querySelectorAll('.service-specs');
  const reveal = new IntersectionObserver(records => records.forEach(record => {
    if (record.isIntersecting) { record.target.classList.add('is-drawn'); reveal.unobserve(record.target); }
  }), {threshold:.2});
  rules.forEach(rule => { rule.classList.add('process-rule'); reveal.observe(rule); });
  if (!entries.size) { observer.disconnect(); return; }
  document.addEventListener('visibilitychange', update);
  preference.addEventListener('change', update);
}
