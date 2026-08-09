# ARMA MIX TWIN — scroll ile parçalarına ayrılan 3B görünüm

Üç dosya, sıfır bağımlılık (three.js CDN'den, sabit sürüm + SRI):

- `arma-mix-twin.html` — sayfa kabuğu (import map, metinler, etiket katmanı, CSS)
- `agitator-model.js`  — karıştırıcının parametrik 3B modeli (13 adlandırılmış parça)
- `explode-scene.js`   — sahne, ışık, kamera ve scroll animasyonu

## Siteye eklerken (Claude Code notu)

1. `<head>` içine `arma-mix-twin.html` dosyasındaki **import map**'i olduğu gibi kopyalayın
   (sürüm/hash değiştirmeyin; three.js'in ikinci bir kopyasını yüklemeyin).
2. `#scroller` bloğunu (`#stage` + boşluk div'i), `#copy` bloğunu ve CSS'i sayfaya taşıyın.
   İlerleme, `#scroller`ın kendi konumundan hesaplanır — blok sayfanın herhangi bir yerinde olabilir.
3. `<script type="module" src="./explode-scene.js"></script>` en sona eklenir.
4. Scroll uzunluğu: `#scroller` içindeki `height:640vh` değeri. Daha yavaş/hızlı animasyon için
   bu değeri değiştirin (min. 400vh önerilir).

## Animasyonun zaman çizelgesi (0 → 1 scroll ilerlemesi)

| aralık | ne olur |
|---|---|
| 0.00–0.14 | montajlı ünite, 3/4 hero açısı |
| 0.14–0.50 | parçalar mil ekseni boyunca kendi yuvalarına kayar (montaj sırasına göre kademeli) |
| 0.17–0.74 | anlatılan gruba göre etiketler ve hafif kamera odağı (tahrik → sızdırmazlık → mil) |
| 0.74–0.94 | aynı yolun tersinden geri montaj |
| 0.86–1.00 | pervaneler dönmeye başlar |

## Parçalar

Model `buildAgitator()` içinde tanımlı; her parça bir `THREE.Group` ve her mesh/materyal adlandırılmış:
fan kapağı, motor, kaplin muhafazası, tahrik gövdesi, flanş cıvataları, mekanik salmastra,
tavan plakası, destek çubuğu, mil 1, pervane 1, mil kaplini, mil 2, pervane 2.

Ölçüler metre cinsinden ve gerçekçi orandadır (toplam ≈ 5,1 m). Gerçek teknik ölçüleriniz varsa
`agitator-model.js` içindeki değerleri değiştirmek yeterli; patlatma düzeni parçaların
gerçek boyundan otomatik hesaplanır.

## Ayar noktaları

- `RADIAL` / `GAP` (explode-scene.js): patlatma aralığı ve eksen dışı kaydırmalar
- `fill` değeri: modelin ekranı ne kadar dolduracağı
- `camera.setViewOffset(...)`: soldaki metin sütunu için modeli sağa kaydırma miktarı
- `MAT` (agitator-model.js): renk/pürüzlülük — kurumsal kırmızı `#c0141c`
