/* Dil, artık yalnızca localStorage'da değil ADRESTE de duruyor.
 *
 * Neden: dil seçimi sadece localStorage'da tutulduğu sürece her dilin tek bir
 * adresi vardı (`/teknoloji.html`), dolayısıyla Google yalnızca Türkçe sürümü
 * görüyordu — diğer altı dil arama motorları için görünmezdi. Artık Türkçe kök
 * dizinde, diğer diller `/<kod>/...` altında kendi statik HTML'leriyle yayında
 * (üretici: scripts/build-i18n-pages.mjs).
 *
 * Bu dosya o şemanın tek kaynağı: adresten dil okuma, adresten dil önekini
 * ayıklama ve bir yola dil öneki yazma. Türkçe önek ALMAZ — mevcut adresler
 * (ve Google'da birikmiş bağlantılar) bozulmasın diye.
 */

/** Adreste öneki olan diller. Türkçe kökte durduğu için listede yok. */
export const URL_LANGS = ['en', 'de', 'es', 'fr', 'ru', 'hi'];

export const DEFAULT_LANG = 'tr';

const PREFIX_RE = new RegExp(`^/(${URL_LANGS.join('|')})(?=/|$)`);

/** '/en/teknoloji.html' -> 'en' ; '/teknoloji.html' -> 'tr' */
export function langFromPath(pathname) {
  const match = String(pathname || '/').match(PREFIX_RE);
  return match ? match[1] : DEFAULT_LANG;
}

/** '/en/teknoloji.html' -> '/teknoloji.html' ; '/en' -> '/' */
export function stripLang(pathname) {
  const rest = String(pathname || '/').replace(PREFIX_RE, '');
  return rest === '' ? '/' : rest;
}

/**
 * Kök-göreli bir yolu istenen dile çevirir.
 * localizePath('/teknoloji.html', 'de') -> '/de/teknoloji.html'
 * localizePath('/teknoloji.html', 'tr') -> '/teknoloji.html'
 *
 * Kök-göreli olmayan (tam URL, '#capa', 'mailto:') girdiler olduğu gibi döner —
 * dış bağlantıya dil öneki takmak bağlantıyı bozardı.
 */
export function localizePath(path, lang) {
  const value = String(path == null ? '' : path);
  if (!value.startsWith('/')) return value;

  const target = lang || (typeof location !== 'undefined' ? langFromPath(location.pathname) : DEFAULT_LANG);
  const base = stripLang(value);
  if (target === DEFAULT_LANG) return base;
  return `/${target}${base === '/' ? '/' : base}`;
}

/** Sayfada kalırken dili değiştirmek için: aynı sayfanın hedef dildeki adresi. */
export function samePageInLang(lang, loc) {
  const l = loc || (typeof location !== 'undefined' ? location : { pathname: '/', search: '', hash: '' });
  return localizePath(stripLang(l.pathname), lang) + (l.search || '') + (l.hash || '');
}
