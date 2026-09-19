# CHANGELOG.md — user-visible changes

> No panel/dashboard tool is wired into this repo yet, so nothing here auto-flows anywhere — this file is maintained by hand until such a tool exists.

## 2026-09-19 (üçüncü tur — ikon fontu ve ana sayfa)

- **Sitenin en ağır varlığı buydu: Material Symbols ikon fontu, her sayfada 6,7 MB.** `wght,FILL@100..700,0..1` ile binlerce ikonun tamamı isteniyordu. `icon_names` ile sitede gerçekten kullanılan **50 ikona** indirgendi: **6.693 KB → 17,4 KB (−99,7%)**. Optimize ettiğimiz tüm fotoğrafların toplamından büyük bir kazanç.
- **Font istekleri 4'ten 2'ye indi** (Inter + Montserrat + Quicksand tek çağrıda birleşti) ve `fonts.gstatic.com` için `preconnect` eklendi — font dosyalarının geldiği ikinci origin'in el sıkışması artık CSS'i beklemiyor.
- **Ana sayfadaki üç ekipman paneli kaldırıldı** (Twin Karıştırıcı / Güç Üretimi / Mono Pompa). IONA ekipman değil tesis teslim ediyor; ayrıca üçünün linki de **zaten kırıktı** — işaret ettikleri `#expo-*` çapaları Hizmetler yenilenirken silinmişti. Bölümde "Mühendislik İş Akışı" paneli kaldı, 01 olarak numaralandırıldı.
- **Site içi arama düzeltildi:** arama dizini hâlâ o üç makineyi listeliyor ve ölü çapalara gönderiyordu; yerine "Çözümlerimiz" girdisi kondu. Dizindeki 14 linkin tamamı doğrulandı.
- **Doğrulama:** alt kümeli font gerçek tarayıcıda ölçüldü — 50 ikonun 50'si de 24 px genişlikte çiziliyor, yani hiçbir ligatür eksik değil. Ayrıca derlenmiş `dist/` çıktısı tarandı: listede olmayan tek bir ikon adı kullanılmıyor.

## 2026-09-19 (ikinci tur — performans ve temizlik)

- **Çok daha hızlı sayfalar.** Sitedeki büyük fotoğraflar ham telefon çekimleriydi (3024×4032, 4284×5712, hatta 5792×4344). Hepsi en uzun kenarı 1800 px olacak şekilde WebP'ye çevrildi: **ana sayfa 4,26 MB → 1,20 MB (−72%)**, **Sektörler 3,63 MB → 1,11 MB (−70%)**. Tek bir örnek: `engine-room.jpg` 7,97 MB → 0,57 MB.
- **Dijital İkiz detay fotoğrafları 33,05 MB → 3,21 MB (−90%).** Bunlar 3D modelde bir yapıya tıklayınca yüklenen 13 fotoğraf; en büyüğü 8 MB'lık tek bir JPEG'di.
- **Deploy 64 MB → 26 MB.** `public/` 61 MB'tan 24 MB'a indi. Hiçbir sayfanın, hiçbir scriptin istemediği 41 dosya (42 MB) `.backups/` altına alındı — orijinallerin tek kopyası oldukları için silinmediler.
- **Ölü kod temizlendi:** hiçbir sayfadan ulaşılamayan 6 modül (`useBrandColors`, `useI18n`, `dnaStory`, `editorialMotion`, `ionaProcessFlow`, `helix-scroll-bg`) ve build'e hiç girmeyen `code.html` arşivlendi. Import grafiği sayfa giriş noktalarından çıkarılarak doğrulandı: 71 modülün 65'i ulaşılabilir.
- **Doğrulama:** gerçek başlatma komutuyla (`serve dist`) 8 sayfa da 200, olmayan yol 404, sayfaların istediği **90 varlığın tamamı 200**. Dijital İkiz'in JS'ten çağırdığı 13 fotoğraf ayrıca tek tek kontrol edildi.

## 2026-09-19

- **Changed:** the Hizmetler (teknoloji.html) page opens with what IONA actually delivers — turnkey biogas plants — instead of a 3D showcase of three individual machines (mixer / CAT genset / mono pump). Real site photography now carries the section: a plant overview plus the three delivery stages (Fizibilite ve Mühendislik → İnşaat ve Montaj → Devreye Alma ve İşletme). Copy rewritten in all seven locales.
- **Faster:** with that showcase gone, teknoloji.html no longer loads Three.js at all (its page bundle is ~2.9 kB) and the 1.1 MB pump GLB is out of the deployment.
- **Added:** the homepage's 3D plant model can now be served from Supabase Storage's CDN instead of the site's own origin — `npm run model:upload` pushes it, `VITE_MODEL_BUCKET` switches the site over. If the env var is unset, or if the remote copy fails to load, the site uses the local copy exactly as before, so the hero can't end up without a model.
- **Smaller deploy:** `dist/models/` went from 8.3 MB to 720 kB. Nothing that ships is loaded at runtime any more — the un-baked plant source moved to `model-lab/src/` (build-time input only), and the unreferenced `digester_web_draco.glb` plus the orphaned standalone machine viewers moved to `.backups/`. `npm run model:bake` re-verified against the new path.
- **Deployed:** the site is live again at `iona-journey-of-energy-production.up.railway.app`, replacing the 3D model archive that had been temporarily published over it since 2026-09-15. The plant model is now served from Supabase Storage's CDN (`VITE_MODEL_BUCKET=models`) — verified in a real browser against production: loads from the CDN, no fallback, no console errors.
- **Fixed:** the three stage cards would have stayed invisible forever — `.fade-in-element` only reveals inside a `.fade-in-section`, and the new wrapper was missing that class. Caught on a screenshot before shipping.

## 2026-08-19

- **Fixed:** navbar links no longer redirect back to the homepage on Railway. Root causes: a leftover SPA catch-all rewrite in `public/_redirects`, and no explicit `start` script telling the host how to serve a multi-page build.
- **Fixed:** the live site was still showing old content after the routing fix because GitHub's default branch (`master`) was frozen at the very first commit while all work had been pushed to `main` only. Both branches now point at the same commit.
- **Added:** the admin content editor (`/admin.html`) can now switch between all five pages (Anasayfa, Teknoloji, Hakkımızda, Etki, İletişim) instead of only ever editing the homepage, and has an Edit/Navigate mode toggle so navbar links can be clicked normally without triggering text editing.
- **Fixed:** content saved through the admin editor now writes to the correct page's row in the database instead of always overwriting the homepage's row.
- **Fixed:** the site's root URL (`/`) was showing a raw file/directory listing instead of the homepage — caused by a serving config flag change that had an unintended side effect. Root now serves `index.html` directly again.
- **Fixed:** clicking nav links other than Anasayfa gave a `404` for browsers that had visited the site before this session's fixes (they'd cached an old redirect from `/teknoloji.html` to `/teknoloji`, a URL the server no longer serves). Every page now resolves correctly both with and without the `.html` suffix, so the stale cached redirect lands somewhere real instead of a `404`.
- **Fixed:** pages could get stuck forever on the loading screen (the pulsing star preloader) when the Supabase environment variables were set but malformed — a bad URL crashed page setup entirely instead of the site falling back to working without a database, as it's designed to. Reproduced and confirmed the exact failure with a standalone script before fixing it.
