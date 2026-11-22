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
    title: { prefix: 'IONA Engineering | ', key: 'home.hero.slide1_title' },
    desc: { keys: ['home.hero.slide1_sub'], trKeep: true }
  },
  {
    file: 'teknoloji.html',
    path: '/teknoloji.html',
    i18n: true,
    faq: 'services.faq',
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
    file: 'hizmetler/biyogaz-tesisi-tasarimi.html',
    path: '/hizmetler/biyogaz-tesisi-tasarimi.html',
    i18n: true,
    faq: 'svc.biyogaz_tesisi_tasarimi.faq',
    service: { key: 'svc.biyogaz_tesisi_tasarimi', type: 'Biogas plant design' },
    title: { prefix: 'IONA Engineering | ', key: 'svc.biyogaz_tesisi_tasarimi.title' },
    desc: { keys: ['svc.biyogaz_tesisi_tasarimi.lead'] }
  },
  {
    file: 'hizmetler/anahtar-teslim-epc.html',
    path: '/hizmetler/anahtar-teslim-epc.html',
    i18n: true,
    faq: 'svc.anahtar_teslim_epc.faq',
    service: { key: 'svc.anahtar_teslim_epc', type: 'EPC biogas plant construction' },
    title: { prefix: 'IONA Engineering | ', key: 'svc.anahtar_teslim_epc.title' },
    desc: { keys: ['svc.anahtar_teslim_epc.lead'] }
  },
  {
    file: 'hizmetler/tesis-optimizasyonu.html',
    path: '/hizmetler/tesis-optimizasyonu.html',
    i18n: true,
    faq: 'svc.tesis_optimizasyonu.faq',
    service: { key: 'svc.tesis_optimizasyonu', type: 'Biogas plant optimisation and re-engineering' },
    title: { prefix: 'IONA Engineering | ', key: 'svc.tesis_optimizasyonu.title' },
    desc: { keys: ['svc.tesis_optimizasyonu.lead'] }
  },
  {
    file: 'hizmetler/gaz-aritma-biyometan.html',
    path: '/hizmetler/gaz-aritma-biyometan.html',
    i18n: true,
    faq: 'svc.gaz_aritma_biyometan.faq',
    service: { key: 'svc.gaz_aritma_biyometan', type: 'Biogas purification and biomethane upgrading' },
    title: { prefix: 'IONA Engineering | ', key: 'svc.gaz_aritma_biyometan.title' },
    desc: { keys: ['svc.gaz_aritma_biyometan.lead'] }
  },
  {
    file: 'hizmetler/digestat-ayirma.html',
    path: '/hizmetler/digestat-ayirma.html',
    i18n: true,
    faq: 'svc.digestat_ayirma.faq',
    service: { key: 'svc.digestat_ayirma', type: 'Digestate separation and enrichment' },
    title: { prefix: 'IONA Engineering | ', key: 'svc.digestat_ayirma.title' },
    desc: { keys: ['svc.digestat_ayirma.lead'] }
  },
  {
    file: 'hizmetler/kurutma-uniteleri.html',
    path: '/hizmetler/kurutma-uniteleri.html',
    i18n: true,
    faq: 'svc.kurutma_uniteleri.faq',
    service: { key: 'svc.kurutma_uniteleri', type: 'Digestate and sludge drying' },
    title: { prefix: 'IONA Engineering | ', key: 'svc.kurutma_uniteleri.title' },
    desc: { keys: ['svc.kurutma_uniteleri.lead'] }
  },
  {
    file: 'hizmetler/koku-giderme.html',
    path: '/hizmetler/koku-giderme.html',
    i18n: true,
    faq: 'svc.koku_giderme.faq',
    service: { key: 'svc.koku_giderme', type: 'Odour removal' },
    title: { prefix: 'IONA Engineering | ', key: 'svc.koku_giderme.title' },
    desc: { keys: ['svc.koku_giderme.lead'] }
  },
  {
    file: 'hizmetler/substrat-hazirlama.html',
    path: '/hizmetler/substrat-hazirlama.html',
    i18n: true,
    faq: 'svc.substrat_hazirlama.faq',
    service: { key: 'svc.substrat_hazirlama', type: 'Lignocellulosic feedstock pre-treatment' },
    title: { prefix: 'IONA Engineering | ', key: 'svc.substrat_hazirlama.title' },
    desc: { keys: ['svc.substrat_hazirlama.lead'] }
  },
  {
    file: 'hizmetler/mikro-orc.html',
    path: '/hizmetler/mikro-orc.html',
    i18n: true,
    faq: 'svc.mikro_orc.faq',
    service: { key: 'svc.mikro_orc', type: 'Micro-ORC waste heat to power' },
    title: { prefix: 'IONA Engineering | ', key: 'svc.mikro_orc.title' },
    desc: { keys: ['svc.mikro_orc.lead'] }
  },
  {
    file: 'hizmetler/teknik-danismanlik.html',
    path: '/hizmetler/teknik-danismanlik.html',
    i18n: true,
    faq: 'svc.teknik_danismanlik.faq',
    service: { key: 'svc.teknik_danismanlik', type: 'Biogas feasibility and technical consulting' },
    title: { prefix: 'IONA Engineering | ', key: 'svc.teknik_danismanlik.title' },
    desc: { keys: ['svc.teknik_danismanlik.lead'] }
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
  '@type': ['Organization', 'ProfessionalService'],
  '@id': SITE + '/#organization',
  name: 'İONA Mühendislik',
  legalName: 'İONA Mühendislik Danışmanlık Ticaret Limited Şirketi',
  /* Google'da ve eski sitede (iona-tr.com) geçen bütün adlar: marka araması
     hangisiyle yapılırsa yapılsın bu kayıtla eşleşsin. */
  alternateName: ['IONA', 'IONA Biogas', 'Iona Engineering', 'IONA TR', 'İONA Mühendislik Danışmanlık', 'Iona Biyogaz'],
  url: SITE + '/',
  logo: SITE + '/images/iona-logo.png',
  image: SITE + '/og-image.jpg',
  description:
    'İONA Mühendislik; biyogaz tesisi tasarımı, anahtar teslim (EPC) biyogaz tesisi kurulumu, anaerobik çürütme, gaz arıtma, kurutma ve digestat çözümleri, mevcut tesis optimizasyonu ve teknik danışmanlık sunan Ankara merkezli bir biyogaz mühendislik şirketidir.',
  slogan: 'Organik atığı sürdürülebilir yeşil enerjiye dönüştürüyoruz.',
  telephone: '+90-540-246-4662',
  email: 'hello@iona-tr.com',
  priceRange: '$$$',
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'Ehlibeyt Mah. Ceyhun Atuf Kansu Cd. Başkent Plaza No:106/32-33',
    addressLocality: 'Çankaya',
    addressRegion: 'Ankara',
    postalCode: '06520',
    addressCountry: 'TR'
  },
  areaServed: [
    { '@type': 'Country', name: 'Türkiye' },
    { '@type': 'Country', name: 'India' },
    { '@type': 'Place', name: 'Europe' }
  ],
  knowsAbout: [
    'Biyogaz tesisi', 'Biogas plant', 'Anaerobik çürütme', 'Anaerobic digestion',
    'Biyogaz tesisi tasarımı', 'Anahtar teslim biyogaz tesisi', 'EPC',
    'Kojenerasyon', 'Biyometan', 'Gaz arıtma', 'Digestat', 'Atıktan enerji',
    'Hayvansal gübre biyogaz', 'Tarımsal atık', 'Gıda atığı', 'Yenilenebilir enerji'
  ],
  hasOfferCatalog: {
    '@type': 'OfferCatalog',
    name: 'Biyogaz mühendislik hizmetleri',
    itemListElement: [
      'Biyogaz tesisi tasarımı ve proses mühendisliği',
      'Anahtar teslim (EPC) biyogaz tesisi kurulumu',
      'Mevcut biyogaz tesisi optimizasyonu ve yeniden mühendislik',
      'Gaz arıtma ve biyometan üniteleri',
      'Kurutma üniteleri ve digestat değerlendirme',
      'Koku giderme üniteleri',
      'Fizibilite ve teknik danışmanlık',
      'İşletme ve bakım hizmetleri',
      'Lignoselülozik hammadde hazırlama',
      'Mikro-ORC ile atık ısıdan elektrik'
    ].map((name) => ({ '@type': 'Offer', itemOffered: { '@type': 'Service', name } }))
  },
  contactPoint: {
    '@type': 'ContactPoint',
    telephone: '+90-540-246-4662',
    email: 'hello@iona-tr.com',
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

/**
 * Sayfada görünen SSS'den FAQPage şeması. Yalnızca sayfada gerçekten yazan
 * soru/cevaplar kullanılır (prefix.q1/a1, q2/a2 ...); Google görünmeyen SSS
 * işaretlemesini kural ihlali sayar. Arama motorları ve yapay zekâ asistanları
 * bu blokları doğrudan cevap kaynağı olarak okur.
 */
export function faqJsonLd(prefix, dict) {
  const items = [];
  for (let i = 1; dict[`${prefix}.q${i}`]; i++) {
    const q = stripTags(dict[`${prefix}.q${i}`]);
    const a = stripTags(dict[`${prefix}.a${i}`] || '');
    if (q && a) items.push({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } });
  }
  if (!items.length) return null;
  return { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: items };
}

/**
 * Hizmet sayfaları için Service + BreadcrumbList şeması. Metin sayfada görünen
 * başlık ve giriş cümlesinden gelir; sağlayıcı ana Organization kaydıdır.
 */
export function serviceJsonLd(page, dict, lang = 'tr') {
  const name = stripTags(dict[`${page.service.key}.title`] || '');
  const description = stripTags(dict[`${page.service.key}.lead`] || '');
  const url = pageUrl(lang, page.path);
  const home = pageUrl(lang, '/');
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'Service',
      '@id': url + '#service',
      name,
      description,
      serviceType: page.service.type,
      url,
      provider: { '@id': SITE + '/#organization' },
      areaServed: ORG_JSON_LD.areaServed
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: stripTags(dict['svc.common.home'] || 'Ana sayfa'), item: home },
        { '@type': 'ListItem', position: 2, name: stripTags(dict['svc.common.services'] || 'Hizmetler'), item: pageUrl(lang, '/teknoloji.html') },
        { '@type': 'ListItem', position: 3, name: stripTags(dict[`${page.service.key}.nav`] || name), item: url }
      ]
    }
  ];
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
  out.push('<meta property="og:site_name" content="İONA Mühendislik">');
  out.push(`<meta property="og:locale" content="${OG_LOCALE.tr}">`);
  out.push('<meta name="twitter:card" content="summary_large_image">');
  out.push(`<meta name="twitter:title" content="${attr(title)}">`);
  out.push(`<meta name="twitter:description" content="${attr(desc)}">`);
  out.push(`<meta name="twitter:image" content="${img}">`);
  if (page.i18n) out.push(HREFLANG_MARKER);
  if (page.jsonLd)
    out.push(`<script type="application/ld+json">${JSON.stringify(ORG_JSON_LD)}</script>`);
  if (page.service)
    for (const block of serviceJsonLd(page, trDict))
      out.push(`<script type="application/ld+json">${JSON.stringify(block)}</script>`);
  const faq = page.faq && faqJsonLd(page.faq, trDict);
  if (faq) out.push(`<script type="application/ld+json">${JSON.stringify(faq)}</script>`);
  out.push('<!-- SEO:end -->');
  return out.join('\n');
}

if (fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
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
