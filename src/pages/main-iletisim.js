import { initFadeIn, initThemeToggle, initSiteSearch, initCardSpotlight, initMobileNav, initSmoothScroll } from '../common.js';
import { initI18n, initLangSwitcher } from '../i18n.js';
import { initQuoteModal } from '../lib/quoteModal.js';
import { getSupabase } from '../lib/supabaseClient.js';

await initI18n();
initSmoothScroll();
initLangSwitcher();
initQuoteModal();
initFadeIn();
initThemeToggle();
initSiteSearch();
initMobileNav();
initCardSpotlight();

/* Phase 42: submits straight into contact_submissions — no more mailto:
   handoff (visitors used to get bounced into their mail app on submit,
   which read as broken more often than it read as "your message is on
   its way"). stopPropagation alongside preventDefault since this form
   sits inside a fade-in-section whose own click/scroll wiring shouldn't
   see the submit bubble past it. Success is a full-screen liquid-glass
   card the visitor dismisses themselves (Tamam / Kapat), which is also
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

function showConfirmationOverlay(form) {
  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 z-[99999] flex items-center justify-center p-6 backdrop-blur-xl bg-slate-950/85';
  overlay.innerHTML = `
    <div class="pointer-events-none absolute -top-32 -left-24 w-[420px] h-[420px] rounded-full opacity-60" style="background:radial-gradient(circle,rgba(63,174,102,0.35),transparent 70%)" aria-hidden="true"></div>
    <div class="pointer-events-none absolute -bottom-32 -right-24 w-[420px] h-[420px] rounded-full opacity-50" style="background:radial-gradient(circle,rgba(255,183,61,0.3),transparent 70%)" aria-hidden="true"></div>
    <div class="relative max-w-md w-full rounded-3xl border border-emerald-400/30 bg-slate-900/80 p-10 text-center shadow-[0_0_60px_-10px_rgba(63,174,102,0.35)]">
      <div class="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-emerald-400/40 bg-emerald-500/10" style="animation:iona-cf-pop 450ms ease;">
        <svg width="38" height="38" viewBox="0 0 24 24" fill="none">
          <path d="M4 12.5L9.5 18L20 6" stroke="#3fae66" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="30" stroke-dashoffset="30" style="animation:iona-cf-draw 550ms ease 150ms forwards;"/>
        </svg>
      </div>
      <h3 class="mb-3 text-2xl font-extrabold text-white">Mesajınız Başarıyla İletildi!</h3>
      <p class="mb-8 text-[15px] leading-relaxed text-white/65">Uzman mühendislik ekibimiz bilgilerinizi inceleyip en kısa sürede sizinle iletişime geçecektir.</p>
      <button type="button" id="iona-cf-close" class="rounded-full bg-[var(--brand-orange,#ff751f)] px-8 py-3 text-[13px] font-bold text-white transition hover:brightness-110">Tamam / Kapat</button>
    </div>
    <style>
      @keyframes iona-cf-pop { from { transform: scale(0.6); opacity: 0; } to { transform: scale(1); opacity: 1; } }
      @keyframes iona-cf-draw { to { stroke-dashoffset: 0; } }
    </style>
  `;
  document.body.appendChild(overlay);

  function close() {
    overlay.remove();
    form.reset();
    document.removeEventListener('keydown', onKeydown);
  }
  function onKeydown(e) { if (e.key === 'Escape') close(); }
  document.addEventListener('keydown', onKeydown);
  overlay.querySelector('#iona-cf-close').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
}
