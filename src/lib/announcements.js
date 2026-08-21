const SESSION_KEY = 'iona-announcements-popup-seen';
const OVERLAY_ID = 'iona-announcements-popup';
const STYLE_ID = 'iona-announcements-popup-style';

/* "Liquid glass" wide-format popup (Phase 39): translucent frosted card
   over a dark backdrop, wide two-column layout on desktop (visual left,
   content right), stacked on mobile. All the glass/blur values live in
   one injected stylesheet so media queries (impossible via inline
   style) can drive the column switch. */
function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    #${OVERLAY_ID} { position: fixed; inset: 0; z-index: 80; display: flex; align-items: center; justify-content: center; background: rgba(5,7,6,0.72); padding: 24px; }
    .iona-ap-glow { position: absolute; width: 640px; height: 640px; border-radius: 50%; filter: blur(90px); pointer-events: none; z-index: 0; }
    .iona-ap-glow-a { background: radial-gradient(circle, rgba(63,174,102,0.35), transparent 70%); top: -220px; left: -160px; }
    .iona-ap-glow-b { background: radial-gradient(circle, rgba(255,138,61,0.28), transparent 70%); bottom: -220px; right: -160px; }
    .iona-ap-card {
      position: relative; z-index: 1; width: 90vw; max-width: 860px; max-height: 85vh;
      display: flex; flex-direction: column; overflow: hidden;
      background: rgba(6,28,20,0.6);
      backdrop-filter: blur(20px) saturate(190%);
      -webkit-backdrop-filter: blur(20px) saturate(190%);
      border: 1px solid rgba(255,255,255,0.16);
      border-radius: 20px;
      box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5), inset 0 1px 1px 0 rgba(255,255,255,0.2);
      opacity: 1; transition: opacity 150ms ease;
    }
    @media (min-width: 820px) { .iona-ap-card { flex-direction: row; max-height: 560px; } }
    .iona-ap-visual { position: relative; flex-shrink: 0; width: 100%; height: 220px; overflow: hidden; }
    @media (min-width: 820px) { .iona-ap-visual { width: 42%; height: auto; } }
    .iona-ap-visual img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .iona-ap-body { position: relative; flex: 1; min-width: 0; padding: 32px; overflow-y: auto; display: flex; flex-direction: column; }
    .iona-ap-close {
      position: absolute; top: 14px; right: 14px; z-index: 3; width: 34px; height: 34px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      background: rgba(255,255,255,0.1); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
      border: 1px solid rgba(255,255,255,0.22); color: #fff; font-size: 16px; line-height: 1; cursor: pointer;
    }
    .iona-ap-close:hover { background: rgba(255,255,255,0.18); }
    .iona-ap-badge { display: inline-flex; align-items: center; gap: 6px; align-self: flex-start; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.18); color: rgba(255,255,255,0.85); font-size: 11px; font-weight: 700; letter-spacing: 0.04em; padding: 5px 12px; border-radius: 999px; margin-bottom: 14px; }
    .iona-ap-title { color: #fff; font-weight: 800; font-size: 24px; line-height: 1.2; margin: 0 0 12px; text-shadow: 0 1px 2px rgba(0,0,0,0.3); }
    .iona-ap-desc { color: rgba(255,255,255,0.72); font-size: 14px; line-height: 1.65; max-height: 160px; overflow-y: auto; margin: 0 0 20px; padding-right: 4px; }
    .iona-ap-actions { display: flex; gap: 10px; margin-top: auto; }
    .iona-ap-cta { flex: 1; text-align: center; background: var(--brand-orange, #ff751f); color: #fff; font-weight: 700; font-size: 13px; padding: 13px; border-radius: 999px; text-decoration: none; }
    .iona-ap-nav { display: flex; align-items: center; justify-content: space-between; margin-top: 16px; }
    .iona-ap-arrow {
      width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
      background: rgba(255,255,255,0.08); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
      border: 1px solid rgba(255,255,255,0.18); color: #fff; cursor: pointer; font-size: 15px;
    }
    .iona-ap-arrow:hover { background: rgba(255,255,255,0.16); }
    .iona-ap-dots { display: flex; align-items: center; gap: 6px; }
    .iona-ap-dot { width: 6px; height: 6px; border-radius: 999px; background: rgba(255,255,255,0.28); display: inline-block; cursor: pointer; transition: width 150ms ease, background 150ms ease; }
    .iona-ap-dot.is-active { width: 18px; background: var(--brand-orange, #ff751f); }
    .iona-ap-counter { color: rgba(255,255,255,0.4); font-size: 11px; }
  `;
  document.head.appendChild(style);
}

/* Homepage-only, once per browser session — sessionStorage, not
   localStorage, so a returning visitor days later still sees it again,
   just not on every page load within one visit. Shows every
   announcement flagged showInPopup as a single-card-at-a-time carousel
   (content swap + fade, not a real sliding track). */
export function applyAnnouncementPopup(list, pageId) {
  if (pageId !== 'home' || !Array.isArray(list)) return;
  const cards = list.filter((a) => a.showInPopup && a.title);
  if (cards.length === 0) return;
  try {
    if (sessionStorage.getItem(SESSION_KEY) === 'true') return;
  } catch (e) {
    /* private mode etc — fall through and show it anyway */
  }

  injectStyles();
  let index = 0;

  const overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;

  const glowA = document.createElement('div');
  glowA.className = 'iona-ap-glow iona-ap-glow-a';
  const glowB = document.createElement('div');
  glowB.className = 'iona-ap-glow iona-ap-glow-b';

  const card = document.createElement('div');
  card.className = 'iona-ap-card';

  overlay.append(glowA, glowB, card);
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
    const visualHtml = a.bannerImage
      ? `<div class="iona-ap-visual"><img src="${a.bannerImage}" alt=""></div>`
      : '';
    const badgeHtml = a.category || a.date
      ? `<span class="iona-ap-badge">${[a.category, a.date].filter(Boolean).map(escapeHtml).join(' · ')}</span>`
      : '';
    const ctaHtml = a.ctaEnabled
      ? `<a href="${a.ctaLink || '#'}" class="iona-ap-cta">${escapeHtml(a.ctaText || 'Kayıt Ol / Detaylar')}</a>`
      : '';
    const dots = cards
      .map((_, i) => `<span class="iona-ap-dot${i === index ? ' is-active' : ''}" data-dot="${i}"></span>`)
      .join('');

    card.innerHTML = `
      ${visualHtml}
      <div class="iona-ap-body">
        <button type="button" class="iona-ap-close" aria-label="Kapat">×</button>
        ${badgeHtml}
        <h3 class="iona-ap-title">${escapeHtml(a.title)}</h3>
        ${a.description ? `<div class="iona-ap-desc">${escapeHtml(a.description)}</div>` : ''}
        <div class="iona-ap-actions">${ctaHtml}</div>
        ${cards.length > 1 ? `
          <div class="iona-ap-nav">
            <button type="button" class="iona-ap-arrow" id="iona-ap-prev">‹</button>
            <div class="iona-ap-dots">${dots}<span class="iona-ap-counter">${index + 1}/${cards.length}</span></div>
            <button type="button" class="iona-ap-arrow" id="iona-ap-next">›</button>
          </div>
        ` : ''}
      </div>
    `;

    card.querySelector('.iona-ap-close').addEventListener('click', close);
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
