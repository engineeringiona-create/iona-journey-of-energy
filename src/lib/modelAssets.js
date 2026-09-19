/* 3D modellerin nereden indirileceğini tek yerden çözen yardımcı.

   Varsayılan davranış değişmedi: model `/models/<dosya>` yolundan, yani
   sitenin kendi origin'inden (public/models/) gelir.

   `VITE_MODEL_BUCKET` tanımlanırsa model Supabase Storage'ın public
   CDN'inden çekilir:

     https://<proje>.supabase.co/storage/v1/object/public/<bucket>/<dosya>

   Neden ayrı bir env değişkeni de, tek başına VITE_SUPABASE_URL yetmiyor:
   Supabase bu projede admin paneli/içerik için zaten yapılandırılabiliyor.
   Bucket adı ayrıca istenmezse, DB için girilen bir URL yüzünden model
   birdenbire var olmayan bir bucket'tan aranmaya başlardı. Bucket'ı açıkça
   yazmak, "modeli CDN'den servis et" kararını bilinçli bir tercih yapıyor.

   Tam URL'i elle vermek isteyen (Supabase dışı bir CDN, özel domain,
   imzalı yol) `VITE_MODEL_BUCKET_URL` ile base URL'i doğrudan yazabilir;
   bu değişken diğer ikisini ezer.

   Dosyalar public/models/ altında DURMAYA DEVAM EDER ve yedek yoldur:
   uzak istek hata verirse GltfTwinScene yerel kopyaya düşer (bkz. oradaki
   fallBackToLocalModel). Yani CDN kapansa bile ana sayfa modelsiz kalmaz. */

export const LOCAL_MODEL_BASE = '/models';

function env(name) {
  const v = import.meta.env[name];
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

function stripTrailingSlash(url) {
  return url.replace(/\/+$/, '');
}

/* Uzak base URL, yapılandırılmadıysa null. */
export function remoteModelBase() {
  const explicit = env('VITE_MODEL_BUCKET_URL');
  if (explicit) return stripTrailingSlash(explicit);

  const bucket = env('VITE_MODEL_BUCKET');
  const supabaseUrl = env('VITE_SUPABASE_URL');
  if (!bucket || !supabaseUrl) return null;

  return `${stripTrailingSlash(supabaseUrl)}/storage/v1/object/public/${bucket}`;
}

/* public/models/ altındaki kopyanın yolu — her zaman vardır. */
export function localModelUrl(file) {
  return `${LOCAL_MODEL_BASE}/${file}`;
}

/* Yapılandırılmışsa uzak kopya, değilse yerel kopya. */
export function modelUrl(file) {
  const base = remoteModelBase();
  return base ? `${base}/${file}` : localModelUrl(file);
}

/* Uzak origin — <link rel="preconnect"> için. Yerel servis ediliyorsa null. */
export function remoteModelOrigin() {
  const base = remoteModelBase();
  if (!base) return null;
  try {
    return new URL(base).origin;
  } catch (e) {
    console.warn('[IONA] Model CDN adresi çözümlenemedi:', base, e.message);
    return null;
  }
}
