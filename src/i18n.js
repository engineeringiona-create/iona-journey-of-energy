/* Client-side i18n for a static multi-page site: no server, no
   build-time page duplication. Every translatable node carries a
   data-i18n="key" (or data-i18n-placeholder / data-i18n-aria-label)
   attribute; switching language re-fetches that language's JSON
   dictionary and rewrites every tagged node in place. */

import { getSupabase } from './lib/supabaseClient.js';
import { readLocalContent } from './lib/localContent.js';
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

async function fetchContentOverrides(lang) {
  const pageId = pageIdForPath(window.location.pathname);
  const supabase = getSupabase();
  if (!supabase) {
    const local = readLocalContent(lang);
    if (!local) return null;
    return Object.fromEntries(Object.entries(local).map(([key, value]) => [key, escapeHtml(value)]));
  }
  if (!pageId) return null;
  try {
    const { data, error } = await supabase.from('site_content').select('*').eq('id', pageId).maybeSingle();
    if (error || !data || !data.content || !data.content[lang]) return null;
    return Object.fromEntries(
      Object.entries(data.content[lang]).map(([key, value]) => [key, escapeHtml(value)])
    );
  } catch (e) {
    return null;
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
