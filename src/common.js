import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/* Shared across every page: reveals .fade-in-element children as their
   containing .fade-in-section scrolls into view. */
export function initFadeIn() {
  const fadeSections = document.querySelectorAll('.fade-in-section');
  const fadeObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.querySelectorAll('.fade-in-element').forEach((el) => el.classList.add('is-visible'));
    });
  }, { root: null, rootMargin: '0px', threshold: 0.15 });

  fadeSections.forEach((section) => fadeObserver.observe(section));
}

/* Light/dark toggle. The initial .dark class is already applied by an
   inline head script (before first paint, using localStorage or the OS
   preference) — this just wires the switch in the nav to flip it,
   persist the choice, and broadcast a 'themechange' event on
   `document` so any page running a Three.js scene can re-light it. */
export function initThemeToggle() {
  const toggle = document.getElementById('theme-toggle');
  if (!toggle) return;

  const icon = document.getElementById('theme-toggle-icon');
  const root = document.documentElement;

  const sync = () => {
    const dark = root.classList.contains('dark');
    toggle.setAttribute('aria-checked', String(dark));
    if (icon) icon.textContent = dark ? 'dark_mode' : 'light_mode';
  };
  sync();

  toggle.addEventListener('click', () => {
    const dark = root.classList.toggle('dark');
    try { localStorage.setItem('iona-theme', dark ? 'dark' : 'light'); } catch (e) { /* private mode etc. */ }
    sync();
    document.dispatchEvent(new CustomEvent('themechange', { detail: { dark } }));
  });
}

/* Nav search: a small curated index (not a live DOM crawl) covering
   the 6 pages plus a few deep-linked sections, filtered by substring
   match as the visitor types. Toggled by the search icon in the nav. */
const SEARCH_INDEX = [
  { label: 'Anasayfa', href: '/', keywords: 'ana sayfa home giriş' },
  { label: 'Hakkımızda', href: '/hakkimizda.html', keywords: 'about biz kimiz tarihçe felsefe yalın mühendislik' },
  { label: 'Misyon, Vizyon ve Değerlerimiz', href: '/hakkimizda.html#statements', keywords: 'mission vision misyon vizyon değer sürdürülebilirlik' },
  { label: 'Neden Iona', href: '/hakkimizda.html#why-us', keywords: 'akıllı teknoloji maliyet tasarrufu kesintisiz destek' },
  { label: 'Hizmetler', href: '/teknoloji.html', keywords: 'services teknoloji çözümler kataloğu' },
  { label: 'Twin Karıştırıcı Teknolojisi', href: '/teknoloji.html#expo-agitator', keywords: 'agitator karıştırma karıştırıcı ajitasyon' },
  { label: 'Güç Üretimi', href: '/teknoloji.html#expo-genset', keywords: 'jeneratör enerji güç genset' },
  { label: 'Mono Pompa Teknolojisi', href: '/teknoloji.html#expo-pump', keywords: 'pompa istasyonu cps' },
  { label: 'Mühendislik İş Akışı', href: '/teknoloji.html#workflow', keywords: 'adım fizibilite tasarım inşaat destek workflow' },
  { label: 'Sektörler', href: '/etki.html', keywords: 'industries endüstri belediye tarım hayvancılık' },
  { label: 'Teknoloji ve Tedarik Ortaklarımız', href: '/etki.html#partners', keywords: 'ortaklar partners tedarikçi' },
  { label: 'IonaFlux', href: '/ionaflux.html', keywords: 'ionaflux uygulama app scada dijital ikiz digital twin arıza qr izleme monitoring' },
  { label: 'Canlı İzleme', href: '/ionaflux.html#flux-live', keywords: 'scada canlı izleme plc alarm' },
  { label: 'QR ile Tanı', href: '/ionaflux.html#flux-qr', keywords: 'qr kod makine tanı arıza diagnostic' },
  { label: 'IonaFlux Tanıtım Videosu', href: '/ionaflux.html#flux-video', keywords: 'video demo tanıtım izle' },
  { label: 'İletişim', href: '/iletisim.html', keywords: 'contact adres telefon email bize ulaşın' }
];

export function initSiteSearch() {
  const toggle = document.getElementById('nav-search-toggle');
  const panel = document.getElementById('nav-search-panel');
  const input = document.getElementById('nav-search-input');
  const results = document.getElementById('nav-search-results');
  if (!toggle || !panel || !input || !results) return;

  function render(query) {
    const q = query.trim().toLowerCase();
    const matches = q
      ? SEARCH_INDEX.filter((it) => (it.label + ' ' + it.keywords).toLowerCase().includes(q))
      : SEARCH_INDEX;
    results.innerHTML = '';
    matches.slice(0, 8).forEach((it) => {
      const a = document.createElement('a');
      a.href = it.href;
      a.textContent = it.label;
      a.className = 'block px-3 py-2 rounded-lg text-[14px] text-[var(--text)] hover:bg-[var(--surface-2)] hover:text-[var(--brand)] transition-colors duration-200';
      results.appendChild(a);
    });
    if (!matches.length) {
      const p = document.createElement('p');
      p.textContent = 'Sonuç bulunamadı.';
      p.className = 'px-3 py-2 text-[13px] text-[var(--text-muted)]';
      results.appendChild(p);
    }
  }

  function open() {
    panel.classList.remove('hidden');
    render('');
    input.value = '';
    input.focus();
  }
  function close() { panel.classList.add('hidden'); }

  toggle.addEventListener('click', () => {
    panel.classList.contains('hidden') ? open() : close();
  });
  input.addEventListener('input', () => render(input.value));
  document.addEventListener('click', (e) => {
    if (!panel.contains(e.target) && !toggle.contains(e.target)) close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });
}

/* Mobile hamburger menu (see the separate #mobile-nav bar +
   #mobile-nav-panel dropdown in each page's markup, shown only below
   the md breakpoint — the desktop nav has its own search/lang/links
   cluster that's simply hidden on mobile, no overlap with this). */
export function initMobileNav() {
  const toggle = document.getElementById('mobile-nav-toggle');
  const panel = document.getElementById('mobile-nav-panel');
  const icon = document.getElementById('mobile-nav-icon');
  if (!toggle || !panel) return;

  function open() {
    panel.classList.add('is-open');
    toggle.setAttribute('aria-expanded', 'true');
    if (icon) icon.textContent = 'close';
  }
  function close() {
    panel.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
    if (icon) icon.textContent = 'menu';
  }

  toggle.addEventListener('click', () => {
    panel.classList.contains('is-open') ? close() : open();
  });
  panel.querySelectorAll('a').forEach((link) => link.addEventListener('click', close));
  document.addEventListener('click', (e) => {
    if (!panel.contains(e.target) && !toggle.contains(e.target)) close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });
  window.matchMedia('(min-width: 768px)').addEventListener('change', (e) => {
    if (e.matches) close();
  });
}

/* Vercel/Linear-style card spotlight: tracks the cursor only while it's
   over a .spotlight-card, writing its *local* position into that card's
   --spot-x/--spot-y (see base.css) so the highlight and its 1px border
   glow stay strictly inside that card's own boundaries. Hover-capable/
   fine-pointer devices only — on touch there's no hover to track, and
   binding pointermove there would just fire during scroll/drag touches.
   The bounding rect is cached on pointerenter (not read every move) to
   avoid forcing a layout on each event. */
export function initCardSpotlight() {
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  document.querySelectorAll('.spotlight-card').forEach((card) => {
    let rect = null;

    card.addEventListener('pointerenter', () => {
      rect = card.getBoundingClientRect();
      card.classList.add('is-hovering');
    });
    card.addEventListener('pointermove', (e) => {
      if (!rect) return;
      card.style.setProperty('--spot-x', `${e.clientX - rect.left}px`);
      card.style.setProperty('--spot-y', `${e.clientY - rect.top}px`);
    });
    card.addEventListener('pointerleave', () => {
      rect = null;
      card.classList.remove('is-hovering');
    });
  });
}

/* Subtle parallax drift for full-bleed images (.parallax-media —
   oversized + absolutely positioned so a vertical shift never reveals
   an edge). Each image's own section scrubs it a few percent as it
   crosses the viewport — restrained on purpose, a hint of depth
   rather than a scroll-jacking effect. */
export function initParallax() {
  document.querySelectorAll('.parallax-media').forEach((el) => {
    const section = el.closest('section') || el.parentElement;
    gsap.to(el, {
      yPercent: 8,
      ease: 'none',
      scrollTrigger: { trigger: section, start: 'top bottom', end: 'bottom top', scrub: 0.6 }
    });
  });
}
