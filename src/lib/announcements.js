import '../styles/announcements.css';

const OVERLAY_ID = 'iona-announcements-popup';
let dismissCurrent = null;

export function applyAnnouncementPopup(list, pageId) {
  if (pageId !== 'home' || !Array.isArray(list)) return;
  openAnnouncementModal(list.filter(a => a.showInPopup && a.title));
}

export function openAnnouncementModal(cards, startIndex = 0) {
  if (!Array.isArray(cards) || !cards.length) return;
  dismissCurrent?.();
  let index = Number.isFinite(startIndex) ? Math.min(Math.max(Math.trunc(startIndex), 0), cards.length - 1) : 0;
  const previousFocus = document.activeElement;
  const previousOverflow = document.body.style.overflow;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;
  overlay.setAttribute('data-lenis-prevent', '');
  const dialog = document.createElement('section');
  dialog.className = 'iona-ap-card';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', 'iona-ap-title');
  dialog.tabIndex = -1;
  const header = document.createElement('header');
  header.className = 'iona-ap-header';
  header.innerHTML = '<span class="iona-ap-edition"><img class="iona-brand-logo" src="/images/iona-connected.svg" alt="iona" width="100" height="36"><span>GÜNCEL / DUYURULAR</span></span>';
  const closeButton = document.createElement('button');
  closeButton.type = 'button'; closeButton.className = 'iona-ap-close';
  closeButton.setAttribute('aria-label', 'Duyuruyu kapat'); closeButton.textContent = '×';
  header.append(closeButton);
  const content = document.createElement('div'); content.className = 'iona-ap-content';
  const footer = document.createElement('footer'); footer.className = 'iona-ap-footer';
  const previous = button('←', 'Önceki duyuru');
  const next = button('→', 'Sonraki duyuru');
  const counter = document.createElement('span'); counter.className = 'iona-ap-counter';
  counter.setAttribute('aria-live', 'polite'); counter.setAttribute('aria-atomic', 'true');
  const dots = document.createElement('div'); dots.className = 'iona-ap-dots';
  const dotButtons = cards.map((a, i) => {
    const dot = button(String(i + 1).padStart(2, '0'), `${i + 1}. duyuru: ${a.title}`);
    dot.className = 'iona-ap-dot'; dot.addEventListener('click', () => go(i)); dots.append(dot); return dot;
  });
  footer.append(counter);
  if (cards.length > 1) footer.append(previous, dots, next);
  dialog.append(header, content, footer); overlay.append(dialog);
  const siblings = Array.from(document.body.children).map(element => [element, element.inert]);
  siblings.forEach(([element]) => { element.inert = true; });
  document.body.append(overlay); document.body.style.overflow = 'hidden';
  let closed = false;
  function close() {
    if (closed) return;
    closed = true; overlay.remove();
    siblings.forEach(([element, inert]) => { element.inert = inert; });
    document.body.style.overflow = previousOverflow;
    document.removeEventListener('keydown', onKeydown);
    dismissCurrent = null;
    if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
  }
  dismissCurrent = close;
  function onKeydown(event) {
    if (event.key === 'Escape') { event.preventDefault(); close(); return; }
    if (event.key !== 'Tab') return;
    const controls = Array.from(dialog.querySelectorAll('button, a[href]')).filter(element => !element.disabled);
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
  function go(nextIndex) {
    if (nextIndex === index) return;
    if (content.contains(document.activeElement)) closeButton.focus({ preventScroll: true });
    index = nextIndex; render();
    if (!reducedMotion.matches) content.animate([{ opacity: .3, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 260, easing: 'ease-out' });
  }
  function render() {
    const a = cards[index];
    content.replaceChildren();
    const imageUrl = safeUrl(a.bannerImage, true);
    content.classList.toggle('has-visual', Boolean(imageUrl));
    if (imageUrl) {
      const visual = document.createElement('div'); visual.className = 'iona-ap-visual';
      const image = document.createElement('img'); image.src = imageUrl; image.alt = ''; image.decoding = 'async';
      image.addEventListener('error', () => { visual.remove(); content.classList.remove('has-visual'); }, { once: true });
      visual.append(image); content.append(visual);
    }
    const body = document.createElement('div'); body.className = 'iona-ap-body';
    const meta = document.createElement('p'); meta.className = 'iona-ap-meta';
    meta.textContent = [a.category, a.date].filter(Boolean).join(' / ') || 'IONA’DAN HABERLER';
    const title = document.createElement('h2'); title.id = 'iona-ap-title'; title.className = 'iona-ap-title'; title.textContent = a.title;
    body.append(meta, title);
    if (a.description) { const description = document.createElement('p'); description.className = 'iona-ap-desc'; description.textContent = a.description; body.append(description); }
    const href = safeUrl(a.ctaLink);
    if (a.ctaEnabled && href) {
      const link = document.createElement('a'); link.className = 'iona-ap-cta'; link.href = href;
      const label = document.createElement('span'); label.textContent = a.ctaText || 'Detayları İncele';
      const arrow = document.createElement('span'); arrow.textContent = '↗'; arrow.setAttribute('aria-hidden', 'true');
      link.append(label, arrow); link.addEventListener('click', close); body.append(link);
    }
    content.append(body); content.scrollTop = 0;
    counter.textContent = `${String(index + 1).padStart(2, '0')} / ${String(cards.length).padStart(2, '0')}`;
    dotButtons.forEach((dot, i) => dot.setAttribute('aria-pressed', String(i === index)));
  }
  previous.addEventListener('click', () => go((index - 1 + cards.length) % cards.length));
  next.addEventListener('click', () => go((index + 1) % cards.length));
  closeButton.addEventListener('click', close);
  document.addEventListener('keydown', onKeydown);
  overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
  let touchStart;
  content.addEventListener('touchstart', event => { touchStart = [event.touches[0].clientX, event.touches[0].clientY]; }, { passive: true });
  content.addEventListener('touchcancel', () => { touchStart = null; }, { passive: true });
  content.addEventListener('touchend', event => {
    if (!touchStart || cards.length < 2) return;
    const dx = event.changedTouches[0].clientX - touchStart[0], dy = event.changedTouches[0].clientY - touchStart[1]; touchStart = null;
    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.5) go((index + (dx < 0 ? 1 : cards.length - 1)) % cards.length);
  }, { passive: true });
  render(); closeButton.focus({ preventScroll: true });
}

function button(text, label) {
  const element = document.createElement('button'); element.type = 'button'; element.className = 'iona-ap-arrow'; element.textContent = text; element.setAttribute('aria-label', label); return element;
}
function safeUrl(value, image = false) {
  if (typeof value !== 'string' || !value.trim()) return null;
  if (image && /^data:image\/(png|jpe?g|webp|gif|avif);base64,/i.test(value)) return value;
  try { const url = new URL(value, location.href); return (image ? ['https:', 'http:', 'blob:'] : ['https:', 'http:', 'mailto:', 'tel:']).includes(url.protocol) ? url.href : null; } catch { return null; }
}

