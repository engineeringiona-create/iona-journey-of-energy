import * as THREE from 'three';

/* ---------------------------------------------------------------
   Prosedürel yüzey dokuları — hepsi canvas'ta üretilir, harici
   dosya yok. Amaç: boya portakal kabuğu, kum döküm grenli demir,
   fırçalanmış çelik yönlü izleri ve okunur etiket/plaka yazıları.
---------------------------------------------------------------- */

function cv(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

/* çok oktavlı yumuşak gürültü → yükseklik alanı (grayscale canvas) */
function valueNoise(size, octaves, base) {
  const c = cv(size, size), x = c.getContext('2d');
  x.fillStyle = '#808080'; x.fillRect(0, 0, size, size);
  x.globalCompositeOperation = 'lighter';
  for (let o = 0; o < octaves; o++) {
    const n = base << o;                       // oktav çözünürlüğü
    const s = cv(n, n), sx = s.getContext('2d');
    const img = sx.createImageData(n, n);
    for (let i = 0; i < n * n; i++) {
      const v = Math.random() * 255;
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = Math.round(255 / (o + 1.6));
    }
    sx.putImageData(img, 0, 0);
    x.imageSmoothingEnabled = true;
    x.drawImage(s, 0, 0, size, size);
  }
  x.globalCompositeOperation = 'source-over';
  return c;
}

/* yükseklik alanından normal map */
function normalFrom(heightCanvas, strength) {
  const w = heightCanvas.width, h = heightCanvas.height;
  const src = heightCanvas.getContext('2d').getImageData(0, 0, w, h).data;
  const out = cv(w, h), ox = out.getContext('2d');
  const img = ox.createImageData(w, h);
  const H = (i, j) => src[((j + h) % h * w + (i + w) % w) * 4] / 255;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const dx = (H(i + 1, j) - H(i - 1, j)) * strength;
    const dy = (H(i, j + 1) - H(i, j - 1)) * strength;
    let nx = -dx, ny = -dy, nz = 1;
    const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    const k = (j * w + i) * 4;
    img.data[k] = (nx * 0.5 + 0.5) * 255;
    img.data[k + 1] = (ny * 0.5 + 0.5) * 255;
    img.data[k + 2] = (nz * 0.5 + 0.5) * 255;
    img.data[k + 3] = 255;
  }
  ox.putImageData(img, 0, 0);
  return out;
}

function tex(canvas, repeat, linear = true) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.colorSpace = linear ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/* ---- 1. fabrika boyası: ince portakal kabuğu ---- */
export function orangePeel(repeat = 3) {
  const height = valueNoise(256, 3, 24);
  const n = tex(normalFrom(height, 1.6), repeat);
  const r = cv(256, 256), rx = r.getContext('2d');
  rx.drawImage(height, 0, 0);
  rx.globalAlpha = 0.55; rx.fillStyle = '#6e6e6e'; rx.fillRect(0, 0, 256, 256);
  return { normalMap: n, roughnessMap: tex(r, repeat) };
}

/* ---- 2. kum döküm demir/alüminyum greni ---- */
export function sandCast(repeat = 4) {
  const height = valueNoise(256, 4, 48);
  const n = tex(normalFrom(height, 3.4), repeat);
  const r = cv(256, 256), rx = r.getContext('2d');
  rx.drawImage(height, 0, 0);
  rx.globalAlpha = 0.4; rx.fillStyle = '#9a9a9a'; rx.fillRect(0, 0, 256, 256);
  return { normalMap: n, roughnessMap: tex(r, repeat) };
}

/* ---- 3. fırçalanmış paslanmaz: yönlü ince çizikler ---- */
export function brushed(repeat = 2, vertical = false) {
  const size = 512;
  const c = cv(size, size), x = c.getContext('2d');
  x.fillStyle = '#808080'; x.fillRect(0, 0, size, size);
  for (let i = 0; i < 2600; i++) {
    const a = Math.random() * 255;
    x.strokeStyle = `rgba(${a | 0},${a | 0},${a | 0},${0.05 + Math.random() * 0.18})`;
    x.lineWidth = Math.random() < 0.85 ? 1 : 2;
    x.beginPath();
    if (vertical) { const px = Math.random() * size; x.moveTo(px, 0); x.lineTo(px + (Math.random() - 0.5) * 3, size); }
    else { const py = Math.random() * size; x.moveTo(0, py); x.lineTo(size, py + (Math.random() - 0.5) * 3); }
    x.stroke();
  }
  const n = tex(normalFrom(c, vertical ? 0.9 : 0.9), repeat);
  const r = cv(size, size), rx = r.getContext('2d');
  rx.drawImage(c, 0, 0);
  rx.globalAlpha = 0.62; rx.fillStyle = '#4a4a4a'; rx.fillRect(0, 0, size, size);
  return { normalMap: n, roughnessMap: tex(r, repeat) };
}

/* ---- 4. torna/freze izleri: makine işlenmiş yüzey (dairesel) ---- */
export function machined(repeat = 1) {
  const size = 512;
  const c = cv(size, size), x = c.getContext('2d');
  x.fillStyle = '#808080'; x.fillRect(0, 0, size, size);
  for (let i = 0; i < 260; i++) {
    x.strokeStyle = `rgba(255,255,255,${0.02 + Math.random() * 0.05})`;
    x.lineWidth = 1 + Math.random();
    x.beginPath(); x.arc(size / 2, size / 2, 6 + i * 1.0, 0, Math.PI * 2); x.stroke();
  }
  const n = tex(normalFrom(c, 0.7), repeat);
  return { normalMap: n };
}

/* ---- 5. etiket / plaka yazıları ---- */
export function decal(lines, opt = {}) {
  const {
    w = 512, h = 256, bg = 'rgba(0,0,0,0)', color = '#14161a',
    font = '700 96px "Barlow Condensed", Impact, sans-serif',
    align = 'center', border = null, sub = null, subFont = '500 34px "IBM Plex Mono", monospace'
  } = opt;
  const c = cv(w, h), x = c.getContext('2d');
  x.fillStyle = bg; x.fillRect(0, 0, w, h);
  if (border) {
    x.strokeStyle = border; x.lineWidth = 6;
    x.strokeRect(8, 8, w - 16, h - 16);
  }
  x.fillStyle = color;
  x.textAlign = align; x.textBaseline = 'middle';
  const cx = align === 'center' ? w / 2 : 26;
  const arr = [].concat(lines);
  const subArr = sub ? [].concat(sub) : [];
  const total = arr.length + subArr.length;
  const step = h / (total + 0.6);
  let y = step * 0.9;
  x.font = font;
  arr.forEach(t => { x.fillText(t, cx, y); y += step; });
  x.font = subFont;
  x.fillStyle = 'rgba(20,22,26,.78)';
  subArr.forEach(t => { x.fillText(t, cx, y); y += step; });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/* etiket düzlemi: yüzeyin hemen üstünde duran ince plaka */
export function decalPlane(texture, w, h, mat) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat || new THREE.MeshStandardMaterial({
    map: texture, transparent: true, roughness: 0.35, metalness: 0.0,
    polygonOffset: true, polygonOffsetFactor: -4, depthWrite: false
  }));
  if (mat) mat.map = texture;
  m.castShadow = false; m.receiveShadow = false;
  return m;
}
