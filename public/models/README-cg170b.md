# CAT® CG170B-20 — scroll ile parçalarına ayrılan gaz motorlu jeneratör seti

Aynı mimari, karıştırıcı sayfasıyla birebir uyumlu (three.js CDN'den, sabit sürüm + SRI):

- `cat-cg170b-20.html` — sayfa kabuğu (import map, metinler, etiket katmanı, gösterge paneli, CSS)
- `cg170b-model.js`    — jeneratör setinin parametrik 3B modeli (16 adlandırılmış ana grup)
- `cg170b-scene.js`    — sahne, ışık, kamera, scroll animasyonu ve çalışma kinematiği

## Modelin esas aldığı veriler

20 silindir · 60° V · çap 170 mm × strok 195 mm · biyel 360 mm · silindir aralığı 300 mm
1 500 dev/dak · 50 Hz (4 kutup) · ≈ 2 000 ekW · her banka bir turbo + karışım soğutucu (SCAC).
Tüm bu değerler `cg170b-model.js` içindeki `SPEC` nesnesinde tek yerde tutulur; değiştirdiğinizde
piston strokları, krank kolu yarıçapı, silindir yerleşimi ve göstergedeki devir/güç/frekans
otomatik olarak yeniden hesaplanır.

## Zaman çizelgesi (0 → 1 scroll ilerlemesi)

| aralık | ne olur |
|---|---|
| 0.00–0.12 | montajlı set, 3/4 hero açısı |
| 0.12–0.52 | 16 ana grup kendi yönünde ayrılır (bankalar 60°'lik ekseni boyunca dışa, şasi aşağı, alternatör eksende) |
| 0.15–0.72 | anlatılan gruba göre etiket + kamera odağı: şasi/krank → silindirler → hava-egzoz → güç aktarımı |
| 0.70–0.88 | aynı yolun tersinden geri montaj |
| 0.87–1.00 | **çalışma:** krank döner, 20 piston gerçek biyel-krank kinematiğiyle hareket eder, turbolar 9× devirde döner, alternatör rotoru yüklenir, egzoz manifoldu kızarır, gösterge 1 500 dev/dak · 2 000 kW · 50 Hz'e çıkar |
| 0.90–0.99 | blok duvarları, gömlekler, banka A kapakları ve alternatör gövdesi yarı saydama geçer (kesit görünümü) |

## Ana gruplar

şasi + titreşim takozları · yağ teknesi/yağlama · silindir bloğu (60° V) · krank mili ·
piston-gömlek grubu A/B · silindir kapakları A/B · egzoz manifoldu A/B · turbo grubu ·
karışım soğutucu · gaz karıştırıcı + emme manifoldu · volan & elastik kavrama · alternatör ·
TPEM kontrol panosu.

## Ayar noktaları

- `ex: [...]` (her parçanın tanımında): patlatma yönü ve mesafesi
- `SPEC`: motor ölçüleri ve anma değerleri
- `cut` / `anim.ghostMats` (cg170b-scene.js): kapanıştaki kesit saydamlığı
- `height:760vh` (html): scroll uzunluğu — min. 500vh önerilir
- `MAT` (cg170b-model.js): renk/pürüzlülük — CAT sarısı `#f0c200`

## Performans notu

Model ~600 mesh içerir; bu yüzden sınırlayıcı kutular bir kez önbelleğe alınır, küçük iç
parçalar gölge üretmez ve gölge haritası 1024'tür. Daha güçlü sunumda `shadow.mapSize` ve
`setPixelRatio` değerlerini yükseltebilirsiniz.
