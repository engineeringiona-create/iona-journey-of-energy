# TODO.md — unfinished work

## Panelden yapılacaklar — kod tarafı bitti, erişim gerekiyor (2026-09-19)

Aşağıdakiler bu depodan yapılamaz: Cloudflare kural yazma ayrı yetki ister ve
bu makinede Cloudflare token'ı yok, arama motoru araçları ise tarayıcıdan giriş
ister. Kodun beklediği her şey hazır — `sitemap.xml`, `robots.txt`, canonical ve
hreflang canlıda çalışıyor.

- [ ] **Google Search Console** — search.google.com/search-console → Add property
      → **Domain** türü (URL prefix değil; apex, www ve `/en/`, `/de/` … alt
      yollarını tek mülkte toplar) → `ionaengineering.com`. Verdiği TXT kaydını
      Cloudflare DNS'e ekle. **Mevcut `_railway-verify` TXT kayıtlarını silme** —
      Railway sertifika yenilemesi onlara bakıyor. Doğrulama geçince Sitemaps →
      `sitemap.xml` gönder (43 adres: 7 Türkçe + 36 dil sayfası).
- [ ] **Bing Webmaster Tools** — bing.com/webmasters → Import from Google Search
      Console. Ayrı doğrulama istemez. ChatGPT ve Copilot aramaları Bing
      indeksini kullanıyor, atlanmamalı.
- [ ] **Google Business Profile** — Türkiye'de harita sonuçlarına girmenin tek
      yolu. Adres, telefon, kategori (mühendislik / yenilenebilir enerji).
- [ ] **Cloudflare: www → apex 301** — Rules → Redirect Rules → Create rule.
      Eşleşme: Hostname equals `www.ionaengineering.com`. Hedef: Dynamic,
      `concat("https://ionaengineering.com", http.request.uri.path)`, durum
      **301**, query string Preserve. Şu an www da apex de aynı içeriği doğrudan
      sunuyor; canonical zaten apex'i gösterdiği için bu acil değil, 301 sadece
      daha temiz sinyal verir.
- [ ] **Cloudflare: statik varlık önbelleği** — Caching → Cache Rules. Eşleşmeyi
      `/assets/*`, `/images/*`, `/videos/*`, `/models/*` yollarıyla SINIRLA,
      "All incoming requests" yapma. Gerekçe: artık origin doğru `cache-control`
      gönderiyor (assets 1 yıl immutable, görseller 7 gün, HTML `max-age=0,
      must-revalidate`). HTML'i kenarda 4 saat tutmak her içerik güncellemesinden
      sonra Purge Everything gerektirir — admin panelinden metin değiştiren biri
      için kötü takas. Varlıklar hash'li isim taşıdığı için onlarda purge hiç
      gerekmez.

- [ ] Confirm in the Railway dashboard (Settings → Source) which branch the service actually deploys from, and confirm Settings → Deploy → Start Command isn't manually overridden to something other than `npm start`.
- [ ] Set real `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` in Railway's environment variables — and locally in `.env` if the admin editor needs testing against the real DB instead of the `localStorage` fallback.
- [ ] Verify the live Supabase `site_content` table actually has rows for `teknoloji` / `hakkimizda` / `etki` / `iletisim`, not just a leftover `home` row from before per-page storage existed.
- [x] `ionaflux.html` added to `src/lib/pages.js` on 2026-09-19, so the admin page selector reaches it and its content overrides apply. No `site_content` row exists yet; one is created on first save.
- [ ] `teknoloji.html` is now the heaviest page (2.55 MB of images) — its `field/*.webp` are already optimised at 1800×1350, but the three stage cards display them in ~400×240 boxes. Proper `srcset`/downscaled variants would cut roughly 0.7 MB. Left undone deliberately: several of those files are shared across pages at different display sizes, so picking one wrong size makes an image blurry somewhere.
- [ ] Every page ships ~390 kB of JS: ~167 kB is `@supabase/supabase-js` (pulled in by `quoteModal` → `supabaseClient`) and ~221 kB is the shared gsap/lenis/common/i18n chunk. The Supabase cost is currently hidden behind the 1.5 s preloader, so it is not perceptible — only worth attacking if the preloader ever goes away.
- [ ] Build warns that `dist/assets/scene-utils-*.js` is ~737 kB minified — consider dynamic `import()` / manual chunking for the Three.js scene code per Vite's own suggestion.
- [ ] Deploys must run from the WSL-native copy `~/.iona-web-deploy`, never `railway up` straight from `/mnt/c` — it uploads NUL-filled files and the build dies on a bogus syntax error (see LESSONS.md, 2026-09-19). Worth scripting as `npm run deploy` so nobody rediscovers it.
- [ ] `railway.json` (Config as Code) is deprecated; Railway warns on every command and stops honouring it **2026-12-01**. Migrate to `.railway/railway.ts` with `railway config migrate` before then.
- [ ] Decide whether the admin panel's Supabase content overrides should stay on in production. They are on (`VITE_SUPABASE_URL`/`ANON_KEY` are set) and `site_content` has `home` + `hakkimizda` rows dated 2026-09-09/09-11 from an older working copy — so the live homepage text may not match what's in `index.html` here. `teknoloji` has no row, so the new Hizmetler copy is served straight from the markup.
- [x] Hotspots retargeted on 2026-09-19 from the removed teknoloji.html showcase to the homepage's Digital Twin hero — the one 3D scene the site still has (`HOTSPOT_PAGE` in `src/i18n.js`).

## Tasarım sistemi — açık kalan tek kalem

- [ ] **Ana sayfada 28 metin parçası hâlâ çeviri etiketi taşımıyor** — hesaplayıcının
      atık türü seçenekleri, "IONA / TESİS ANATOMİSİ" gibi bölüm etiketleri,
      veri duvarındaki metrik adları. Bunlar `[data-i18n]` taşımadığı için dil
      sayfalarında Türkçe kalıyor ve build'in eksiksiz-çeviri kapısı da onları
      göremiyor (kapı yalnızca KULLANILAN anahtarları denetliyor). 2026-09-19'da
      katalog bölümü (20 anahtar) etiketlendi; kalanlar aynı yöntemle yapılmalı.
- [ ] **`src/lib/quoteModal.js` kendi paletini ve ölçeğini çalıştırıyor.** Teklif
      modalı inline stille kurulmuş ve DESIGN.md'de geçmeyen ikinci bir renk
      kümesi taşıyor (`#193322`, `#52634f`, `#198837`, `#fffdf7`, `#f5f7ef`,
      `#cddbc6`, `rgba(63,174,102,…)`), kendi yarıçapları (28px, 12px) ve
      rampa dışı punto boyutları (28px, 15px, 13px) var — 33 uyarı.
      Yanlış pozitif DEĞİL: kamuya açık, gerçek bir arayüz ve sitenin ana
      dönüşüm noktası. İki yol var, ikisi de görsel sonuç doğuruyor ve karar
      senin: (a) bu değerleri DESIGN.md'ye resmî olarak ekleyip modalı
      sistemin parçası yapmak, (b) modalı mevcut rampaya ve palete taşımak.
      Bu yüzden susturulmadı — uyarılar görünür kalsın, karar verildiğinde
      kapansın. Aynı değerler 2026-09-19'da `src/lib/successCard.js`'e de taşındı
      (onay kartı iki akış için ortaklandı); karar verildiğinde değiştirilecek
      yer artık iki dosya: modalın formu ve ortak onay kartı.
