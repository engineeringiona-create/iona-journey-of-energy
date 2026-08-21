/* Client-side i18n for a static multi-page site: no server, no
   build-time page duplication. Every translatable node carries a
   data-i18n="key" (or data-i18n-placeholder / data-i18n-aria-label)
   attribute; switching language re-fetches that language's JSON
   dictionary and rewrites every tagged node in place. */

import { getSupabase } from './lib/supabaseClient.js';
import { readLocalContent } from './lib/localContent.js';
import { readLocalImages } from './lib/imageContent.js';
import { readLocalBucket } from './lib/adminStore.js';
import { applyAnnouncementBar } from './lib/announcementBar.js';
import { applyHotspots } from './lib/hotspots.js';
import { applyAnnouncementPopup } from './lib/announcements.js';
import { pageIdForPath } from './lib/pages.js';

export const LANGS = [
  { code: 'tr', label: 'Türkçe' },
  { code: 'en', label: 'English' },
  { code: 'de', label: 'Deutsch' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'ru', label: 'Русский' },
  { code: 'hi', label: 'हिन्दी' }
];

const dictCache = {};

/* DB-sourced overrides are untrusted (the admin editor's write path has
   no real auth behind it yet — see src/components/Admin/auth.js), but
   applyDict() renders dict values via innerHTML because two hardcoded
   keys intentionally carry <br> tags. Escaping here keeps that innerHTML
   behavior for the trusted hardcoded JSON while stopping a DB row from
   ever injecting live HTML/script into the page. */
function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* Applies saved image overrides (upload replacement + crop position +
   zoom) from the site_content row's "images" bucket — a sibling of the
   per-lang buckets, not itself lang-keyed, since a photo swap/crop
   applies the same regardless of which language is active. Src values
   go straight to el.src (never innerHTML), so no escaping/injection
   surface here the way applyDict() has for text. */
function applyImageOverrides(images) {
  if (!images) return;
  document.querySelectorAll('[data-img-key]').forEach((el) => {
    const patch = images[el.dataset.imgKey];
    if (!patch) return;
    const isImg = el.tagName === 'IMG';
    if (patch.src) {
      if (isImg) el.src = patch.src;
      else el.style.backgroundImage = `url(${JSON.stringify(patch.src).slice(1, -1)})`;
    }
    if (patch.posX !== undefined && patch.posY !== undefined) {
      if (isImg) el.style.objectPosition = `${patch.posX}% ${patch.posY}%`;
      else el.style.backgroundPosition = `${patch.posX}% ${patch.posY}%`;
    }
    /* .parallax-media elements have their transform driven every scroll
       tick by GSAP (see initParallax() in common.js) — writing a scale()
       here would just get clobbered on the next tick, so skip it. */
    if (patch.scale !== undefined && !el.classList.contains('parallax-media')) {
      el.style.transform = patch.scale !== 1 ? `scale(${patch.scale})` : '';
    }
  });
}

/* Section visibility (Phase 33): content.sections is { [sectionId]: true }
   where the key is the section element's own existing DOM id — every
   <section> on this site already carries one, so no new markup/attribute
   is needed. true means "hidden". */
function applySectionVisibility(sections) {
  if (!sections) return;
  Object.entries(sections).forEach(([id, hidden]) => {
    const el = document.getElementById(id);
    if (el) el.style.display = hidden ? 'none' : '';
  });
}

/* SEO overrides (Phase 33): content.seo = { title, description, ogImage }.
   Injected directly into <head> — title via document.title, the rest via
   upserted <meta> tags (created on the fly since most pages don't ship a
   description/OG meta tag by default). */
function applySeoOverrides(seo) {
  if (!seo) return;
  if (seo.title) document.title = seo.title;
  if (seo.description) upsertMeta('name', 'description', seo.description);
  if (seo.ogImage) upsertMeta('property', 'og:image', seo.ogImage);
  if (seo.title) upsertMeta('property', 'og:title', seo.title);
}

function upsertMeta(attr, key, content) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

/* Live theme palette (Phase 34): three independent knobs — brand (green,
   drives logo/icons/badges/borders), cta (orange, drives buttons/CTA/
   glows), and surface (drives the --border-green section/card tint) — in
   both the light and dark root blocks so the picked colors show up
   regardless of the visitor's theme mode. Only theme.brand/cta/surface
   are honored; a leftover legacy theme.accent (the old single-color
   picker this replaced, which collapsed brand+CTA into one flat color)
   is intentionally ignored so any previously-saved single-color override
   stops applying immediately, reverting to base.css's real dual-tone
   brand colors until a new granular value is picked. */
const THEME_STYLE_ID = 'iona-theme-vars';
function applyThemeOverrides(theme) {
  if (!theme || (!theme.brand && !theme.cta && !theme.surface)) return;
  let style = document.getElementById(THEME_STYLE_ID);
  if (!style) {
    style = document.createElement('style');
    style.id = THEME_STYLE_ID;
    document.head.appendChild(style);
  }
  const rules = [];
  if (theme.cta) rules.push(`--color-accent: ${theme.cta};`, `--brand-orange: ${theme.cta};`);
  if (theme.brand) rules.push(`--brand: ${theme.brand};`);
  if (theme.surface) rules.push(`--border-green: color-mix(in srgb, ${theme.surface} 24%, transparent);`);
  style.textContent = `:root, :root.dark { ${rules.join(' ')} }`;
}

async function fetchContentOverrides(lang) {
  const pageId = pageIdForPath(window.location.pathname);
  const supabase = getSupabase();
  if (!supabase) {
    applyImageOverrides(readLocalImages(pageId));
    applySectionVisibility(readLocalBucket(`sections:${pageId}`));
    applySeoOverrides(readLocalBucket(`seo:${pageId}`));
    const local = readLocalContent(lang);
    if (!local) return null;
    return Object.fromEntries(Object.entries(local).map(([key, value]) => [key, escapeHtml(value)]));
  }
  if (!pageId) return null;
  try {
    const { data, error } = await supabase.from('site_content').select('*').eq('id', pageId).maybeSingle();
    if (error || !data || !data.content) return null;
    applyImageOverrides(data.content.images);
    applySectionVisibility(data.content.sections);
    applySeoOverrides(data.content.seo);
    if (!data.content[lang]) return null;
    return Object.fromEntries(
      Object.entries(data.content[lang]).map(([key, value]) => [key, escapeHtml(value)])
    );
  } catch (e) {
    return null;
  }
}

/* Global (non-page-scoped) admin buckets: theme accent, top announcement
   bar, 3D hotspots, and the announcements popup carousel all live in
   their own site_content rows (id "theme" / "announcement" /
   "hotspots" / "announcements") since they apply site-wide (or are only
   ever relevant on one specific page, but still not part of that
   page's own text/image/seo content), not per the currently-open
   page's row. Fire-and-forget from initI18n() — a slow/failed fetch
   just means no override shows up, never blocks the rest of the page. */
async function applyGlobalOverrides() {
  const pageId = pageIdForPath(window.location.pathname);
  const supabase = getSupabase();
  if (!supabase) {
    applyThemeOverrides(readLocalBucket('theme'));
    applyAnnouncementBar(readLocalBucket('announcement'));
    if (pageId === 'teknoloji') applyHotspots(readLocalBucket('hotspots')?.list);
    applyAnnouncementPopup(readLocalBucket('announcements')?.list, pageId);
    return;
  }
  try {
    const { data, error } = await supabase
      .from('site_content')
      .select('id,content')
      .in('id', ['theme', 'announcement', 'hotspots', 'announcements']);
    if (error || !data) return;
    applyThemeOverrides(data.find((r) => r.id === 'theme')?.content);
    applyAnnouncementBar(data.find((r) => r.id === 'announcement')?.content);
    if (pageId === 'teknoloji') applyHotspots(data.find((r) => r.id === 'hotspots')?.content?.list);
    applyAnnouncementPopup(data.find((r) => r.id === 'announcements')?.content?.list, pageId);
  } catch (e) {
    /* no theme/banner/hotspot/popup override, page still works fine */
  }
}

/* Lightweight analytics (Phase 34): one best-effort row per page load.
   No visitor identity, just path + timestamp. Never awaited by its
   caller and always caught, so a network failure here can never delay
   or break the page it's trying to measure. */
async function trackPageView() {
  try {
    const supabase = getSupabase();
    if (!supabase) return;
    const { error } = await supabase.from('page_views').insert({ page_path: window.location.pathname });
    if (error) console.warn('[IONA] page_views kaydı başarısız:', error.message);
  } catch (e) {
    /* analytics is best-effort only */
  }
}

function loadDict(lang) {
  if (dictCache[lang]) return dictCache[lang];
  const loaders = {
    tr: () => import('./i18n/tr.json'),
    en: () => import('./i18n/en.json'),
    de: () => import('./i18n/de.json'),
    es: () => import('./i18n/es.json'),
    fr: () => import('./i18n/fr.json'),
    ru: () => import('./i18n/ru.json'),
    hi: () => import('./i18n/hi.json')
  };
  const p = (loaders[lang] || loaders.tr)()
    .then((m) => m.default || m)
    .then(async (base) => {
      const overrides = await fetchContentOverrides(lang);
      return overrides ? { ...base, ...overrides } : base;
    });
  dictCache[lang] = p;
  return p;
}

export function currentLang() {
  try {
    const saved = localStorage.getItem('iona-lang');
    if (saved && LANGS.some((l) => l.code === saved)) return saved;
  } catch (e) { /* private mode etc. */ }
  return 'tr';
}

function applyDict(dict) {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const val = dict[el.getAttribute('data-i18n')];
    if (val !== undefined) el.innerHTML = val;
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    const val = dict[el.getAttribute('data-i18n-placeholder')];
    if (val !== undefined) el.setAttribute('placeholder', val);
  });
  document.querySelectorAll('[data-i18n-aria-label]').forEach((el) => {
    const val = dict[el.getAttribute('data-i18n-aria-label')];
    if (val !== undefined) el.setAttribute('aria-label', val);
  });
}

/* Runs once per page load: applies the saved (or default 'tr')
   language, and stores the active dictionary on window so page
   scripts with dynamic text (e.g. the home hero slider) can read
   translated strings by key without an extra fetch. */
export async function initI18n() {
  const lang = currentLang();
  document.documentElement.lang = lang;
  const dict = await loadDict(lang);
  window.__ionaLang = lang;
  window.__ionaDict = dict;
  applyDict(dict);
  applyGlobalOverrides();
  trackPageView();
  document.dispatchEvent(new CustomEvent('i18nready', { detail: { lang, dict } }));
  return dict;
}

async function setLang(lang) {
  if (!LANGS.some((l) => l.code === lang)) return;
  try { localStorage.setItem('iona-lang', lang); } catch (e) { /* private mode etc. */ }
  document.documentElement.lang = lang;
  const dict = await loadDict(lang);
  window.__ionaLang = lang;
  window.__ionaDict = dict;
  applyDict(dict);
  document.dispatchEvent(new CustomEvent('i18nchange', { detail: { lang, dict } }));
}

/* Wires the nav's language dropdown (button + panel of data-lang
   buttons — see the nav markup in every page). */
export function initLangSwitcher() {
  const toggle = document.getElementById('lang-toggle');
  const panel = document.getElementById('lang-panel');
  const currentLabel = document.getElementById('lang-current');
  if (!toggle || !panel) return;

  const sync = () => { if (currentLabel) currentLabel.textContent = currentLang().toUpperCase(); };
  sync();

  function open() { panel.classList.remove('hidden'); }
  function close() { panel.classList.add('hidden'); }

  toggle.addEventListener('click', () => {
    panel.classList.contains('hidden') ? open() : close();
  });
  panel.querySelectorAll('[data-lang]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setLang(btn.getAttribute('data-lang'));
      sync();
      close();
    });
  });
  document.addEventListener('click', (e) => {
    if (!panel.contains(e.target) && !toggle.contains(e.target)) close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });
}
