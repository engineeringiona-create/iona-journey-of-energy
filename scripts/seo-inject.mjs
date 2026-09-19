/**
 * Teknik SEO etiketlerini kaynak HTML dosyalarına yazar + sayfa/dil şemasının
 * tek kaynağıdır (scripts/build-i18n-pages.mjs buradan okur).
 *
 *     node scripts/seo-inject.mjs
 *
 * Build zincirinin parçası DEĞİLDİR: etiketleri bir kez kaynak dosyalara yazar,
 * sonuç commit edilir. Tekrar çalıştırmak güvenlidir — yazdığı blok
 * <!-- SEO:start --> ... <!-- SEO:end --> arasında durur ve her koşuda önce
 * silinir, yani etiketler ikizlenmez.
 *
 * Dil sürümlerinin canonical/og:url/başlık/description alanları build sonrası
 * scripts/build-i18n-pages.mjs tarafından yeniden yazılır.
 *
 * Yeni bir üst düzey sayfa: vite.config.js -> rollupOptions.input VE aşağıdaki
 * PAGES listesi. İkisi de gerekli.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const SITE = 'https://ionaengineering.com';

/* Adresteki dil kodları. Türkçe kökte durur (mevcut adresler ve Google'da
   birikmiş bağlantılar bozulmasın diye), diğerleri /<kod>/ altında.
   src/lib/langPath.js'teki URL_LANGS ile aynı küme olmalı — biri değişirse
   diğeri de değişmeli. */
export const LANGS = ['tr', 'en', 'de', 'es', 'fr', 'ru', 'hi'];

export const OG_LOCALE = {
  tr: 'tr_TR', en: 'en_US', de: 'de_DE', es: 'es_ES',
  fr: 'fr_FR', ru: 'ru_RU', hi: 'hi_IN'
};

/**
 * Sayfa şeması.
 *
 *  path       sitedeki gerçek adres; canonical bu biçimde verilir.
 *  i18n       false ise dil kopyası üretilmez ve hreflang yazılmaz. duyurular
 *             için false: sayfanın gövdesinde tek bir [data-i18n] düğümü yok
 *             (metin doğrudan HTML'e yazılmış), yani "Almanca sürüm" Türkçe
 *             metin gösterirdi — hreflang="de" ile yayınlanan Türkçe bir sayfa,
 *             hiç yayınlanmamasından daha kötüdür.
 *  title      dil sürümlerinde başlık `prefix + sözlük[key]` olur. Türkçe
 *             başlıklara DOKUNULMAZ: Google'da indekslenmiş hâlleri onlar.
 *  desc       meta description'ın kaynağı. `keys` sayfanın kendi metninin
 *             i18n anahtarları — yeni cümle yazılmadı, var olan içerik
 *             kullanıldı; böylece açıklama da her dile kendiliğinden çevrilir.
 *             `trKeep: true` ise Türkçe'de sayfada hâlihazırda bulunan
 *             description korunur (elle yazılmış ve iyi), `keys` yalnızca
 *             diğer diller için kullanılır.
 */
export const PAGES = [
  {
    file: 'index.html',
    path: '/',
    i18n: true,
    jsonLd: true,
    title: { prefix: 'IONA | ', key: 'home.hero.slide1_title' },
    desc: { keys: ['home.hero.slide1_sub'], trKeep: true }
  },
  {
    file: 'teknoloji.html',
    path: '/teknoloji.html',
    i18n: true,
    title: { prefix: 'IONA - ', key: 'nav.services' },
    desc: { keys: ['services.intro.title', 'services.intro.body1'] }
  },
  {
    file: 'hakkimizda.html',
    path: '/hakkimizda.html',
    i18n: true,
    title: { prefix: 'IONA - ', key: 'nav.about' },
    desc: { keys: ['about.hero.body'] }
  },
  {
    file: 'etki.html',
    path: '/etki.html',
    i18n: true,
    title: { prefix: 'IONA - ', key: 'nav.industries' },
    desc: { keys: ['industries.hero.body'] }
  },
  {
    file: 'iletisim.html',
    path: '/iletisim.html',
    i18n: true,
    title: { prefix: 'IONA - ', key: 'nav.contact' },
    desc: { keys: ['contact.hero.body'] }
  },
  {
    file: 'ionaflux.html',
    path: '/ionaflux.html',
    i18n: true,
    title: { prefix: 'IONA - ', key: 'nav.ionaflux' },
    desc: { keys: ['flux.hero.body'], trKeep: true }
  },
  {
    file: 'duyurular.html',
    path: '/duyurular.html',
    i18n: false,
    title: null,
    desc: { literal: "IONA'dan en güncel haberler, fuar katılımları ve şirket duyuruları." }
  }
];

/* admin.html kasten listede yok: `noindex, nofollow` kalır, canonical/hreflang
   almaz, dil kopyası üretilmez, sitemap'e girmez. */

export const ORG_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'IONA Biogas',
  alternateName: 'Iona Engineering',
  url: SITE + '/',
  logo: SITE + '/images/iona-logo.png',
  image: SITE + '/og-image.jpg',
  description:
    'Organik atığı sürdürülebilir yeşil enerjiye dönüştüren yüksek verimli biyogaz tesisleri ve mühendislik çözümleri.',
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'Kırkkonaklar Mah. 358. Sok. 13/5',
    addressLocality: 'Çankaya',
    addressRegion: 'Ankara',
    addressCountry: 'TR'
  },
  contactPoint: {
    '@type': 'ContactPoint',
    telephone: '+90-540-246-4662',
    email: 'info@ionaengineering.com',
    contactType: 'sales',
    availableLanguage: ['Turkish', 'English', 'German', 'Spanish', 'French', 'Russian', 'Hindi']
  }
};

const decode = (s) =>
  String(s).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');

export const attr = (s) =>
  decode(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Sözlük değerleri <br> gibi etiket taşıyabiliyor; meta içeriği düz metindir. */
const stripTags = (s) => String(s).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * Description uzunluğunu makul bir sınırda, tercihen cümle sonunda keser.
 * Kelime ortasından kesmek arama sonucunda yarım bir cümle bırakır.
 */
export function trimDescription(text, max = 170) {
  const value = stripTags(text);
  if (value.length <= max) return value;
  const head = value.slice(0, max);
  const sentence = Math.max(head.lastIndexOf('. '), head.lastIndexOf('! '), head.lastIndexOf('? '));
  if (sentence > 80) return head.slice(0, sentence + 1);
  const space = head.lastIndexOf(' ');
  return (space > 0 ? head.slice(0, space) : head) + '…';
}

/** Sayfanın bir dildeki description'ı. dict verilmezse yalnızca literal çalışır. */
export function descriptionFor(page, dict) {
  if (page.desc?.literal) return page.desc.literal;
  const parts = (page.desc?.keys || [])
    .map((k) => (dict ? dict[k] : undefined))
    .filter((v) => typeof v === 'string' && v.trim());
  if (!parts.length) return null;
  return trimDescription(parts.join(' '));
}

/** Sayfanın bir dildeki <title>'ı; şema tanımlamıyorsa null (mevcut korunur). */
export function titleFor(page, dict) {
  if (!page.title || !dict) return null;
  const value = dict[page.title.key];
  if (typeof value !== 'string' || !value.trim()) return null;
  return page.title.prefix + stripTags(value);
}

export function pageUrl(lang, path) {
  if (lang === 'tr') return SITE + path;
  return SITE + '/' + lang + (path === '/' ? '/' : path);
}

/**
 * hreflang bloğunun kaynak HTML'deki yeri. Etiketlerin kendisi BURADA
 * yazılmaz, build sonrası scripts/build-i18n-pages.mjs bu işareti gerçek
 * bloğun yerine koyar.
 *
 * Neden statik değil: hreflang, var olmayan bir adresi göstermemeli. Bir dilin
 * sayfası ancak o sayfadaki her metnin o dilde karşılığı varsa üretiliyor
 * (bkz. build-i18n-pages.mjs, "eksiksiz çeviri" kuralı) — yani hangi dillerin
 * listeleneceği çeviri sözlüklerinin o anki durumuna bağlı. Sözlüğe çeviri
 * eklendiğinde sayfa da hreflang satırı da kendiliğinden gelir; elle
 * güncellenmesi gereken bir liste kalmaz.
 */
export const HREFLANG_MARKER = '<!-- hreflang: build-i18n-pages.mjs dolduruyor -->';

export function hreflangBlock(page, langs) {
  if (!page.i18n || !langs.length) return '';
  const rows = ['tr', ...langs].map(
    (l) => `<link rel="alternate" hreflang="${l}" href="${pageUrl(l, page.path)}">`
  );
  rows.push(`<link rel="alternate" hreflang="x-default" href="${pageUrl('tr', page.path)}">`);
  return rows.join('\n');
}

/** Aynı scriptin ikinci kez çalışmasında etiketlerin ikizlenmemesi için. */
function stripManaged(html) {
  return html.replace(/[ \t]*<!-- SEO:start -->[\s\S]*?<!-- SEO:end -->\n?/g, '');
}

function build(page, html, trDict) {
  const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/);
  if (!titleMatch) throw new Error(`${page.file}: <title> yok`);
  const title = decode(titleMatch[1].trim());

  const existingDesc = html.match(/<meta name="description" content="([^"]*)"/);
  const keepExisting = page.desc?.trKeep && existingDesc;
  const desc = keepExisting ? decode(existingDesc[1]) : descriptionFor(page, trDict);
  if (!desc) throw new Error(`${page.file}: Türkçe meta description üretilemedi`);

  const url = pageUrl('tr', page.path);
  const img = SITE + '/og-image.jpg';

  const out = ['<!-- SEO:start -->'];
  if (!keepExisting && !existingDesc) out.push(`<meta name="description" content="${attr(desc)}">`);
  out.push(`<link rel="canonical" href="${url}">`);
  if (!/property="og:title"/.test(html)) out.push(`<meta property="og:title" content="${attr(title)}">`);
  if (!/property="og:description"/.test(html))
    out.push(`<meta property="og:description" content="${attr(desc)}">`);
  if (!/property="og:type"/.test(html)) out.push('<meta property="og:type" content="website">');
  out.push(`<meta property="og:url" content="${url}">`);
  out.push(`<meta property="og:image" content="${img}">`);
  out.push('<meta property="og:site_name" content="IONA Biogas">');
  out.push(`<meta property="og:locale" content="${OG_LOCALE.tr}">`);
  out.push('<meta name="twitter:card" content="summary_large_image">');
  out.push(`<meta name="twitter:title" content="${attr(title)}">`);
  out.push(`<meta name="twitter:description" content="${attr(desc)}">`);
  out.push(`<meta name="twitter:image" content="${img}">`);
  if (page.i18n) out.push(HREFLANG_MARKER);
  if (page.jsonLd)
    out.push(`<script type="application/ld+json">${JSON.stringify(ORG_JSON_LD)}</script>`);
  out.push('<!-- SEO:end -->');
  return out.join('\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const trDict = JSON.parse(readFileSync(join(root, 'src/i18n/tr.json'), 'utf8'));
  for (const page of PAGES) {
    const file = resolve(root, page.file);
    /* Bir önceki koşunun bıraktığı ayrı etiketleri de topla: blok yorumları
       eklenmeden önce yazılmış olabilirler. */
    let html = stripManaged(readFileSync(file, 'utf8'))
      .replace(/[ \t]*<link rel="canonical"[^>]*>\n?/g, '')
      .replace(/[ \t]*<meta property="og:(url|image|site_name|locale)"[^>]*>\n?/g, '')
      .replace(/[ \t]*<meta name="twitter:[^"]*"[^>]*>\n?/g, '')
      .replace(/[ \t]*<link rel="alternate" hreflang="[^"]*"[^>]*>\n?/g, '')
      .replace(/[ \t]*<script type="application\/ld\+json">[\s\S]*?<\/script>\n?/g, '');
    const block = build(page, html, trDict);
    html = html.replace(/(<\/title>)/, `$1\n${block}`);
    writeFileSync(file, html);
    console.log(`  ${page.file} -> SEO bloğu yazıldı${page.i18n ? '' : ' (hreflang yok: tek dilli sayfa)'}`);
  }
  console.log('Bitti. admin.html kasten atlandı (noindex).');
}
