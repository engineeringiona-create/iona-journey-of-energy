const SESSION_KEY = 'iona-announcements-popup-seen';
const OVERLAY_ID = 'iona-announcements-popup';

/* Homepage-only, once per browser session (see eventPopup's old
   comment history — sessionStorage, not localStorage, so a returning
   visitor days later still sees it again, just not on every page load
   within one visit). Shows every announcement flagged showInPopup as a
   single-card-at-a-time carousel (content swap + fade, not a real
   sliding track — simpler, and there's no visual difference with only
   one card visible at a time anyway). */
export function applyAnnouncementPopup(list, pageId) {
  if (pageId !== 'home' || !Array.isArray(list)) return;
  const cards = list.filter((a) => a.showInPopup && a.title);
  if (cards.length === 0) return;
  try {
    if (sessionStorage.getItem(SESSION_KEY) === 'true') return;
  } catch (e) {
    /* private mode etc — fall through and show it anyway */
  }

  let index = 0;

  const overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.zIndex = '80';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.background = 'rgba(5,7,6,0.7)';
  overlay.style.padding = '24px';

  const card = document.createElement('div');
  card.style.position = 'relative';
  card.style.width = '100%';
  card.style.maxWidth = '400px';
  card.style.background = '#171b18';
  card.style.borderRadius = '16px';
  card.style.overflow = 'hidden';
  card.style.boxShadow = '0 40px 80px -20px rgba(0,0,0,0.5)';
  card.style.opacity = '1';
  card.style.transition = 'opacity 150ms ease';

  overlay.appendChild(card);
  document.body.appendChild(overlay);

  function close() {
    overlay.remove();
    try { sessionStorage.setItem(SESSION_KEY, 'true'); } catch (e) { /* private mode etc. */ }
  }

  function go(next) {
    if (next === index) return;
    card.style.opacity = '0';
    setTimeout(() => {
      index = next;
      render();
      card.style.opacity = '1';
    }, 150);
  }

  function render() {
    const a = cards[index];
    const bannerHtml = a.bannerImage
      ? `<img src="${a.bannerImage}" alt="" style="width:100%;height:160px;object-fit:cover;display:block;">`
      : '';
    const dots = cards
      .map((_, i) => `<span data-dot="${i}" style="width:6px;height:6px;border-radius:50%;background:${i === index ? '#ff751f' : 'rgba(255,255,255,0.25)'};display:inline-block;cursor:pointer;"></span>`)
      .join('');
    const ctaHtml = a.ctaEnabled
      ? `<a href="${a.ctaLink || '#'}" style="flex:1;text-align:center;background:var(--brand-orange,#ff751f);color:#fff;font-weight:700;font-size:13px;padding:12px;border-radius:999px;text-decoration:none;">${escapeHtml(a.ctaText || 'Kayıt Ol / Detaylar')}</a>`
      : '';

    card.innerHTML = `
      ${bannerHtml}
      <div style="padding:24px;">
        ${cards.length > 1 ? `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
          <button type="button" id="iona-ap-prev" style="background:rgba(255,255,255,0.08);color:#fff;border:0;border-radius:999px;width:28px;height:28px;cursor:pointer;">‹</button>
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="display:flex;gap:5px;">${dots}</span>
            <span style="color:rgba(255,255,255,0.4);font-size:11px;">${index + 1}/${cards.length}</span>
          </div>
          <button type="button" id="iona-ap-next" style="background:rgba(255,255,255,0.08);color:#fff;border:0;border-radius:999px;width:28px;height:28px;cursor:pointer;">›</button>
        </div>` : ''}
        <h3 style="color:#fff;font-weight:800;font-size:20px;margin:0 0 8px;">${escapeHtml(a.title)}</h3>
        ${a.date ? `<p style="color:rgba(255,255,255,0.4);font-size:12px;margin:0 0 10px;">${escapeHtml(a.date)}</p>` : ''}
        ${a.description ? `<div style="color:rgba(255,255,255,0.65);font-size:13px;max-height:140px;overflow-y:auto;margin:0 0 16px;line-height:1.5;">${escapeHtml(a.description)}</div>` : ''}
        <div style="display:flex;gap:10px;">
          ${ctaHtml}
          <button type="button" id="iona-ap-close" style="background:rgba(255,255,255,0.08);color:#fff;font-weight:700;font-size:13px;padding:12px 16px;border-radius:999px;border:0;cursor:pointer;">Kapat</button>
        </div>
      </div>
    `;

    card.querySelector('#iona-ap-close').addEventListener('click', close);
    card.querySelector('#iona-ap-prev')?.addEventListener('click', () => go((index - 1 + cards.length) % cards.length));
    card.querySelector('#iona-ap-next')?.addEventListener('click', () => go((index + 1) % cards.length));
    card.querySelectorAll('[data-dot]').forEach((dot) => {
      dot.addEventListener('click', () => go(Number(dot.dataset.dot)));
    });
  }

  render();

  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  let touchStartX = null;
  card.addEventListener('touchstart', (e) => { touchStartX = e.touches[0].clientX; });
  card.addEventListener('touchend', (e) => {
    if (touchStartX === null || cards.length < 2) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 40) go(dx < 0 ? (index + 1) % cards.length : (index - 1 + cards.length) % cards.length);
    touchStartX = null;
  });
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
