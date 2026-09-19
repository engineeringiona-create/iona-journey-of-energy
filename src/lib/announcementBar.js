import { localizePath } from './langPath.js';
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
  /* DESIGN.md'nin `label-caps` basamağı (12px / 700 / 0.1em). Burada Tailwind
     yardımcı sınıfı kullanılamıyor — çubuk JS'ten inline stille kuruluyor — o
     yüzden değerler elle yazılı; rampa değişirse burası da değişmeli.
     Öncesinde rampa dışı 13px'ti: kısa, kalın, ortalanmış bir bildirim şeridi
     tam da bu etiket register'ı, prose değil. */
  bar.style.fontSize = '12px';
  bar.style.fontWeight = '700';
  bar.style.letterSpacing = '0.1em';
  bar.style.padding = '8px 16px';

  bar.innerHTML = '';
  if (cfg.link) {
    const a = document.createElement('a');
    /* Kök-göreli bağlantı, ziyaretçinin bulunduğu dile çevrilir; tam URL
       ve mailto:/tel: olduğu gibi geçer (bkz. localizePath). */
    a.href = localizePath(cfg.link);
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
