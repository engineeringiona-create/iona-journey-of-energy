# IONA Anasayfa 3D Tesis Modeli — Yeniden Tasarım Prompt'u

> Bu dosya, modeli yeniden tasarlayacak kişiye/AI'a verilecek **tek parça brief**tir.
> Aşağıdaki her sayı ve her isim, çalışan koddan ve GLB dosyasının içinden ölçülerek
> çıkarılmıştır — tahmin değildir. Sıfırdan başlanmayacak; mevcut sahne korunup
> üzerine tasarım yapılacak.

---

## 0) ROL VE GÖREV

Sen, web için gerçek zamanlı 3D sahne tasarlayan bir teknik sanat yönetmeni +
three.js geliştiricisisin. Elinde çalışan bir biyogaz tesisi dijital ikizi var.
Görevin bu sahneyi **sıfırdan modellemek değil**, mevcut geometriyi ve etkileşim
sistemini koruyarak **görsel dili, malzeme dilini, detay seviyesini ve açılan
bilgi kartlarını yeniden tasarlamaktır.**

Sonuç ölçütü tek cümle: *"Bir mühendislik firmasının kendi tesisini anlattığı,
tek bakışta neyin ne olduğu anlaşılan, ekranda hafif çalışan bir sahne."*

---

## 1) MEVCUT DURUM — NEYLE ÇALIŞIYORSUN

### 1.1 Dosyalar

| Ne | Nerede |
|---|---|
| Sahne bileşeni (~1590 satır) | `src/components/DigitalTwin/GltfTwinScene.jsx` |
| Runtime geometri yamaları (~690 satır) | `src/components/DigitalTwin/plantStructureOverrides.js` |
| Reaktör kesit katmanı | `src/components/DigitalTwin/ReactorCutaway.jsx` |
| Kamera çerçeveleme yardımcısı | `src/components/DigitalTwin/cameraFit.js` |
| Proses turu metinleri (4 adım) | `src/components/DigitalTwin/processSteps.js` |
| Mount (lazy, IntersectionObserver) | `src/components/DigitalTwin/mount.jsx` |
| **3D model** | `model-lab/src/iona-tesis-3d.glb` — **3.0 MB** |
| Kart fotoğrafları | `public/images/equipment/*.jpg` (13 dosya) |
| Kart videosu | `public/videos/digester-mixer.mp4` |
| Stil | `src/styles/brand-system.css` (`.twin-*` sınıfları) |
| Sayfadaki yeri | `index.html` → `#hero` içinde `#iona-digital-twin-root` |

Not: **`digester_web_draco.glb` (3.7 MB)** — yalnız çürütücüyü içeren, Draco
sıkıştırmalı, çok daha detaylı ve dokulu bir model. Siteye bağlı değil; yeniden
tasarımda "detay nereden gelecek" sorusunun ilk cevabı bu dosyadır. 2026-09-19'da
`public/models/` altından **`.backups/unused-glb/`** içine taşındı — hiçbir sayfa
yüklemediği hâlde her deploy'a 3,6 MB olarak kopyalanıyordu. Kullanılacaksa
oradan geri getirin.

Yukarıdaki tablodaki ham model de aynı gerekçeyle `model-lab/src/` altına
taşındı: `npm run model:bake` girdisi, yani yalnızca derleme zamanı gerekiyor.

### 1.2 GLB'nin gerçek içeriği (ölçülmüş)

```
457 node · 356 mesh · 10 malzeme · 0 doku/görsel · 91.780 benzersiz üçgen
```

Sahne kökü `biogas_plant`, altında **tam olarak 6 üst düzey yapı** var. Kod bu 6
ismi anahtar olarak kullanıyor — **isimler değişirse tıklama, kart, x-ray ve tur
sistemi topyekûn kırılır.**

| Yapı node'u | Gerçek ölçü (G×Y×D, metre) | İçerik |
|---|---|---|
| `digester` | 35.5 × 17.7 × 27.7 | Tank r=12 m, duvar yüzeyi y 0.9→6.0, tabliye halkası y 5.85, kubbe zirvesi ~y 15.7 |
| `engine_room` | 15.6 × 9.7 × 8.6 | Kabuk + `chp_unit` (motor bloğu, jeneratör, egzoz manifoldu, eşanjör, pano) |
| `pump_room` | 7.6 × 4.8 × 10.6 | Döşeme x:[-5.3,5.3] z:[-3.8,3.8] + `pump_set` (3 komple pompa) |
| `scada_room` | 10.6 × 7.1 × 8.1 | Kabuk + `control_desk_area` |
| `feed_pool` | 13.2 × 4.9 × 14.6 | Havuz, astar, rim, substrat yüzeyi, köprü + karıştırıcı |
| `site_piping` | 33.1 × 5.9 × 38.9 | Gaz / ısı / besleme hatları, kablo tavası, boru mesnetleri |

Toplam saha: **~46 × 18 × 56 m**. Yani model **1 birim = 1 metre** ölçeğinde.

GLB'nin kendi malzemeleri (`concrete`, `shell_steel`, `dark_trim`, `gas_membrane`,
`galv_steel`, `heat_red`, `plant_green`, `glazing`, `gas_yellow`, `slurry`)
**hepsi runtime'da eziliyor** — şu an hiçbiri ekranda görünmüyor.

### 1.3 Şu anki görsel dil — "beyaz kil maketi"

Kod her yüzeye tek bir reçete uyguluyor:

```js
CLAY = { color: '#ffffff', roughness: 1, metalness: 0 }
```

Üstüne **mühendislik konturu**: her mesh'e `EdgesGeometry` ile yeşil çizgi
(`#00d15a`, opacity `0.34`, 22° eşik açısı, yarıçapı 0.14 m'den küçük parçalara
kontur çizilmez).

Tek istisna gaz kubbesi — `MeshPhysicalMaterial`:
`transmission:1, roughness:.08, ior:1.35, thickness:.6, clearcoat:1,
emissive:'#00d15a' @ .06, DoubleSide` → "güç alanı camı".

Aydınlatma: drei `Environment preset="studio"` (**dikkat: bu HDR, drei'nin CDN'inden
runtime'da ~1.6 MB indiriliyor — lokale alınmamış**) + tek yönlü ışık
`[-60, 90, 50]`, yoğunluk 1.1. Gölgeler 12 fps'te bake ediliyor, `ContactShadows`
tek karede. Zemin: 5 m hücreli, 25 m bölümlü açık gri `Grid`.

**Bunun sonucu (ekran görüntüsüyle doğrulandı):** beyaz zeminde beyaz model.
Tesis neredeyse kayboluyor, siluet okunmuyor, `site_piping` hattı hayalet gibi,
ekipmanlar (pompa, motor, karıştırıcı) hiçbir şekilde ayırt edilemiyor. Model
"temiz" ama **anlatmıyor**.

### 1.4 Runtime'da geometriye yapılan müdahaleler (`plantStructureOverrides.js`)

Bunlar GLB'de yok, kod ekliyor. Yeniden tasarımda **ya devralınacak ya da GLB'ye
gömülüp koddan silinecek** (tercih edilen: GLB'ye gömmek).

- `engine_room`: orijinal "ev görünümlü" kabuk **silinip** yerine gerçek ISO
  konteyner kuruluyor — 13.8 × 4.5 × 6.7 m, 20 uzun + 11 kısa oluk nervürü,
  8 köşe dökümü, çatı sundurması, **2 adet çatı fanı** (r 0.78), egzoz bacası
  (r 0.36, h 3.2), 6 panjur, yer hizasında ikaz şeridi.
- `pump_room`: kapalı kabuk **silinip** açık sundurmaya çevriliyor — 6 kolon
  (r 0.12, h 3.9), 9.6 × 6.6 m çatı, 4° eğim.
- `digester`: duvar/tabliye derzi r=12'de 0.6 m'lik silindir yamayla kapatılıyor.
- `digester`: GLB'nin kendi `mixers` + `top_mixers` grupları **siliniyor**,
  yerine 6 karıştırıcı kuruluyor:
  - **4 yan girişli**: r=12, y=3.45, azimut 0/90/180/270°, ~17° teğetsel savrulma,
    ~10° ek aşağı eğim, şaft 2.5 m, **4 kanatlı tek pervane**, kırmızı emissive
    kanat (`#EF4444`, emissive `#ff3b3b` @0.5), çelik gövde (`#c7c9cc`, metalness .85),
    koyu göbek konisi, duvar girişinde **camgöbeği nabız halkası** (`#66d9ff`).
  - **2 tabliye üstü eğimli**: r=10.5, y=5.7, azimut 45/225°, şaft 4.2 m,
    ~52° aşağı eğim, şaftın %55 ve %95'inde **ikişer 3 kanatlı** pervane.
- `digester`: `wall_rib`, `wall_band`, `rail_post`, `platform_rail`,
  `platform_post`, `top_ring` mesh'leri **`visible = false`** yapılıyor —
  yani GLB'deki 70+ nervür ve korkuluk parçası boşuna yükleniyor.

⚠️ **Mühendislik tutarsızlığı — düzeltilmesi gereken:** Sahadaki gerçek ürün
**Armatec Arma Mix Twin**: TEK uzun şaft (5.5 m'ye kadar), üzerinde **İKİ pervane**
(Ø880–1000 mm), kırmızı motor+redüktör, koyu **45° döndürülmüş kare (elmas) flanş**,
duvara 45°'ye kadar eğimli montaj, 15–22 kW. Modeldeki "4 kanatlı tek pervaneli yan
karıştırıcı" bu ürün değil. Yeniden tasarımda karıştırıcı ailesi **tek tipe**
indirilip gerçek ürüne göre modellenmeli.

### 1.5 Etkileşim sistemi (korunacak iskelet)

- **Seviyeler:** 0 = genel görünüm, 1 = yapı seçili, 2 = alt bileşen seçili.
  Her değişimde `document` üzerinde `twinlevelchange` event'i yayılıyor.
- **Hover:** mesh'lerin shader'ına enjekte edilmiş "solucan" efekti — rim ışığı +
  akan bant, renkler `#78dc77` ↔ `#c0d8c4`.
- **Seçim (x-ray):** seçilen yapı dışındaki her şey 0.55 s'de **%12 opaklığa**
  düşüyor, gölge atması kapanıyor. Konturlar da birlikte soluyor.
- **Kamera:** FOV 35. Genel yön `(1, 0.8, 1)`, odak yönü `(0.65, 0.42, 0.75)`.
  Kart açıldığında kamera, kartın kapladığı genişlik ölçülüp **sola pan**
  ediliyor (maks. %50). Yumuşatma `useFrame` içinde lerp.
  **⚠️ `OrbitControls`'ta rotate / zoom / pan üçü de KAPALI** — kullanıcı modeli
  çeviremiyor. Bu, dijital ikiz vaadiyle çelişen en büyük UX kaybı.
- **İç içe seçim:** `digester` seçiliyken karıştırıcıya tıklanınca ayrı bir kart
  açılıyor (`biogas_mixer`), üstünde `⚡ Dalgıç Karıştırıcı` baloncuğu beliriyor.
- **Kesit modu** ("Reaktörün içini aç"): `(-1,0,-1)` normalli kesme düzlemi,
  kubbe yükseliyor, içeride zeytin yeşili sıvı (%62 yükseklik, opacity .16),
  sarı yüzey halkası (`#ffc700`), gaz hacmi (%29), 18 adet yükselen kabarcık.
  Altta legend: "● Karışım seviyesi ● Gaz hacmi · Şematik kesit · Canlı ölçüm değildir".
- **Proses turu** ("Tesis nasıl çalışır?"): 4 adım — Besleme → Anaerobik çürütme →
  Gaz toplama → Elektrik ve ısı. Her adımda ilgili boru hattında akış nabzı yanıyor:
  besleme `#78dc77`, gaz `#ffb020`, elektrik `#4dd9e8`.
- **Alt navigasyon:** kanvasın altında 5 hap buton (Çürütücü / Kojenerasyon Odası /
  Pompa Odası / SCADA Kontrol Odası / Besleme Havuzu) + "↖ Genel görünüm".
- **Performans:** mobilde dpr 1, masaüstünde [1, 1.5]; görünürlük dışında render
  duruyor; `transmissionResolutionScale = 0.5`.

### 1.6 Şu anki kart yapısı (`plantData`, GltfTwinScene.jsx içinde)

**Seviye 1 kartı:** `Tesis Bileşeni` etiketi + kapat (×) → başlık → fotoğraf
(170 px) → 1–2 cümle açıklama → varsa numaralı teknik özellik listesi →
alt bileşen butonları (isim + tek satır spec).

**Seviye 2 kartı:** `‹ [Üst yapı adı]` geri butonu → alt bileşen adı → yeşil spec
satırı → fotoğraf/video (256 px) → açıklama → `01 02 03…` numaralı spec listesi.

Mevcut içerik envanteri:

| Yapı | Alt bileşenler |
|---|---|
| Çürütücü | Tabliye ve Perde Karıştırıcıları · Isıtma Eşanjörü · Enstrümantasyon ve Sensörler |
| Kojenerasyon Odası | Gaz Motoru (V12) · Egzoz Isı Geri Kazanımı |
| Pompa Odası | Loblu Pompa · Maseratör |
| SCADA Kontrol Odası | Biyogaz Analizörü · Ana PLC Panosu |
| Besleme Havuzu | Dalgıç Karıştırıcı (video'lu) |
| *(gizli)* Biyogaz Mikseri | alt bileşeni yok, "Reaktör Görünümüne Dön" butonu var |

**Kartlardaki mevcut kusurlar (düzeltilecek):**
1. "Enstrümantasyon ve Sensörler" kartında `photo` alanı **yok** → kesikli çerçeveli
   "Gerçek Ekipman Fotoğrafı" placeholder'ı çıkıyor. Oysa
   `public/images/equipment/digester-sensors.jpg` **diskte mevcut**, sadece
   bağlanmamış.
2. Kartta "Armatech Twin / Armatech Evoplus" yazıyor; gerçek ürün **Armatec Arma
   Mix Twin**. Marka adı yanlış yazılmış.
3. "15 kW, 320 RPM" — dalgıç biyogaz karıştırıcısı için 320 RPM şüpheli; yavaş
   devirli tipler 20–75 RPM bandında. Teyit edilip düzeltilmeli.
4. Kart 3D'ye bağlı değil: kart açıkken modelde **hangi parçadan bahsedildiği
   vurgulanmıyor** (ilgili mesh highlight edilmiyor, ok/etiket çıkmıyor).
5. Seviye 2'de model hiç hareket etmiyor — kamera hâlâ tüm yapıyı çerçeveliyor,
   alt bileşene yaklaşmıyor.

---

## 2) YENİDEN TASARIM HEDEFİ

### 2.1 Tasarım yönü — seç ve gerekçelendir

Aşağıdaki üç yönden **birini seç**, seçtiğini tek paragrafla gerekçelendir, sonra
tüm sahneyi o yöne göre uygula. Yarı yolda karıştırma.

- **A — Mühendislik Maketi (mevcut yönün güçlendirilmişi):** kil beyazı kalır ama
  artık *tek* beyaz değildir: beton, galvaniz, boyalı çelik ve membran için 4 ayrı
  değer/pürüzlülük kademesi. Konturlar zayıflar, formu gölge taşır. Renk yalnız
  proses akışlarında ve emniyet ekipmanında kullanılır.
- **B — Saha Gerçekçiliği:** gerçek malzemeler — IONA yeşili trapez sac
  (`#198837`), beton, paslanmaz, kırmızı motor. Referans: `digester_web_draco.glb`
  ve `public/images/equipment/` fotoğrafları. Marka rengi mimaride yaşar.
- **C — Teknik Şematik:** neredeyse çizim — soluk dolgu, güçlü kontur, ölçü
  çizgileri, kot işaretleri, akış okları. Foto-gerçekçilik hedeflenmez, **okunurluk**
  hedeflenir.

Hangisi seçilirse seçilsin, **beyaz zeminde beyaz model sorunu çözülmek zorunda**:
ya modelin değeri düşer, ya zemin koyulaşır, ya da ikisinin arasına gerçek bir
zemin düzlemi/platform girer.

### 2.2 Marka kısıtları (değişmez)

| Rol | Değer |
|---|---|
| Ana yeşil | `#2D981F` (logodan örneklenmiş) / ikincil `#2d9937` |
| Açık yeşil (hover/akış) | `#78dc77` |
| Kontur yeşili | `#00d15a` |
| IONA saha yeşili (trapez sac) | `#198837` |
| Gaz akışı | `#ffb020` · Elektrik akışı `#4dd9e8` · Sıvı yüzeyi `#ffc700` |
| Tipografi | Başlık Poppins/Montserrat, gövde Inter |
| Genel duygu | *Simply, Engineered!* — sade, mühendis, gösterişsiz |

### 2.3 Yapı yapı istenen detay seviyesi

Her madde için hedef: **ekranda o parçanın ne olduğu, kart açılmadan da anlaşılsın.**

**① Çürütücü (`digester`)**
- Tank duvarı: gerçek panel derzleri ve cıvata sıraları — şu anki 200 tekrarlı
  soluk şerit dokusu yerine gerçek geometri/normal.
- Kubbe: çift membran okusun — dış hava koruma tabakası + iç gaz tutucu torba
  (referans: `digester_web_draco.glb` bu ikiliyi zaten içeriyor). Kesit modunda
  ikisi ayrı ayrı görünmeli.
- Merdiven + tabliye + korkuluk: **ya düzgün modellensin ya tamamen kaldırılsın.**
  Şu an yarısı `visible=false` — arada kalmış durumda.
- Karıştırıcılar: **tek aile, Arma Mix Twin** — tek şaft + 2 pervane
  (Ø~0.9 m), kırmızı motor/redüktör, koyu elmas flanş, duvara eğimli montaj.
  Sayı ve azimut serbest ama **simetrik ve gerekçeli** olsun.
- Isıtma devresi: duvar içi spiral boru, kesit modunda görünür, dışarıdan yalnız
  giriş/dönüş nozulları ve flanşları okunur.
- Enstrümantasyon: radar seviye sensörü, PT100'ler, basınç transmitteri, pH/ORP
  probu — **görünür, küçük ama ayırt edilebilir** parçalar (şu an hiç yok).

**② Kojenerasyon Odası (`engine_room`)**
- ISO konteyner doğru: oluk adımı, köşe dökümleri, çift çatı fanı, susturuculu baca.
- Kapı açılabilir/şeffaf bir hâl kazanmalı ki `chp_unit` (motor + jeneratör +
  eşanjör + pano) **dışarıdan sezilsin.** Şu an konteyner tamamen kapalı, içerideki
  40+ parça hiç görünmüyor — boşuna yükleniyor.
- Egzoz ısı geri kazanım eşanjörü ve 85 °C su çıkış hattı okunur olmalı.

**③ Pompa Odası (`pump_room`)**
- Açık sundurma doğru kurgu — devam.
- 3 pompa seti **birbirinden ayırt edilebilir** olmalı: loblu pompa, maseratör,
  tahrik motoru. Şu an üçü de aynı beyaz kütle.
- Emiş/basma manifoldu ve vanalar görünür; boru renk kodu proses turuyla uyumlu.

**④ SCADA Kontrol Odası (`scada_room`)**
- **En zayıf halka: hâlâ "ev" gibi görünüyor** (konut tipi pencere + kapı).
  Prefabrik saha binası veya ikinci bir konteynere çevrilmeli.
- Dışarıda: kablo tavası girişi, klima ünitesi, anten/direk.
- İçeride: kumanda masası + ekran duvarı silüeti, camdan sezilecek kadar.

**⑤ Besleme Havuzu (`feed_pool`)**
- Substrat yüzeyi gerçek malzeme gibi okusun (şu an düz kil).
- Köprü + dalgıç karıştırıcı + besleme olukları belirgin.
- Havuz kenarı, korkuluk ve dolum rampası eklenmeli.

**⑥ Saha Boruları (`site_piping`)**
- **Şu an neredeyse görünmez — en büyük kayıp burada.** Üç hat (besleme / gaz /
  elektrik) renk, çap ve kot olarak birbirinden ayrılmalı; tesisin "damar sistemi"
  ilk bakışta okunmalı.
- Boru mesnetleri, sleeper'lar, kablo tavası kolonları gerçek yüksekliklerde.
- ⚠️ Kodda `FeedPipeGapFill` diye bir yama var: besleme hattında x=18.05, y=2.82,
  z −1.8→5.5 arasında **gerçek bir boşluk** silindirle kapatılıyor. Yeni modelde
  hat kesintisiz olmalı, yama silinmeli.

### 2.4 Kamera, hareket, atmosfer

- **Orbit'i aç.** En azından yatay döndürme + sınırlı zoom. Şu anki tamamen kilitli
  kamera, "etkileşimli model" başlığını yalanlıyor.
- Boşta yavaş bir otomatik yörünge (kullanıcı dokununca durur, `prefers-reduced-motion`
  varsa hiç başlamaz).
- Yapı seçiminde kamera hedefi o yapı; **alt bileşen seçiminde ilgili parçaya kadar**
  yakınlaşsın ve parça highlight olsun.
- Işık: tek yönlü ışık + studio HDR yerine, sahneye ait bir kurgu.
  **HDR dosyası lokale alınmalı** (`public/hdri/…`) — şu an drei CDN'inden
  çalışma anında 1.6 MB indiriliyor, ağ yoksa aydınlatma çöküyor.
- Hareket eden ne varsa gerekçesi olsun: pervane dönüşü, kabarcıklar, akış nabzı,
  fan. Süs animasyonu yok.

### 2.5 Performans bütçesi (aşılmayacak)

| Ölçüt | Hedef |
|---|---|
| GLB boyutu | **≤ 4 MB** (Draco/meshopt serbest) |
| Üçgen | ≤ 250.000 |
| Draw call | ≤ 300 (nervür/korkuluk/cıvata gibi tekrarlı parçalar birleştirilecek veya instance'lanacak) |
| Doku | ≤ 4 atlas, 1K, ORM paketli (R=AO, G=roughness, B=metalness) |
| İlk etkileşim | orta seviye dizüstüde ≤ 3 sn |
| Mobil | dpr 1'de ≥ 30 fps |
| Gölge/transmission | mevcut throttle korunacak |

Görünmeyen hiçbir şey yüklenmeyecek: bugün 70+ nervür/korkuluk mesh'i
`visible=false` ile yükleniyor, konteyner içindeki 40+ motor parçası hiç
görünmüyor. Ya görünür kılınacak ya modelden çıkarılacak.

---

## 3) AÇILAN KART — TASARIM ŞARTNAMESİ

### 3.1 Kart mimarisi

Üç seviyeli hiyerarşi korunur, ama her seviyenin **3D'de bir karşılığı olmalı**:

| Seviye | Kart | 3D'de ne olur |
|---|---|---|
| 0 | Kart yok, ipucu satırı | Tüm saha çerçevelenir, yavaş yörünge |
| 1 | Yapı kartı | Yapı seçilir, diğerleri %12'ye soluklaşır, kamera o yapıya gider |
| 2 | Alt bileşen kartı | **Yeni:** ilgili mesh vurgulanır, kamera parçaya yaklaşır, diğer parçalar yarı saydam olur |

### 3.2 Seviye 1 kartı — alan alan

1. **Üst şerit:** sol `TESİS BİLEŞENİ` etiketi · sağ kapat (×)
2. **Başlık** (h2)
3. **Kimlik satırı (YENİ):** tek satırda 3 anahtar sayı — örn. çürütücü için
   `Ø24 m · 2.700 m³ · 38–42 °C`. Kartın en üstünde, fotoğraftan önce.
4. **Görsel:** gerçek saha fotoğrafı (170 px, yuvarlatılmış). Fotoğraf yoksa
   3D'den render edilmiş temiz bir görünüm kullanılır — **kesikli placeholder
   kutusu artık görünmemeli.**
5. **Açıklama:** 2–3 cümle, mühendis diliyle, pazarlama sıfatı yok.
6. **Teknik özellikler:** `01 02 03…` numaralı liste (mevcut `TechSpecs` stili korunur).
7. **Alt bileşen listesi:** her biri isim + spec satırı; **YENİ:** üstüne gelince
   3D'de karşılığı olan parça yanıp sönmeli (kart ↔ model bağı).
8. **YENİ — "Bu parçada ne olur":** proses turundaki ilgili adıma tek tık geçiş.

### 3.3 Seviye 2 kartı — alan alan

1. `‹ [Üst yapı]` geri linki + kapat (×)
2. Alt bileşen adı (h2)
3. Yeşil tek satır spec (mevcut)
4. Görsel: fotoğraf veya video (256 px) — besleme havuzu karıştırıcısında olduğu
   gibi video varsa otomatik oynar, sessiz, döngülü
5. Açıklama paragrafı
6. Numaralı teknik özellik listesi
7. **YENİ — kaynak/marka satırı:** "Referans ürün: …" ayrı ve küçük, gövde
   metnine karışmadan
8. **YENİ — "Modelde göster" butonu:** kamerayı o parçaya kilitler

### 3.4 İçerik kuralları

- Her sayı ya doğrulanabilir ya da açıkça **"projeye göre değişir"** işaretli olsun.
  Mevcut tur panelindeki "Şematik proses anlatımı. Ekipman ve akış düzeni projeye
  göre değişir." notu iyi bir örnek — bu disiplin kartlara da taşınsın.
- Marka isimleri doğru yazılsın: **Armatec Arma Mix Twin** (Armatech değil),
  Vogelsang / Börger, Jenbacher / MWM / Caterpillar, Siemens S7 / Allen-Bradley.
- Türkçe ana dil; i18n zaten 7 dil destekliyor (`src/i18n/`), **kart metinleri
  koda gömülü kalmasın, i18n'e taşınsın** (bugün `plantData` içinde sabit Türkçe).
- Emoji kullanımı tek bir kararla: ya hepsinde ya hiçbirinde. Bugün yalnız
  `biogas_mixer` kartında ⚙️🌪️🛡️🎯 var — tutarsız.

### 3.5 Kart sayısı ve kapsam

Mevcut 5 yapı + 1 gizli mikser kartı **korunur**. Yeniden tasarımda eklenmesi
önerilenler (gerekçeliyse ekle, değilse gerekçesini yaz):

- **Gaz hattı / gaz temizleme** kartı (`site_piping` bugün tıklanamıyor ama
  proses turunun üç adımının konusu o)
- **Çıkış / digestat** kartı — proses anlatımı bugün elektrikte bitiyor,
  sindirilmiş materyalin nereye gittiği hiçbir yerde yok

---

## 4) BOZULMAMASI GEREKENLER (kod sözleşmesi)

Aşağıdakiler değişirse kod sessizce kırılır. Değiştireceksen **kodu da birlikte
güncelle**, tek taraflı dokunma.

1. Sahne kökü **`biogas_plant`**; altındaki 6 üst düzey node adı:
   `digester`, `engine_room`, `pump_room`, `scada_room`, `feed_pool`, `site_piping`.
   Bu adlar `plantData` anahtarlarıyla birebir eşleşiyor.
2. Tıklama mantığı, tıklanan mesh'ten **üst düzey yapıya kadar yukarı yürüyor**
   (`findStructureNode`). Her mesh bir yapının altında olmalı; kök seviyesinde
   serbest mesh bırakma.
3. Mesh adlarının sonundaki `_1`, `_2` ekleri GLTFLoader'ın tekilleştirmesi;
   kod bunları soyuyor. **Anlamlı isim ile numarayı karıştırma**
   (`wall_band_1` çalışır, `mixer2_shaft` çalışmaz).
4. Kesit modu şu tam adları arıyor: `tank_wall`, `gas_dome`, `dome_seam`.
5. Karıştırıcı seçimi `biogas_mixer` adlı **group** node'unu arıyor;
   animasyon `side_mixer_prop_hub` ve `side_mixer_beacon` adlarına bağlı.
6. Proses turu şu node'ları çağırıyor: `feed_pool`, `digester`, `engine_room`.
   Akış nabzı boru adı kümelerine bağlı (`gas_main`, `feed_from_pool`,
   `cable_tray_main` vb. — tam liste `GltfTwinScene.jsx` içinde).
7. `twinlevelchange` event'i sayfanın başka yerlerince dinleniyor — kaldırma.
8. Kontur sistemi 0.14 m'den küçük parçaları atlıyor; cıvata/kulp gibi detayları
   **ayrı mesh** yaparsan kontur almazlar (istenen davranış budur, bilerek kullan).

---

## 5) TESLİMAT

1. **Yön kararı** — A/B/C'den biri + tek paragraf gerekçe.
2. **Malzeme tablosu** — her yüzey sınıfı için renk / roughness / metalness /
   doku, hangi mesh adlarına uygulandığı.
3. **Yeni/güncellenmiş GLB** — `public/models/` altında, bütçe tablosuna uyan,
   ölçülmüş üçgen ve boyut raporuyla.
4. **Kod değişiklikleri** — `GltfTwinScene.jsx` malzeme katmanı,
   `plantStructureOverrides.js` (mümkün olduğunca boşaltılmış), `plantData`
   içeriğinin i18n'e taşınmış hâli.
5. **Kart kopyası** — 6 yapı × (1 ana kart + alt bileşenler), tam metin,
   doğrulanmamış her sayı işaretli.
6. **Önce/sonra görüntüleri** — genel görünüm, seçili yapı, alt bileşen, kesit
   modu, proses turu; masaüstü + mobil.
7. **Kısa gerileme listesi** — bu brief'te "bozulmamalı" denen 8 maddenin
   tek tek doğrulandığı kontrol listesi.

---

## 6) AÇIKÇA İSTENMEYENLER

- Sıfırdan yeni bir tesis modellemek. Mevcut düzen, ölçüler ve node ağacı temeldir.
- Foto-gerçekçilik uğruna performans bütçesini aşmak.
- Bloom / lens flare / hacimsel ışık / parıltı partikülleri gibi süslemeler.
- Kartları pazarlama metnine çevirmek. Bu sahne bir mühendislik anlatımıdır.
- Node adlarını "daha güzel" diye değiştirmek.
- Doğrulanmamış teknik sayı eklemek.

---

### Ek — bu brief'in çıkarıldığı ortam

Site `http://localhost:5177` üzerinde çalışıyor
(`/mnt/c/Users/ÖZGÜR/Desktop/IONA-Web-Sitesi-2026-09-11`, `npm run dev -- --port 5177
--strictPort`). Model anasayfanın hero bölümünde, sayfa açılır açılmaz görünür.
Ekran görüntüleri: `~/.iona-tools/shots/twinshot2.png` (genel görünüm),
`twin-card.png` (çürütücü kartı açık), `twin-cutaway.png` (kesit modu).
