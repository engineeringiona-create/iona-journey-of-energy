/* Form gönderimi sonrası onay kartı — TEK kaynak.
 *
 * İki yerde kullanılıyor: teklif modalı (src/lib/quoteModal.js, sitedeki her
 * "Teklif Alın" düğmesi ve ana sayfadaki enerji hesaplayıcı buraya çıkıyor) ve
 * iletişim sayfasının kendi formu (src/pages/main-iletisim.js).
 *
 * Neden ortak: 2026-09-19'a kadar ikisi ayrı ayrı yazılmıştı ve tamamen farklı
 * görünüyorlardı — teklif akışı krem zeminli, yumuşak köşeli, editoryal bir
 * kart; iletişim formu ise koyu cam bir panel, turuncu düğme ve radial parlama
 * efektleriyle bambaşka bir dünya. Aynı işi yapan iki ekranın aynı görünmemesi
 * için bir sebep yok; ikisi de artık buradan geliyor, biri değişince öbürü de
 * değişiyor.
 *
 * Kart, kaplamanın (overlay) TAMAMINI devralır: küçük bir kartın içindeki
 * içeriği değiştirmek yerine kaplamaya baştan yazar, böylece "fikir değiştiren
 * bir form" gibi değil, kendi başına bir onay ekranı gibi okunur.
 */

/* Renkler ve ölçüler teklif modalının mevcut görünümünden geliyor; DESIGN.md'de
   tanımlı değiller (bkz. TODO.md — modalın kendi paleti). Burada tek nüsha
   olarak durmaları, iki dosyaya dağılmış olmalarından iyi: sistemleştirme
   kararı verildiğinde değiştirilecek tek yer burası. */
const SURFACE = '#fffdf7';
const INK = '#193322';
const INK_MUTED = '#52634f';
const ACCENT = '#3fae66';
const ACTION = '#198837';

/**
 * @param {HTMLElement} overlay  tam ekran kaplama; içeriği tamamen değiştirilir
 * @param {object} opts
 *   title        başlık
 *   body         açıklama
 *   meta         isteğe bağlı küçük satır (referans no, zaman damgası)
 *   primaryLabel ana düğmenin metni
 *   onPrimary    ana düğmeye basılınca (verilmezse close çağrılır)
 *   onClose      kapatma: × düğmesi, Esc ve kaplamaya tıklama
 */
export function renderSuccessCard(overlay, { title, body, meta, primaryLabel, onPrimary, onClose }) {
  overlay.style.background = 'rgba(5,7,6,0.7)';
  overlay.style.padding = '24px';
  overlay.innerHTML = `
    <div style="position:relative;max-width:540px;width:100%;text-align:center;background:${SURFACE};border-radius:28px;padding:40px 28px;">
      <button type="button" data-success-close aria-label="Kapat" style="position:absolute;top:12px;right:12px;width:36px;height:36px;border-radius:50%;background:rgba(25,51,34,0.06);border:1px solid rgba(25,51,34,0.14);color:${INK};font-size:16px;line-height:1;cursor:pointer;">×</button>
      <div style="width:88px;height:88px;border-radius:50%;background:rgba(63,174,102,0.15);border:1px solid rgba(63,174,102,0.3);display:flex;align-items:center;justify-content:center;margin:0 auto 28px;animation:iona-success-pop 450ms ease;">
        <svg width="42" height="42" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M4 12.5L9.5 18L20 6" stroke="${ACCENT}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="30" stroke-dashoffset="30" style="animation:iona-success-draw 550ms ease 200ms forwards;"/>
        </svg>
      </div>
      <h3 style="color:${INK};font-weight:800;font-size:28px;line-height:1.25;margin:0 0 16px;">${title}</h3>
      <p style="color:${INK_MUTED};font-size:15px;line-height:1.65;margin:0 0 ${meta ? '24px' : '32px'};">${body}</p>
      ${meta ? `<p style="color:${INK_MUTED};font-size:12px;letter-spacing:0.04em;margin:0 0 32px;">${meta}</p>` : ''}
      <button type="button" data-success-primary style="background:${ACTION};color:#fff;font-weight:700;font-size:14px;padding:14px 32px;border-radius:999px;border:0;cursor:pointer;">${primaryLabel}</button>
    </div>
    <style>
      @keyframes iona-success-pop { from { transform: scale(0.6); opacity: 0; } to { transform: scale(1); opacity: 1; } }
      @keyframes iona-success-draw { to { stroke-dashoffset: 0; } }
      /* Hareketi azalt tercihinde işaret yerinde ve çizili durur — onayın
         kendisi kaybolmaz, yalnızca animasyonu kalkar. */
      @media (prefers-reduced-motion: reduce) {
        [style*="iona-success-pop"], [style*="iona-success-draw"] { animation: none !important; }
        svg path[stroke-dasharray] { stroke-dashoffset: 0 !important; }
      }
    </style>
  `;

  const primary = overlay.querySelector('[data-success-primary]');
  primary.addEventListener('click', () => (onPrimary ? onPrimary() : onClose()));
  overlay.querySelector('[data-success-close]').addEventListener('click', onClose);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) onClose(); });
  primary.focus();
}
