const OVERLAY_ID = 'iona-announcements-popup';
const STYLE_ID = 'iona-announcements-popup-style';

/* "Liquid glass" wide-format popup (Phase 39): translucent frosted card,
   wide two-column layout on desktop (visual left, content right),
   stacked on mobile. All the glass/blur values live in one injected
   stylesheet so media queries (impossible via inline style) can drive
   the column switch.

   Phase 41: the glass itself now follows the site's light/dark theme
   (same :root / :root.dark switch base.css uses for --bg/--surface/
   --text) instead of always being the dark-emerald tint — a light frost
   with dark text in light mode, the original dark frost with white text
   in dark mode. Every color below reads one of these --ap-* variables
   instead of a literal white/black rgba so the two themes never drift. */
function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    :root {
      --ap-overlay-bg: rgba(230,229,222,0.7);
      --ap-card-bg: rgba(255,255,255,0.68);
      --ap-border: rgba(20,24,26,0.14);
      --ap-border-strong: rgba(20,24,26,0.22);
      --ap-shadow: 0 25px 50px -12px rgba(20,24,26,0.28), inset 0 1px 1px 0 rgba(255,255,255,0.6);
      --ap-text: #14181a;
      --ap-text-muted: rgba(20,24,26,0.68);
      --ap-title-shadow: none;
      --ap-glass-btn-bg: rgba(20,24,26,0.06);
      --ap-glass-btn-bg-hover: rgba(20,24,26,0.12);
      --ap-glass-btn-border: rgba(20,24,26,0.16);
      --ap-dot-bg: rgba(20,24,26,0.2);
      --ap-counter: rgba(20,24,26,0.45);
    }
    :root.dark {
      --ap-overlay-bg: rgba(5,7,6,0.72);
      --ap-card-bg: rgba(6,28,20,0.6);
      --ap-border: rgba(255,255,255,0.16);
      --ap-border-strong: rgba(255,255,255,0.22);
      --ap-shadow: 0 25px 50px -12px rgba(0,0,0,0.5), inset 0 1px 1px 0 rgba(255,255,255,0.2);
      --ap-text: #fff;
      --ap-text-muted: rgba(255,255,255,0.72);
      --ap-title-shadow: 0 1px 2px rgba(0,0,0,0.3);
      --ap-glass-btn-bg: rgba(255,255,255,0.1);
      --ap-glass-btn-bg-hover: rgba(255,255,255,0.18);
      --ap-glass-btn-border: rgba(255,255,255,0.22);
      --ap-dot-bg: rgba(255,255,255,0.28);
      --ap-counter: rgba(255,255,255,0.4);
    }
    #${OVERLAY_ID} { position: fixed; inset: 0; z-index: 80; display: flex; align-items: center; justify-content: center; background: var(--ap-overlay-bg); padding: 24px; }
    .iona-ap-glow { position: absolute; width: 640px; height: 640px; border-radius: 50%; filter: blur(90px); pointer-events: none; z-index: 0; }
    .iona-ap-glow-a { background: radial-gradient(circle, rgba(63,174,102,0.35), transparent 70%); top: -220px; left: -160px; }
    .iona-ap-glow-b { background: radial-gradient(circle, rgba(255,138,61,0.28), transparent 70%); bottom: -220px; right: -160px; }
    .iona-ap-card {
      position: relative; z-index: 1; width: 90vw; max-width: 860px; max-height: 85vh;
      display: flex; flex-direction: column; overflow: hidden;
      background: var(--ap-card-bg);
      backdrop-filter: blur(20px) saturate(190%);
      -webkit-backdrop-filter: blur(20px) saturate(190%);
      border: 1px solid var(--ap-border);
      border-radius: 20px;
      box-shadow: var(--ap-shadow);
      opacity: 1; transition: opacity 150ms ease;
      transform: translateZ(0);
      backface-visibility: hidden;
    }
    @media (min-width: 820px) { .iona-ap-card { flex-direction: row; max-height: 560px; } }
    .iona-ap-visual { position: relative; flex-shrink: 0; width: 100%; height: 220px; overflow: hidden; }
    @media (min-width: 820px) { .iona-ap-visual { width: 42%; height: auto; } }
    .iona-ap-visual img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .iona-ap-body { position: relative; flex: 1; min-width: 0; padding: 32px; overflow-y: auto; display: flex; flex-direction: column; }
    .iona-ap-close {
      position: absolute; top: 14px; right: 14px; z-index: 3; width: 34px; height: 34px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      background: var(--ap-glass-btn-bg); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
      border: 1px solid var(--ap-border-strong); color: var(--ap-text); font-size: 16px; line-height: 1; cursor: pointer;
    }
    .iona-ap-close:hover { background: var(--ap-glass-btn-bg-hover); }
    .iona-ap-badge { display: inline-flex; align-items: center; gap: 6px; align-self: flex-start; background: var(--ap-glass-btn-bg); border: 1px solid var(--ap-border); color: var(--ap-text-muted); font-size: 11px; font-weight: 700; letter-spacing: 0.04em; padding: 5px 12px; border-radius: 999px; margin-bottom: 14px; }
    .iona-ap-title { color: var(--ap-text); font-weight: 800; font-size: 24px; line-height: 1.2; margin: 0 0 12px; text-shadow: var(--ap-title-shadow); }
    .iona-ap-desc { color: var(--ap-text-muted); font-size: 14px; line-height: 1.65; max-height: 160px; overflow-y: auto; margin: 0 0 20px; padding-right: 4px; }
    .iona-ap-actions { display: flex; gap: 10px; margin-top: auto; }
    .iona-ap-cta { flex: 1; text-align: center; background: var(--brand-orange, #ff751f); color: #fff; font-weight: 700; font-size: 13px; padding: 13px; border-radius: 999px; text-decoration: none; }
    .iona-ap-nav { display: flex; align-items: center; justify-content: space-between; margin-top: 16px; }
    .iona-ap-arrow {
      width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
      background: var(--ap-glass-btn-bg); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
      border: 1px solid var(--ap-border); color: var(--ap-text); cursor: pointer; font-size: 15px;
    }
    .iona-ap-arrow:hover { background: var(--ap-glass-btn-bg-hover); }
    .iona-ap-dots { display: flex; align-items: center; gap: 6px; }
    .iona-ap-dot { width: 6px; height: 6px; border-radius: 999px; background: var(--ap-dot-bg); display: inline-block; cursor: pointer; transition: width 150ms ease, background 150ms ease; }
    .iona-ap-dot.is-active { width: 18px; background: var(--brand-orange, #ff751f); }
    .iona-ap-counter { color: var(--ap-counter); font-size: 11px; }
  `;
  document.head.appendChild(style);
}

/* Homepage-only: shows every announcement flagged showInPopup as a
   single-card-at-a-time carousel. Fires on every homepage load (Phase
   40 — the earlier once-per-session sessionStorage gate made the popup
   look "broken" during review since a tab that had already shown/closed
   it wouldn't show it again on reload) — just delegates straight into
   the shared opener also used by duyurular.html's card click-through. */
export function applyAnnouncementPopup(list, pageId) {
  if (pageId !== 'home' || !Array.isArray(list)) return;
  const cards = list.filter((a) => a.showInPopup && a.title);
  openAnnouncementModal(cards, 0);
}

/* Shared wide "liquid glass" carousel modal: mounts `cards` (any list of
   announcement objects — title/description/date/category/bannerImage/
   ctaEnabled/ctaText/ctaLink) starting at `startIndex`. Used both for
   the homepage auto-popup above and duyurular.html's per-card
   click-through, so the two never drift into two different modals. */
export function openAnnouncementModal(cards, startIndex = 0) {
  if (!Array.isArray(cards) || cards.length === 0) return;

  injectStyles();
  let index = Math.min(Math.max(startIndex, 0), cards.length - 1);

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
    document.removeEventListener('keydown', onKeydown);
  }

  function onKeydown(e) {
    if (e.key === 'Escape') close();
  }
  document.addEventListener('keydown', onKeydown);

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
