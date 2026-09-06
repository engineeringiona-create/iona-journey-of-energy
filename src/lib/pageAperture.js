/** A two-panel architectural aperture for real multi-page navigation. */
export function initPageCurtain() {
  const curtain = document.getElementById('iona-curtain');
  if (!curtain || curtain.dataset.aperture) return;
  curtain.dataset.aperture = 'true';
  curtain.classList.add('is-revealed');
  curtain.replaceChildren();
  const panels = ['left', 'right'].map(side => {
    const panel = document.createElement('div');
    panel.className = `aperture-panel aperture-${side}`;
    curtain.append(panel);
    return panel;
  });
  const signature = document.createElement('div');
  signature.className = 'aperture-signature';
  const mark = document.createElement('span');
  mark.className = 'iona-wordmark-text'; mark.textContent = 'iona';
  const label = document.createElement('span'); label.className = 'aperture-label';
  signature.append(mark, label); curtain.append(signature);
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  let leaving = false;
  let generation = 0;
  let animations = [];
  function reset() {
    generation++;
    animations.forEach(animation => animation.cancel()); animations = [];
    curtain.classList.remove('is-transitioning'); leaving = false;
  }
  async function transition(cover) {
    const current = ++generation;
    animations.forEach(animation => animation.cancel());
    curtain.classList.add('is-transitioning');
    const compact = matchMedia('(max-width: 700px)').matches;
    const duration = cover ? (compact ? 200 : 280) : (compact ? 360 : 540);
    animations = panels.map((panel, i) => {
      const outside = `translateX(${i ? 101 : -101}%)`;
      return panel.animate([{transform: cover ? outside : 'translateX(0)'}, {transform: cover ? 'translateX(0)' : outside}],
        {duration, easing: 'cubic-bezier(.76,0,.24,1)', fill: 'both', delay: i * (compact ? 0 : 35)});
    });
    animations.push(signature.animate(cover
      ? [{opacity: 0, transform: 'translate(-50%, calc(-50% + 8px))'}, {opacity: 1, transform: 'translate(-50%, -50%)'}]
      : [{opacity: 1, transform: 'translate(-50%, -50%)'}, {opacity: 0, transform: 'translate(-50%, calc(-50% - 8px))'}],
      {duration: cover ? duration : 180, fill: 'both', easing: 'ease-out'}));
    await Promise.allSettled(animations.map(animation => animation.finished));
    if (current !== generation) return false;
    if (!cover) reset();
    return true;
  }
  label.textContent = document.querySelector('.desktop-nav-link[aria-current="page"]')?.textContent.trim() || 'MÜHENDİSLİK / ENERJİ';
  if (!preference.matches) transition(false);
  window.addEventListener('pageshow', event => { if (event.persisted) reset(); });
  document.addEventListener('click', async event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
    if (!link || (link.target && link.target !== '_self') || link.hasAttribute('download')) return;
    const url = new URL(link.href, location.href);
    if (url.origin !== location.origin || !['http:', 'https:'].includes(url.protocol)) return;
    if (url.pathname === location.pathname && url.search === location.search) return;
    if (preference.matches) return;
    if (url.pathname !== '/' && !url.pathname.endsWith('.html')) return;
    event.preventDefault();
    if (leaving) return;
    leaving = true;
    label.textContent = link.textContent.trim().replace(/\s+/g, ' ').slice(0, 64) || 'IONA';
    try {
      if (await transition(true)) location.assign(url.href);
    } catch {
      location.assign(url.href);
    }
  });
}
