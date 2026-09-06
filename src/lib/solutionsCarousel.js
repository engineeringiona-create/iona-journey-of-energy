export function initSolutionsCarousel() {
  const stage = document.querySelector('#solutions .solutions-grid');
  if (!stage || stage.dataset.carousel) return;
  const cards = Array.from(stage.children);
  if (cards.length < 2) return;
  stage.dataset.carousel = 'true';
  stage.classList.add('solutions-carousel');
  stage.setAttribute('role', 'region');
  stage.setAttribute('aria-roledescription', 'karusel');
  stage.setAttribute('aria-label', 'IONA çözümleri');
  stage.tabIndex = 0;
  let active = 0;
  const controls = document.createElement('div');
  controls.className = 'solutions-controls';
  const prev = document.createElement('button');
  prev.type = 'button'; prev.textContent = '←'; prev.setAttribute('aria-label', 'Önceki çözüm');
  const next = document.createElement('button');
  next.type = 'button'; next.textContent = '→'; next.setAttribute('aria-label', 'Sonraki çözüm');
  const status = document.createElement('span');
  status.className = 'solutions-status'; status.setAttribute('aria-live', 'polite'); status.setAttribute('aria-atomic', 'true');
  const dots = document.createElement('div'); dots.className = 'solutions-dots';
  const buttons = cards.map((card, index) => {
    card.classList.add('solution-tile');
    card.setAttribute('role', 'group'); card.setAttribute('aria-roledescription', 'slayt');
    card.setAttribute('aria-label', `${index + 1} / ${cards.length}`);
    const button = document.createElement('button'); button.type = 'button';
    button.textContent = String(index + 1).padStart(2, '0');
    button.setAttribute('aria-label', card.querySelector('h3')?.textContent || `Çözüm ${index + 1}`);
    button.addEventListener('click', () => render(index));
    dots.append(button); return button;
  });
  controls.append(prev, status, next); stage.after(controls, dots);
  function render(index) {
    active = (index + cards.length) % cards.length;
    cards.forEach((card, i) => {
      let offset = (i - active + cards.length) % cards.length;
      if (offset > cards.length / 2) offset -= cards.length;
      card.style.setProperty('--offset', offset);
      card.style.setProperty('--depth', Math.abs(offset));
      card.style.zIndex = String(cards.length - Math.abs(offset));
      card.classList.toggle('is-current', offset === 0);
      card.classList.toggle('is-distant', Math.abs(offset) > 2);
      card.inert = offset !== 0;
      card.setAttribute('aria-hidden', String(offset !== 0));
      buttons[i].setAttribute('aria-pressed', String(i === active));
    });
    status.textContent = `${String(active + 1).padStart(2, '0')} / ${String(cards.length).padStart(2, '0')}`;
  }
  prev.addEventListener('click', () => render(active - 1));
  next.addEventListener('click', () => render(active + 1));
  stage.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    render(event.key === 'Home' ? 0 : event.key === 'End' ? cards.length - 1 : active + (event.key === 'ArrowRight' ? 1 : -1));
  });
  let start;
  stage.addEventListener('pointerdown', event => { if (event.pointerType !== 'mouse') start = [event.clientX, event.clientY]; });
  stage.addEventListener('pointercancel', () => { start = null; });
  stage.addEventListener('pointerup', event => {
    if (!start) return;
    const dx = event.clientX - start[0], dy = event.clientY - start[1]; start = null;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.4) render(active + (dx < 0 ? 1 : -1));
  });
  const observer = new ResizeObserver(() => {
    const height = Math.ceil(Math.max(...cards.map(card => card.offsetHeight)) + 36);
    if (stage.style.height !== `${height}px`) stage.style.height = `${height}px`;
  });
  cards.forEach(card => observer.observe(card));
  render(0);
}
