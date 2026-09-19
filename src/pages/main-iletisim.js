import { initFadeIn, initThemeToggle, initSiteSearch, initCardSpotlight, initMobileNav, initSmoothScroll, initPageCurtain, initFooterCurve, initDnaScroll } from '../common.js';
import { initI18n, initLangSwitcher } from '../i18n.js';
import { initQuoteModal } from '../lib/quoteModal.js';
import { getSupabase } from '../lib/supabaseClient.js';
import { renderSuccessCard } from '../lib/successCard.js';

await initI18n();
initSmoothScroll();
initPageCurtain();
initFooterCurve();
initLangSwitcher();
initQuoteModal();
initFadeIn();
initThemeToggle();
initSiteSearch();
initMobileNav();
initDnaScroll();
initCardSpotlight();

/* Phase 42: submits straight into contact_submissions — no more mailto:
   handoff (visitors used to get bounced into their mail app on submit,
   which read as broken more often than it read as "your message is on
   its way"). stopPropagation alongside preventDefault since this form
   sits inside a fade-in-section whose own click/scroll wiring shouldn't
   see the submit bubble past it. Success is the shared confirmation card
   (src/lib/successCard.js) the visitor dismisses themselves, which is also
   what resets the form — not the insert succeeding — so a visitor who
   wants to screenshot their submitted values before closing still can. */
const form = document.getElementById('contact-mail-form');
form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  e.stopPropagation();

  const submitBtn = form.querySelector('button[type="submit"]');
  const submitLabel = submitBtn?.querySelector('[data-i18n="contact.form.submit"]');
  const originalLabel = submitLabel?.textContent;

  const data = new FormData(form);
  const name = (data.get('name') || '').toString().trim();
  const email = (data.get('email') || '').toString().trim();
  const phone = (data.get('phone') || '').toString().trim();
  const message = (data.get('message') || '').toString().trim();
  const payload = { name, email, phone, message, page_source: 'iletisim', is_read: false };
  console.log('Submitting contact form:', payload);

  const supabase = getSupabase();
  if (!supabase) return;

  if (submitBtn) submitBtn.disabled = true;
  if (submitLabel) submitLabel.textContent = 'Gönderiliyor...';

  const { error } = await supabase.from('contact_submissions').insert([payload]);

  if (submitBtn) submitBtn.disabled = false;
  if (submitLabel && originalLabel) submitLabel.textContent = originalLabel;

  if (error) {
    console.error('Submission failed:', error);
    return;
  }

  showConfirmationOverlay(form);
});

/* Onay kartı artık teklif akışıyla AYNI: src/lib/successCard.js.
   Önceden burada koyu cam bir panel, radial parlamalar ve turuncu bir düğme
   vardı; teklif modalı ise krem zeminli editoryal bir kart gösteriyordu. Aynı
   işi yapan iki ekranın iki ayrı dünyada olmasının bir sebebi yoktu.
   Buradaki fark yalnızca metinler ve kapanışta formun sıfırlanması. */
function showConfirmationOverlay(form) {
  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 z-[99999] flex items-center justify-center';
  document.body.appendChild(overlay);

  function close() {
    overlay.remove();
    form.reset();
    document.removeEventListener('keydown', onKeydown);
  }
  function onKeydown(e) { if (e.key === 'Escape') close(); }
  document.addEventListener('keydown', onKeydown);

  renderSuccessCard(overlay, {
    title: 'Mesajınız Başarıyla İletildi!',
    body: 'Uzman mühendislik ekibimiz bilgilerinizi inceleyip en kısa sürede sizinle iletişime geçecektir.',
    primaryLabel: 'Tamam / Kapat',
    onClose: close
  });
}
