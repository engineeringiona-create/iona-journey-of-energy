/**
 * Yayındaki sitenin SEO iskeletini doğrular.
 *
 *     node scripts/verify-seo.mjs [taban-adres]
 *     node scripts/verify-seo.mjs http://localhost:4599     (build sonrası yerelde)
 *
 * sitemap.xml'i okur, içindeki her adresi çeker ve üç şeyi sınar:
 *
 *  1. Her adres 200 dönüyor mu (yönlendirme de hata sayılır — sitemap'te
 *     yönlendirilen adres olmamalı).
 *  2. canonical KENDİNİ gösteriyor mu. Bir dil sürümünün canonical'ı başka
 *     bir dili gösterirse Google o sayfayı bağımsız sonuç olarak indekslemez,
 *     kopya sayar; yani çeviriler aramada hiç çıkmaz.
 *  3. hreflang KARŞILIKLI mı. A sayfası B'yi gösterip B, A'yı göstermezse
 *     Google kümenin TAMAMINI yok sayar — hata vermeden, sessizce. Bu yüzden
 *     hreflang elle yazılmıyor (bkz. scripts/build-i18n-pages.mjs); bu script
 *     de o üretimin gerçekten tutarlı çıktığını doğruluyor.
 *
 * Ek olarak <html lang> ile sayfanın kendi hreflang kodu karşılaştırılır.
 * Sorun bulursa çıkış kodu 1 olur.
 */
const base = (process.argv[2] ?? 'https://ionaengineering.com').replace(/\/$/, '');

const sitemapUrl = `${base}/sitemap.xml`;
const res = await fetch(sitemapUrl);
if (!res.ok) {
  console.error(`${sitemapUrl} -> HTTP ${res.status}`);
  process.exit(1);
}
const locs = [...(await res.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
if (!locs.length) {
  console.error('sitemap boş');
  process.exit(1);
}

/* canonical ve hreflang HER ZAMAN üretim adresini taşır — yerelde servis
   edilirken bile, çünkü yayına çıkacak olan dosya bu. Bu yüzden karşılaştırma
   üretim adresleri üzerinden yapılıyor; yalnızca İNDİRME adresi test edilen
   tabana çevriliyor. İkisini karıştırmak, yerelde her sayfayı hatalı gösterir. */
const LIVE = 'https://ionaengineering.com';
const fetchUrl = (liveUrl) => (base === LIVE ? liveUrl : liveUrl.replace(LIVE, base));

const pages = new Map();
for (const url of locs) {
  const page = await fetch(fetchUrl(url), { redirect: 'manual' });
  const html = page.status === 200 ? await page.text() : '';
  pages.set(url, {
    status: page.status,
    canonical: html.match(/<link rel="canonical" href="([^"]+)"/)?.[1] ?? null,
    lang: html.match(/<html[^>]*\blang="([^"]+)"/)?.[1] ?? null,
    alts: [...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"/g)]
      .map((m) => ({ lang: m[1], href: m[2] }))
  });
}

const problems = [];
const fail = (msg) => problems.push(msg);

for (const [url, p] of pages) {
  if (p.status !== 200) {
    fail(`${url} -> HTTP ${p.status}`);
    continue;
  }
  if (p.canonical !== url) fail(`${url}: canonical kendini göstermiyor (${p.canonical})`);

  for (const alt of p.alts) {
    if (alt.lang === 'x-default') continue;
    const target = pages.get(alt.href);
    if (!target) {
      fail(`${url}: hreflang=${alt.lang} -> ${alt.href} sitemap'te yok`);
      continue;
    }
    if (!target.alts.some((b) => b.href === url)) {
      fail(`${url}: ${alt.href} geri referans vermiyor (hreflang karşılıklılığı kırık)`);
    }
  }

  const self = p.alts.find((a) => a.href === url && a.lang !== 'x-default');
  if (p.alts.length && !self) fail(`${url}: kendi hreflang satırını listelemiyor`);
  else if (self && p.lang !== self.lang) fail(`${url}: <html lang="${p.lang}"> ama hreflang="${self.lang}"`);
}

console.log(`${base} — sitemap'te ${locs.length} adres`);
if (problems.length) {
  for (const p of problems) console.error('  ✗ ' + p);
  console.error(`\n${problems.length} sorun`);
  process.exit(1);
}
console.log('Sorun yok: her adres 200, canonical kendini gösteriyor, hreflang karşılıklı, <html lang> tutarlı.');
