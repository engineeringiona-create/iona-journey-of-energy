/* Sitedeki her HTML sayfası admin editörünün sayfa listesinde (src/lib/pages.js)
   olmalı. Olmazsa sayfa editörde hiç görünmez ve admin'den girilen içerik o
   sayfada sessizce uygulanmaz — IonaFlux (2026-09) ve hizmet sayfaları
   (2026-11) bu yüzden aylarca düzenlenemedi. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { PAGES, pageIdForPath, isSharedKey, SHARED_ROW_ID } from '../src/lib/pages.js';

const root = new URL('..', import.meta.url);
const htmlFiles = [
  ...readdirSync(root).filter((f) => f.endsWith('.html')).map((f) => `/${f}`),
  ...readdirSync(new URL('hizmetler/', root)).filter((f) => f.endsWith('.html')).map((f) => `/hizmetler/${f}`)
].filter((p) => p !== '/admin.html');

test('her sayfa editörün sayfa listesinde', () => {
  const missing = htmlFiles.filter((p) => !pageIdForPath(p));
  assert.deepEqual(missing, [], `src/lib/pages.js PAGES listesine eklenmeli: ${missing.join(', ')}`);
});

test('dil önekli adres de aynı satırı bulur', () => {
  assert.equal(pageIdForPath('/en/hizmetler/mikro-orc.html'), 'hizmet-mikro-orc');
  assert.equal(pageIdForPath('/de/'), 'home');
});

test('sayfa kimlikleri benzersiz ve ortak satırla çakışmıyor', () => {
  const ids = PAGES.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(!ids.includes(SHARED_ROW_ID));
});

test('yalnız site. önekli anahtarlar ortak', () => {
  assert.ok(isSharedKey('site.phone'));
  assert.ok(!isSharedKey('common.explore_cta'));
  assert.ok(!isSharedKey('footer.copyright'));
});
