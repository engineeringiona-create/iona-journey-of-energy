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

/* Live theme accent (Phase 33): a single injected <style> overriding
   --color-accent plus the two CSS vars that actually drive buttons/CTAs/
   glows across the site (--brand, --brand-orange — see DESIGN.md), in
   both the light and dark root blocks, so the picked color shows up
   regardless of the visitor's theme mode. */
const THEME_STYLE_ID = 'iona-theme-vars';
function applyThemeOverrides(theme) {
  if (!theme || !theme.accent) return;
  let style = document.getElementById(THEME_STYLE_ID);
  if (!style) {
    style = document.createElement('style');
    style.id = THEME_STYLE_ID;
    document.head.appendChild(style);
  }
  style.textContent = `:root, :root.dark { --color-accent: ${theme.accent}; --brand: ${theme.accent}; --brand-orange: ${theme.accent}; }`;
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

/* Global (non-page-scoped) admin buckets: theme accent + announcement
   bar live in their own site_content rows (id "theme" / "announcement")
   since they apply site-wide, not per page. Fire-and-forget from
   initI18n() — a slow/failed fetch just means no theme/banner override
   shows up, never blocks the rest of the page. */
async function applyGlobalOverrides() {
  const supabase = getSupabase();
  if (!supabase) {
    applyThemeOverrides(readLocalBucket('theme'));
    applyAnnouncementBar(readLocalBucket('announcement'));
    return;
  }
  try {
    const { data, error } = await supabase.from('site_content').select('id,content').in('id', ['theme', 'announcement']);
    if (error || !data) return;
    applyThemeOverrides(data.find((r) => r.id === 'theme')?.content);
    applyAnnouncementBar(data.find((r) => r.id === 'announcement')?.content);
  } catch (e) {
    /* no theme/banner override, page still works fine */
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
