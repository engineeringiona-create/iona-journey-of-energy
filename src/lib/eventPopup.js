const SESSION_KEY = 'iona-event-popup-seen';
const OVERLAY_ID = 'iona-event-popup';

/* Homepage-only, once per browser session (sessionStorage, not
   localStorage — a returning visitor days later should see a still-live
   event again, but not on every single page load within one visit). */
export function applyEventPopup(cfg, pageId) {
  if (pageId !== 'home' || !cfg || !cfg.enabled || !cfg.title) return;
  try {
    if (sessionStorage.getItem(SESSION_KEY) === 'true') return;
  } catch (e) {
    /* private mode etc — fall through and show it anyway */
  }

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
  card.style.width = '100%';
  card.style.maxWidth = '380px';
  card.style.background = '#171b18';
  card.style.borderRadius = '16px';
  card.style.overflow = 'hidden';
  card.style.boxShadow = '0 40px 80px -20px rgba(0,0,0,0.5)';

  const bannerHtml = cfg.bannerImage
    ? `<img src="${cfg.bannerImage}" alt="" style="width:100%;height:160px;object-fit:cover;display:block;">`
    : '';

  card.innerHTML = `
    ${bannerHtml}
    <div style="padding:24px;">
      <h3 style="color:#fff;font-weight:800;font-size:20px;margin:0 0 8px;">${escapeHtml(cfg.title)}</h3>
      ${cfg.eventInfo ? `<p style="color:rgba(255,255,255,0.6);font-size:13px;margin:0 0 16px;">${escapeHtml(cfg.eventInfo)}</p>` : ''}
      <div style="display:flex;gap:10px;">
        <a href="${cfg.ctaLink || '#'}" style="flex:1;text-align:center;background:var(--brand-orange,#ff751f);color:#fff;font-weight:700;font-size:13px;padding:12px;border-radius:999px;text-decoration:none;">${escapeHtml(cfg.ctaText || 'Kayıt Ol / Detaylar')}</a>
        <button type="button" id="iona-event-popup-close" style="background:rgba(255,255,255,0.08);color:#fff;font-weight:700;font-size:13px;padding:12px 16px;border-radius:999px;border:0;cursor:pointer;">Kapat</button>
      </div>
    </div>
  `;

  overlay.appendChild(card);
  document.body.appendChild(overlay);

  function close() {
    overlay.remove();
    try { sessionStorage.setItem(SESSION_KEY, 'true'); } catch (e) { /* private mode etc. */ }
  }

  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  overlay.querySelector('#iona-event-popup-close').addEventListener('click', close);
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
