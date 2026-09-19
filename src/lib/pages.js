/* Single source of truth for the site's pages: shared by src/i18n.js
   (to pick the right site_content row for the page the browser is on)
   and the admin LiveEditor (page selector + save target), so the two
   can never drift apart on what "teknoloji" or "/etki.html" means. */
import { stripLang } from './langPath.js';

export const PAGES = [
  { id: 'home', label: 'Anasayfa', path: '/index.html' },
  { id: 'teknoloji', label: 'Teknoloji', path: '/teknoloji.html' },
  { id: 'hakkimizda', label: 'Hakkımızda', path: '/hakkimizda.html' },
  { id: 'etki', label: 'Etki', path: '/etki.html' },
  { id: 'iletisim', label: 'İletişim', path: '/iletisim.html' },
  /* IonaFlux 2026-09-19'a kadar bu listede yoktu: sayfa vardı, navigasyonda
     duruyordu, ama admin editörünün sayfa seçicisinde hiç görünmüyordu ve
     pageIdForPath('/ionaflux.html') null döndüğü için o sayfada hiçbir içerik
     override'ı uygulanmıyordu. site_content.id serbest metin (şemada CHECK
     yok), yeni id eklemek için tek gereken buraya yazmak. */
  { id: 'ionaflux', label: 'IonaFlux', path: '/ionaflux.html' },
  { id: 'duyurular', label: 'Duyurular', path: '/duyurular.html' }
];

export function pageIdForPath(pathname) {
  /* Dil önekini burada ayıklıyoruz: '/en/teknoloji.html' de '/teknoloji.html'
     ile aynı site_content satırını kullanır (içerik dile göre satır içinde
     bucket'lara ayrılıyor, satırın kendisine göre değil). Ayıklamazsak dil
     sürümlerinde pageId null kalır ve admin panelinden girilen içerik
     override'ları o sayfalarda sessizce uygulanmaz. */
  const withoutLang = stripLang(pathname);
  const clean = withoutLang === '/' ? '/index.html' : withoutLang;
  const found = PAGES.find((p) => p.path === clean);
  return found ? found.id : null;
}
