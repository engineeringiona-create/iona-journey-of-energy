const BAR_ID = 'iona-announcement-bar';

/* Every page's nav is position:fixed;top:0 and rendered as a translucent
   glass-blur overlay on top of hero content (not pushing content down),
   so the announcement bar reuses that same pattern: fixed at the true
   top, and it shifts the nav down by its own height rather than adding
   body padding (body padding wouldn't move a fixed-position nav at all). */
export function applyAnnouncementBar(cfg) {
  const existing = document.getElementById(BAR_ID);

  if (!cfg || !cfg.enabled || !cfg.text) {
    existing?.remove();
    setNavOffset(0);
    return;
  }

  const bar = existing || document.createElement('div');
  bar.id = BAR_ID;
  bar.style.position = 'fixed';
  bar.style.top = '0';
  bar.style.left = '0';
  bar.style.right = '0';
  bar.style.zIndex = '60';
  bar.style.background = cfg.bgColor || '#22703c';
  bar.style.color = '#ffffff';
  bar.style.textAlign = 'center';
  bar.style.fontSize = '13px';
  bar.style.fontWeight = '700';
  bar.style.padding = '8px 16px';

  bar.innerHTML = '';
  if (cfg.link) {
    const a = document.createElement('a');
    a.href = cfg.link;
    a.textContent = cfg.text;
    a.style.color = 'inherit';
    a.style.textDecoration = 'underline';
    bar.appendChild(a);
  } else {
    bar.textContent = cfg.text;
  }

  if (!existing) document.body.prepend(bar);
  setNavOffset(bar.offsetHeight);
}

function setNavOffset(px) {
  ['top-nav', 'mobile-nav'].forEach((id) => {
    const nav = document.getElementById(id);
    if (nav) nav.style.top = px ? `${px}px` : '';
  });
}
