/* Single source of truth for the site's pages: shared by src/i18n.js
   (to pick the right site_content row for the page the browser is on)
   and the admin LiveEditor (page selector + save target), so the two
   can never drift apart on what "teknoloji" or "/etki.html" means. */
export const PAGES = [
  { id: 'home', label: 'Anasayfa', path: '/index.html' },
  { id: 'teknoloji', label: 'Teknoloji', path: '/teknoloji.html' },
  { id: 'hakkimizda', label: 'Hakkımızda', path: '/hakkimizda.html' },
  { id: 'etki', label: 'Etki', path: '/etki.html' },
  { id: 'iletisim', label: 'İletişim', path: '/iletisim.html' },
  { id: 'duyurular', label: 'Duyurular', path: '/duyurular.html' }
];

export function pageIdForPath(pathname) {
  const clean = pathname === '/' ? '/index.html' : pathname;
  const found = PAGES.find((p) => p.path === clean);
  return found ? found.id : null;
}
