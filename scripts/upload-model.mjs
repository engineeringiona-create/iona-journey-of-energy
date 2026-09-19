#!/usr/bin/env node
/* GLB'leri Supabase Storage'a yükler ve sitenin okuyacağı public URL'i basar.
 *
 *   npm run model:upload                 # varsayılan model(ler)
 *   npm run model:upload -- a.glb b.glb  # belirli dosyalar
 *
 * Gerekli ortam değişkenleri (.env dosyasından da okunur):
 *   SUPABASE_URL               (yoksa VITE_SUPABASE_URL kullanılır)
 *   SUPABASE_SERVICE_ROLE_KEY  bucket açmak ve yazmak için — anon key YETMEZ
 *   MODEL_BUCKET               (opsiyonel, varsayılan "models")
 *
 * service_role anahtarı RLS'i tamamen atlar; bu yüzden yalnızca burada,
 * yani senin makinende/CI'da çalışan bir Node scriptinde kullanılıyor.
 * Tarayıcıya giden hiçbir koda (VITE_* önekli hiçbir değişkene) konulmamalı.
 *
 * Yükleme upsert ile yapılır: aynı adla tekrar çalıştırmak modeli günceller,
 * site tarafında hiçbir şey değiştirmeye gerek kalmaz.
 */

import { createClient } from '@supabase/supabase-js';
import { readFile, stat } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = path.resolve(import.meta.dirname, '..');
const DEFAULT_FILES = ['public/models/iona-tesis-3d.draco.glb'];

/* Bir yıl + immutable: dosya adı sabit olduğu için "immutable" iddiası
   ancak upsert ettiğimizde yanlış olur. Bu yüzden immutable YOK, sadece
   uzun max-age: CDN kenarında uzun süre durur ama modeli güncellediğimizde
   Supabase'in kendi cache purge'ü devreye girebilir. */
const CACHE_CONTROL = '31536000';
const CONTENT_TYPE = 'model/gltf-binary';

function loadDotEnv() {
  const envPath = path.join(ROOT, '.env');
  if (!existsSync(envPath)) return;
  for (const raw of readFileSync(envPath, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    /* Kabukta zaten tanımlıysa .env onu ezmesin. */
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function die(message) {
  console.error(`\n  HATA: ${message}\n`);
  process.exit(1);
}

async function main() {
  loadDotEnv();

  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.MODEL_BUCKET || 'models';

  if (!url) die('SUPABASE_URL (veya VITE_SUPABASE_URL) tanımlı değil. .env dosyasına ekleyin.');
  if (!serviceKey) {
    die(
      'SUPABASE_SERVICE_ROLE_KEY tanımlı değil.\n' +
        '  Supabase panelinde Project Settings > API > service_role anahtarı.\n' +
        '  Bu anahtar .env içinde kalmalı, asla VITE_ önekiyle tanımlanmamalı.'
    );
  }

  const files = (process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_FILES).map((f) =>
    path.resolve(ROOT, f)
  );

  for (const file of files) {
    if (!existsSync(file)) die(`Dosya bulunamadı: ${file}`);
  }

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

  /* Bucket yoksa aç. Zaten varsa createBucket 409 döner — hata değil,
     beklenen durum; "public mi" kontrolünü ayrıca yapıyoruz çünkü private
     bir bucket'tan gelen public URL sessizce 400 döner ve site fallback'e
     düşer (yani "çalışıyor gibi" görünür, aslında CDN hiç kullanılmıyordur). */
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) die(`Bucket listesi alınamadı: ${listError.message}`);

  const existing = buckets.find((b) => b.name === bucket);
  if (!existing) {
    /* fileSizeLimit BİLEREK verilmiyor: bucket'a proje genelindeki limitten
       büyük bir değer yazmak "The object exceeded the maximum allowed size"
       ile reddediliyor (ücretsiz planda global limit 50 MB) ve bu hata,
       yükleyeceğimiz 0,7 MB'lık dosyayla hiç ilgisi olmadığı için yanıltıcı.
       Belirtmeyince bucket projenin kendi limitini devralıyor — hangi planda
       olursak olalım doğru davranış. */
    const { error } = await supabase.storage.createBucket(bucket, {
      public: true,
      allowedMimeTypes: [CONTENT_TYPE, 'application/octet-stream']
    });
    if (error) die(`"${bucket}" bucket'ı oluşturulamadı: ${error.message}`);
    console.log(`  + "${bucket}" bucket'ı oluşturuldu (public).`);
  } else if (!existing.public) {
    const { error } = await supabase.storage.updateBucket(bucket, { public: true });
    if (error) {
      die(
        `"${bucket}" bucket'ı private ve public yapılamadı: ${error.message}\n` +
          '  Public olmadan siteden okunamaz.'
      );
    }
    console.log(`  ~ "${bucket}" bucket'ı public yapıldı.`);
  } else {
    console.log(`  = "${bucket}" bucket'ı mevcut (public).`);
  }

  for (const file of files) {
    const name = path.basename(file);
    const body = await readFile(file);
    const { size } = await stat(file);

    const { error } = await supabase.storage.from(bucket).upload(name, body, {
      contentType: CONTENT_TYPE,
      cacheControl: CACHE_CONTROL,
      upsert: true
    });
    if (error) die(`${name} yüklenemedi: ${error.message}`);

    const { data } = supabase.storage.from(bucket).getPublicUrl(name);

    /* Yükleme "başarılı" dedi diye okunabildiğini varsaymıyoruz — public
       URL'i gerçekten çekip doğruluyoruz. Private bucket / yanlış MIME gibi
       durumlar tam burada yakalanır, aylar sonra sitede değil. */
    let check = '';
    try {
      const res = await fetch(data.publicUrl, { method: 'HEAD' });
      check = res.ok
        ? `doğrulandı (HTTP ${res.status}, ${res.headers.get('content-length') || '?'} bayt)`
        : `UYARI: public URL HTTP ${res.status} döndü`;
    } catch (e) {
      check = `UYARI: public URL denenemedi (${e.message})`;
    }

    console.log(`  ↑ ${name}  ${(size / 1024 / 1024).toFixed(2)} MB  — ${check}`);
    console.log(`    ${data.publicUrl}`);
  }

  console.log(
    '\n  Siteye bağlamak için .env dosyasına (ve Railway ortam değişkenlerine):\n' +
      `    VITE_SUPABASE_URL=${url}\n` +
      `    VITE_MODEL_BUCKET=${bucket}\n` +
      '\n  VITE_MODEL_BUCKET tanımlı değilse site modeli eskisi gibi\n' +
      '  public/models/ altından yükler — hiçbir şey kırılmaz.\n'
  );
}

main().catch((e) => die(e.stack || e.message));
