import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);

const reduceMotion = typeof matchMedia === 'function'
  && matchMedia('(prefers-reduced-motion: reduce)').matches;

let lenis = null;

/* Buttery momentum scrolling for the whole document (Phase 43). Lenis
   smooths the real window scroll (no wrapper/virtual-scroll div), so
   every existing ScrollTrigger keeps reading document.scrollingElement
   as before — it just needs telling to re-check on each Lenis tick
   rather than only on native 'scroll' events. Driven off gsap.ticker
   (not Lenis's own internal rAF) so it shares one single rAF loop with
   every GSAP tween/ScrollTrigger already running on the page instead
   of racing a second one; lagSmoothing(0) stops GSAP from trying to
   "catch up" after a dropped/backgrounded tab, which would otherwise
   fight Lenis's own smoothing with a sudden jump.
   Skipped entirely under prefers-reduced-motion, same as every other
   motion helper here — native instant scroll stays native. */
export function initSmoothScroll() {
  if (reduceMotion || lenis) return lenis;

  /* lerp-driven (not duration/easing) on purpose: Lenis checks
     `if (duration && easing) ... else if (lerp)` internally, so setting
     both would silently make duration win and lerp do nothing — the
     opposite of "max momentum, minimal drag" a fixed-duration tween
     doesn't give you (every scroll takes exactly `duration` regardless
     of how fast/slow the input was). lerp is frame-rate-independent
     exponential smoothing instead: 0.08 closes ~8% of the remaining
     distance per frame, snappy and responsive rather than syrupy.
     duration/easing are still exactly right for the one-off scrollTo()
     anchor jumps below, just not for continuous wheel/touch scrolling. */
  lenis = new Lenis({
    lerp: 0.08,
    smoothWheel: true,
    syncTouch: true,
    touchMultiplier: 1.8,
    infinite: false
  });

  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  /* Same-page hash links (nav anchors, "#contact-form" etc.) jump via
     the native browser hash-scroll otherwise, which bypasses Lenis
     entirely and reads as a jarring snap against the smooth scroll
     everywhere else. href values here come from hand-authored markup,
     not user input, but "#" alone (used all over as a plain button
     href) and stray non-CSS-safe fragments still need guarding. */
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (e) => {
      const hash = link.getAttribute('href');
      if (!hash || hash === '#') return;
      let target;
      try {
        target = document.querySelector(hash);
      } catch (err) {
        return;
      }
      if (!target) return;
      e.preventDefault();
      lenis.scrollTo(target, { duration: 1.2, easing: (t) => 1 - Math.pow(1 - t, 3) });
    });
  });

  return lenis;
}

export function getLenis() {
  return lenis;
}

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
   preference) — this just wires the switch(es) in the nav to flip it,
   persist the choice, and broadcast a 'themechange' event on
   `document` so any page running a Three.js scene can re-light it.

   Was a single #theme-toggle/#theme-toggle-icon ID pair — the desktop
   nav's own switch. The mobile nav had no toggle at all (client
   reported "no dark/light mode option" — true on mobile specifically,
   since the only switch lived in the desktop-only nav bar, hidden
   below the md breakpoint). Now queries every .theme-toggle button on
   the page (desktop nav's + the new one in #mobile-nav-panel) so both
   flip together and stay in sync, whichever one gets tapped. */
export function initThemeToggle() {
  const toggles = document.querySelectorAll('.theme-toggle');
  if (!toggles.length) return;

  const root = document.documentElement;

  const sync = () => {
    const dark = root.classList.contains('dark');
    toggles.forEach((toggle) => {
      toggle.setAttribute('aria-checked', String(dark));
      const icon = toggle.querySelector('.theme-toggle-icon');
      if (icon) icon.textContent = dark ? 'dark_mode' : 'light_mode';
    });
  };
  sync();

  toggles.forEach((toggle) => {
    toggle.addEventListener('click', () => {
      const dark = root.classList.toggle('dark');
      try { localStorage.setItem('iona-theme', dark ? 'dark' : 'light'); } catch (e) { /* private mode etc. */ }
      sync();
      document.dispatchEvent(new CustomEvent('themechange', { detail: { dark } }));
    });
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

/* Phase 89: the ONE nav overlay now (logo + MENU trigger opens this
   fullscreen panel at every breakpoint) — was mobile-only, with a
   separate always-on desktop nav carrying its own inline search/lang/
   links cluster; that bar is gone, folded into this panel instead (see
   index.html and its 6 sibling pages). Kept the export name and the
   toggle/panel/icon element IDs unchanged from the old mobile-only
   version so every page's entry script (which already imports and
   calls initMobileNav) didn't need touching for what's really just a
   styling + scope change. .is-current highlighting used to be hand-
   written per page (a hardcoded aria-current/class on whichever link
   matched); now computed once here from location.pathname since the
   same markup ships on all 7 pages. */
export function initMobileNav() {
  const toggle = document.getElementById('mobile-nav-toggle');
  const panel = document.getElementById('mobile-nav-panel');
  const icon = document.getElementById('mobile-nav-icon');
  if (!toggle || !panel) return;

  const here = window.location.pathname.replace(/index\.html$/, '') || '/';
  panel.querySelectorAll('a.mobile-nav-link').forEach((link) => {
    const linkPath = new URL(link.href, window.location.origin).pathname.replace(/index\.html$/, '') || '/';
    if (linkPath === here) {
      link.classList.add('is-current');
      link.setAttribute('aria-current', 'page');
    }
  });

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

/* Phase 91: MPA "curtain" page transition. This is a static multi-page
   site (7 separate HTML documents, no client-side router), so there's
   no shared JS state to animate a transition *through* — instead,
   every page's #iona-curtain (markup: right after <body>, see any
   page) starts in its base CSS state already covering the viewport
   (no flash, no JS needed for that part), and this reveals it shortly
   after load. On a qualifying internal link click, it re-covers the
   viewport and *delays* the real navigation until that animation
   finishes, so the same green cover reads as one continuous curtain
   across the page boundary: it closes over the old page, the browser
   does a normal full navigation while hidden behind it, and the new
   page's own copy of this same function reveals it again on arrival. */
export function initPageCurtain() {
  const curtain = document.getElementById('iona-curtain');
  if (!curtain) return;

  requestAnimationFrame(() => curtain.classList.add('is-revealed'));

  if (reduceMotion) return;

  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0) return;
    const link = e.target.closest('a[href]');
    if (!link || link.target === '_blank' || link.hasAttribute('download')) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

    let url;
    try {
      url = new URL(link.href, window.location.href);
    } catch {
      return;
    }
    if (url.origin !== window.location.origin) return;
    // Same-page anchors (in-page nav, e.g. #contact-form) skip the
    // curtain entirely — it's not a real page change.
    if (url.pathname === window.location.pathname && url.hash) return;

    e.preventDefault();
    curtain.classList.remove('is-revealed');
    window.setTimeout(() => {
      window.location.href = link.href;
    }, 550);
  });
}

/* Phase 91: footer "gradient curve" draw-on. One-shot: disconnects
   itself the moment it fires, since the curve should only ever draw
   once per page view, not re-draw every time the footer scrolls back
   into view. */
export function initFooterCurve() {
  const path = document.querySelector('.footer-curve-path');
  if (!path) return;
  if (reduceMotion) {
    path.classList.add('is-drawn');
    return;
  }
  const target = path.closest('footer') || path;
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        path.classList.add('is-drawn');
        observer.disconnect();
      });
    },
    { threshold: 0.15 }
  );
  observer.observe(target);
}

/* Phase 91: horizontal-scroll exhibition gallery. Desktop/lg+ and
   motion-OK only — adds .is-horizontal (base.css) to switch the track
   from a plain stacked column to a flex row, pins the wrapping section,
   and scrubs the track's x transform to scroll position so panels pan
   left as the visitor scrolls down. Below lg or under reduced-motion,
   this never runs at all: the CSS default (stacked column, natural
   height) stands on its own, so those visitors get an ordinary
   scrolling section instead of a half-configured horizontal one. */
export function initHorizontalGallery(trackId) {
  const track = document.getElementById(trackId);
  if (!track) return;
  if (reduceMotion) return;
  if (!window.matchMedia('(min-width: 1024px)').matches) return;

  const wrap = track.parentElement;
  track.classList.add('is-horizontal');

  gsap.to(track, {
    x: () => -(track.scrollWidth - window.innerWidth),
    ease: 'none',
    scrollTrigger: {
      trigger: wrap,
      start: 'top top',
      end: () => '+=' + (track.scrollWidth - window.innerWidth),
      scrub: 1,
      pin: true,
      invalidateOnRefresh: true
    }
  });
}
