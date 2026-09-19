/* Canvas-based client-side compression — no external dependency (browser-image-compression
   etc.) needed since createImageBitmap + canvas.toBlob cover resize+webp encode natively in
   every browser this site targets. Runs before any upload leaves the browser so a 10MB photo
   never touches the network or Supabase Storage at full size. */

const MAIN_MAX_DIMENSION = 1920;
const MAIN_QUALITY = 0.82;
const THUMB_MAX_DIMENSION = 350;
const THUMB_QUALITY = 0.7;
const WEBP_MIME = 'image/webp';

/* SVG is vector — rasterizing it into a webp would throw away resolution independence for a
   format that's already tiny, so it always passes through uncompressed. */
export function isCompressible(file) {
  return file.type !== 'image/svg+xml';
}

async function loadBitmap(file) {
  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(file);
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error('Görsel okunamadı.'));
      img.src = url;
    });
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function drawToCanvas(source, maxDimension) {
  const sourceWidth = source.width;
  const sourceHeight = source.height;
  const scale = Math.min(1, maxDimension / Math.max(sourceWidth, sourceHeight));
  const width = Math.round(sourceWidth * scale);
  const height = Math.round(sourceHeight * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(source, 0, 0, width, height);
  return canvas;
}

function canvasToWebpBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('WebP dönüştürme başarısız.'))),
      WEBP_MIME,
      quality
    );
  });
}

function withWebpName(fileName) {
  const dot = fileName.lastIndexOf('.');
  const base = dot > 0 ? fileName.slice(0, dot) : fileName;
  return `${base}.webp`;
}

/* Resizes to fit within maxDimension x maxDimension and re-encodes as WebP at quality.
   Returns a File (not just a Blob) so callers can keep treating it like the original upload. */
async function toWebpFile(file, maxDimension, quality, suffix = '') {
  const bitmap = await loadBitmap(file);
  const canvas = drawToCanvas(bitmap, maxDimension);
  if (bitmap.close) bitmap.close();
  const blob = await canvasToWebpBlob(canvas, quality);
  const name = withWebpName(file.name).replace(/\.webp$/, `${suffix}.webp`);
  return new File([blob], name, { type: WEBP_MIME });
}

/* Main asset: max 1920px, quality 0.82 — shrinks a multi-MB photo down to roughly 250-400KB
   while staying visually lossless at typical display sizes. */
export function compressMain(file) {
  return toWebpFile(file, MAIN_MAX_DIMENSION, MAIN_QUALITY);
}

/* Grid thumbnail: max 350px, quality 0.7 — ~20KB, used everywhere the image appears as a
   picker/library card so the grid never has to pull full-res bytes just to render a preview. */
export function compressThumbnail(file) {
  return toWebpFile(file, THUMB_MAX_DIMENSION, THUMB_QUALITY, '_thumb');
}

/* Runs both passes off the same source file. If compression fails for any reason (corrupt
   image, browser lacking canvas support), callers fall back to the original file rather than
   blocking the upload entirely. */
export async function compressForUpload(file) {
  if (!isCompressible(file)) return { main: file, thumb: null };
  try {
    const [main, thumb] = await Promise.all([compressMain(file), compressThumbnail(file)]);
    return { main, thumb };
  } catch (e) {
    console.warn('[IONA Admin] Görsel sıkıştırma başarısız, orijinal dosya yükleniyor:', e.message);
    return { main: file, thumb: null };
  }
}
