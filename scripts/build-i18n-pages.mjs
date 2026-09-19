/**
 * Build sonrası dil sürümü üretici + hreflang + sitemap yazıcı.
 *
 *     vite build && node scripts/build-i18n-pages.mjs      (npm run build)
 *
 * `dist/*.html` içindeki her `[data-i18n]` düğümünü ilgili dilin sözlüğünden
 * doldurup `dist/<dil>/*.html` olarak yazar. Türkçe kök dizinde kalır — mevcut
 * adresler ve Google'da birikmiş bağlantılar bozulmasın diye.
 *
 * NEDEN BUILD SONRASI, `rollupOptions.input`'a eklenerek DEĞİL:
 * her dil ayrı bir Vite girdisi olsaydı her biri için ayrı bir JS/CSS grafiği
 * kurulur, çıktı yedi katına çıkardı. Üretilen HTML'lerin hepsi zaten aynı
 * `/assets/...` paketlerine işaret ediyor; tek fark gömülü metin ve <head>.
 *
 * EKSİKSİZ ÇEVİRİ KURALI: bir sayfanın bir dildeki sürümü, ancak o sayfadaki
 * HER metnin o dilde karşılığı varsa üretilir. Yarısı Türkçe kalmış bir sayfayı
 * `hreflang="de"` ile yayınlamak, hiç yayınlamamaktan kötüdür: ziyaretçi
 * anlamadığı metinle karşılaşır, Google da sayfayı "beyan ettiği dilde
 * değil" diye değerlendirir. Eksikler aşağıda tek tek raporlanır; sözlüğe
 * çeviri eklendiği anda sayfa da hreflang satırı da kendiliğinden gelir.
 *
 * Sayfa/dil şeması scripts/seo-inject.mjs'te — tek kaynak, iki tüketici.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'node-html-parser';
import {
  PAGES, LANGS, OG_LOCALE, HREFLANG_MARKER,
  pageUrl, hreflangBlock, descriptionFor, titleFor, attr
} from './seo-inject.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

/** Türkçe kökte durur; üretilebilecek olanlar bunlar. */
const TARGET_LANGS = LANGS.filter((l) => l !== 'tr');

/** Dil kopyası ÜRETİLMEYEN yollar: bağlantıları köke işaret etmeye devam
 *  etmeli, yoksa var olmayan /de/duyurular.html'e gidilir. */
const NOT_LOCALIZED = new Set(
  PAGES.filter((p) => !p.i18n)
    .flatMap((p) => [p.path, p.path.replace(/\.html$/, '')])
    .concat(['/admin.html', '/admin'])
);

const dicts = Object.fromEntries(
  LANGS.map((l) => [l, JSON.parse(readFileSync(join(root, 'src/i18n', `${l}.json`), 'utf8'))])
);

/** Sayfanın kullandığı tüm çeviri anahtarları. */
function keysUsedBy(doc) {
  const keys = new Set();
  for (const attrName of ['data-i18n', 'data-i18n-placeholder', 'data-i18n-aria-label']) {
    doc.querySelectorAll(`[${attrName}]`).forEach((el) => keys.add(el.getAttribute(attrName)));
  }
  return keys;
}

/**
 * Kök-göreli site içi bağlantıyı dil önekine taşır — AMA yalnızca hedef sayfa
 * o dilde gerçekten üretildiyse.
 *
 * `existsInLang`, o dilde yayınlanan sayfa yollarının kümesi. Kontrol
 * olmasaydı, Almanca'ya henüz çevrilmemiş bir sayfaya giden menü bağlantısı
 * `/de/teknoloji.html`'i gösterir ve 404 verirdi: ziyaretçi için kırık
 * bağlantı, Googlebot için de dil kümesinin ortasında ölü bir düğüm. Çevirisi
 * olmayan sayfaya bağlantı Türkçe'sinde kalır — anlaşılır olmayabilir, ama
 * çalışır.
 */
function localizeHref(href, lang, existsInLang) {
  if (!href || !href.startsWith('/')) return href;
  if (href.startsWith('//')) return href; // protokolsüz dış bağlantı
  const [pathPart] = href.split(/[#?]/);
  if (NOT_LOCALIZED.has(pathPart)) return href;
  const normalized = pathPart === '/' || pathPart === '/index.html'
    ? '/'
    : pathPart.replace(/\.html$/, '') + '.html';
  if (!existsInLang.has(normalized)) return href;
  return `/${lang}${href === '/' ? '/' : href}`;
}

function setMeta(doc, selector, value) {
  const el = doc.querySelector(selector);
  if (el && value != null) el.setAttribute('content', String(value));
}

/**
 * Sayfayı tek bir dile çevirir.
 * Metin uygulaması src/i18n.js'teki applyDict() ile birebir aynı davranır
 * (innerHTML): sözlükteki bazı anahtarlar kasten <br> taşıyor, kaçırılsaydı
 * ekrana "&lt;br&gt;" basılırdı.
 */
function translate(html, lang, page, hreflang, existsInLang) {
  const doc = parse(html, { comment: true });
  const dict = dicts[lang];

  doc.querySelectorAll('[data-i18n]').forEach((el) => {
    const val = dict[el.getAttribute('data-i18n')];
    if (val !== undefined) el.set_content(String(val));
  });
  doc.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    const val = dict[el.getAttribute('data-i18n-placeholder')];
    if (val !== undefined) el.setAttribute('placeholder', String(val));
  });
  doc.querySelectorAll('[data-i18n-aria-label]').forEach((el) => {
    const val = dict[el.getAttribute('data-i18n-aria-label')];
    if (val !== undefined) el.setAttribute('aria-label', String(val));
  });

  const htmlEl = doc.querySelector('html');
  if (htmlEl) htmlEl.setAttribute('lang', lang);

  /* canonical ve og:url KENDİNİ göstermeli. Bir dil sürümünün canonical'ı
     Türkçe'yi gösterseydi Google o sayfayı bağımsız bir sonuç olarak
     indekslemez, Türkçe'nin kopyası sayardı — yani çeviriler aramada yine
     çıkmazdı. */
  const url = pageUrl(lang, page.path);
  const canonical = doc.querySelector('link[rel="canonical"]');
  if (canonical) canonical.setAttribute('href', url);
  setMeta(doc, 'meta[property="og:url"]', url);
  setMeta(doc, 'meta[property="og:locale"]', OG_LOCALE[lang]);

  /* <title> ve description sözlükte anahtarlı değil (HTML'e elle yazılmışlar),
     ama kaynakları anahtarlı: şema onları seo-inject.mjs'teki PAGES'ten türetir.
     Yanlış dilde bir başlık, arama sonucunda görünen tek satır olduğu için
     pahalıya patlar. */
  const title = titleFor(page, dict);
  if (title) {
    const titleEl = doc.querySelector('title');
    if (titleEl) titleEl.set_content(attr(title));
    setMeta(doc, 'meta[property="og:title"]', title);
    setMeta(doc, 'meta[name="twitter:title"]', title);
  }
  const desc = descriptionFor(page, dict);
  if (desc) {
    setMeta(doc, 'meta[name="description"]', desc);
    setMeta(doc, 'meta[property="og:description"]', desc);
    setMeta(doc, 'meta[name="twitter:description"]', desc);
  }

  /* JSON-LD Organization: kuruluş aynı kuruluş, yalnızca hangi dil sürümünü
     tarif ettiği değişir. */
  const ld = doc.querySelector('script[type="application/ld+json"]');
  if (ld) {
    try {
      const data = JSON.parse(ld.textContent);
      data.url = pageUrl(lang, '/');
      ld.set_content(JSON.stringify(data));
    } catch (e) {
      /* elle bozulmuş JSON-LD build'i düşürmesin */
    }
  }

  /* Site içi bağlantılar dil önekini korumalı: yapılmazsa ziyaretçi ilk
     tıklamada Türkçe'ye düşer, Googlebot da dil sürümlerini birbirine bağlı
     bir küme olarak değil yalıtılmış sayfalar olarak görür. */
  doc.querySelectorAll('a[href]').forEach((a) => {
    const href = a.getAttribute('href');
    const next = localizeHref(href, lang, existsInLang);
    if (next !== href) a.setAttribute('href', next);
  });

  return doc.toString().replace(HREFLANG_MARKER, hreflang);
}

function sitemapXml(published) {
  const lastmod = new Date().toISOString().slice(0, 10);
  const rows = [];
  for (const page of PAGES) {
    const langs = ['tr', ...(published.get(page.file) || [])];
    for (const lang of langs) {
      const url = [
        '  <url>',
        `    <loc>${pageUrl(lang, page.path)}</loc>`,
        `    <lastmod>${lastmod}</lastmod>`
      ];
      if (langs.length > 1) {
        for (const l of langs) {
          url.push(`    <xhtml:link rel="alternate" hreflang="${l}" href="${pageUrl(l, page.path)}"/>`);
        }
        url.push(`    <xhtml:link rel="alternate" hreflang="x-default" href="${pageUrl('tr', page.path)}"/>`);
      }
      url.push('  </url>');
      rows.push(url.join('\n'));
    }
  }
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    '        xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    rows.join('\n'),
    '</urlset>',
    ''
  ].join('\n');
}

/* İKİ GEÇİŞ — birincisi hangi sayfanın hangi dilde yayınlanabileceğini
   belirler, ikincisi yazar. Ayrı olmak zorundalar: bir sayfanın menüsündeki
   bağlantılar ancak hedef sayfanın o dilde üretilip üretilmediği BİLİNİYORSA
   doğru yazılabilir, o bilgi de ancak bütün sayfalar taranınca tamamlanır. */
const published = new Map();
const sources = new Map();
const gaps = [];
let written = 0;

for (const page of PAGES) {
  const src = join(dist, page.file);
  if (!existsSync(src)) throw new Error(`${page.file} dist'te yok — önce vite build çalışmalı`);
  const html = readFileSync(src, 'utf8');
  sources.set(page.file, html);

  if (!page.i18n) {
    published.set(page.file, []);
    continue;
  }

  const keys = keysUsedBy(parse(html));
  const ready = [];
  for (const lang of TARGET_LANGS) {
    const missing = [...keys].filter((k) => dicts[lang][k] === undefined);
    if (missing.length) gaps.push({ lang, file: page.file, missing });
    else ready.push(lang);
  }
  published.set(page.file, ready);
}

/** Dil -> o dilde yayınlanan sayfa yolları. */
const existsByLang = Object.fromEntries(
  TARGET_LANGS.map((lang) => [
    lang,
    new Set(
      PAGES.filter((p) => (published.get(p.file) || []).includes(lang))
        .map((p) => (p.path === '/' ? '/' : p.path))
    )
  ])
);

for (const page of PAGES) {
  const html = sources.get(page.file);
  const ready = published.get(page.file) || [];
  if (!page.i18n) continue;

  const hreflang = hreflangBlock(page, ready);

  /* Türkçe sürümün kendi hreflang bloğu da buradan gelir: işaret yerinde
     kalırsa yayına çıkan HTML'de görünür bir yorum artığı olur. */
  writeFileSync(join(dist, page.file), html.replace(HREFLANG_MARKER, hreflang));

  for (const lang of ready) {
    const dir = join(dist, lang);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, page.file), translate(html, lang, page, hreflang, existsByLang[lang]));
    written++;
  }
}

writeFileSync(join(dist, 'sitemap.xml'), sitemapXml(published));

const sitemapCount = PAGES.reduce((n, p) => n + 1 + (published.get(p.file) || []).length, 0);
console.log(`i18n: ${written} dil sayfası üretildi, sitemap.xml ${sitemapCount} adresle yazıldı`);
for (const page of PAGES) {
  const ready = published.get(page.file) || [];
  console.log(`  ${page.file.padEnd(18)} tr${ready.length ? ' + ' + ready.join(', ') : page.i18n ? '  (dil sürümü yok)' : '  (tek dilli sayfa)'}`);
}

if (gaps.length) {
  console.warn('\nEKSİK ÇEVİRİ — bu sayfalar o dilde YAYINLANMADI:');
  for (const g of gaps) {
    console.warn(`  ${g.lang}/${g.file}: ${g.missing.length} anahtar eksik`);
    console.warn(`    ${g.missing.join(', ')}`);
  }
  console.warn('\nsrc/i18n/<dil>.json dosyalarına bu anahtarlar eklendiğinde sayfa kendiliğinden yayına girer.');
}
