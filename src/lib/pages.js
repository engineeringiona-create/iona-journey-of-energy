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
  { id: 'duyurular', label: 'Duyurular', path: '/duyurular.html' },
  /* Hizmet sayfaları 2026-11-22'ye kadar burada yoktu: IonaFlux'taki hatanın
     aynısı — sayfa vardı ama editörün sayfa seçicisinde görünmüyor, admin'den
     girilen içerik o sayfalarda hiç uygulanmıyordu. Yeni hizmet sayfası
     eklenirse buraya da yazılmalı (tests/pages.test.mjs bunu denetler). */
  { id: 'hizmet-biyogaz-tesisi-tasarimi', label: 'Hizmet · Tesis Tasarımı', path: '/hizmetler/biyogaz-tesisi-tasarimi.html' },
  { id: 'hizmet-anahtar-teslim-epc', label: 'Hizmet · Anahtar Teslim (EPC)', path: '/hizmetler/anahtar-teslim-epc.html' },
  { id: 'hizmet-tesis-optimizasyonu', label: 'Hizmet · Tesis Optimizasyonu', path: '/hizmetler/tesis-optimizasyonu.html' },
  { id: 'hizmet-gaz-aritma-biyometan', label: 'Hizmet · Gaz Arıtma & Biyometan', path: '/hizmetler/gaz-aritma-biyometan.html' },
  { id: 'hizmet-digestat-ayirma', label: 'Hizmet · Digestat Ayırma', path: '/hizmetler/digestat-ayirma.html' },
  { id: 'hizmet-kurutma-uniteleri', label: 'Hizmet · Kurutma Üniteleri', path: '/hizmetler/kurutma-uniteleri.html' },
  { id: 'hizmet-koku-giderme', label: 'Hizmet · Koku Giderme', path: '/hizmetler/koku-giderme.html' },
  { id: 'hizmet-substrat-hazirlama', label: 'Hizmet · Substrat Hazırlama', path: '/hizmetler/substrat-hazirlama.html' },
  { id: 'hizmet-mikro-orc', label: 'Hizmet · Mikro-ORC', path: '/hizmetler/mikro-orc.html' },
  { id: 'hizmet-teknik-danismanlik', label: 'Hizmet · Teknik Danışmanlık', path: '/hizmetler/teknik-danismanlik.html' }
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

/* Her sayfada aynı olan bilgiler (e-posta, telefon, adres, şirket rakamları)
   sayfa satırına değil, tek bir ortak satıra yazılır. Aksi halde telefon
   numarasını değiştirmek için editörde 17 sayfayı tek tek açmak gerekirdi ve
   biri unutulunca sitede iki farklı numara dolaşırdı. Anahtarın `site.` ile
   başlaması kuralı tek başına yeter: hem kayıt (LiveEditor) hem okuma
   (i18n.js) bu iki ismi buradan alır. Okurken sayfa satırı ortak satırın
   ÜSTÜNE yazılır, yani eskiden sayfaya özel girilmiş bir değer varsa o kazanır. */
export const SHARED_ROW_ID = 'site';
export const isSharedKey = (key) => typeof key === 'string' && key.startsWith('site.');
