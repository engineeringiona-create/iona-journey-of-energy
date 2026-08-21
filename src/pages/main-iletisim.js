import { initFadeIn, initThemeToggle, initSiteSearch, initCardSpotlight, initMobileNav } from '../common.js';
import { initI18n, initLangSwitcher } from '../i18n.js';
import { initQuoteModal } from '../lib/quoteModal.js';
import { getSupabase } from '../lib/supabaseClient.js';

await initI18n();
initLangSwitcher();
initQuoteModal();
initFadeIn();
initThemeToggle();
initSiteSearch();
initMobileNav();
initCardSpotlight();

/* Submits straight into contact_submissions — no more mailto: handoff
   (visitors used to get bounced into their mail app on submit, which
   read as broken more often than it read as "your message is on its
   way"). Success shows a full-screen opaque confirmation (no card, no
   button — it fades itself out after a few seconds) instead. */
const form = document.getElementById('contact-mail-form');
form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = new FormData(form);
  const name = data.get('name') || '';
  const email = data.get('email') || '';
  const subject = data.get('subject') || 'Teklif Talebi';
  const message = data.get('message') || '';

  const supabase = getSupabase();
  if (!supabase) return;

  const { error } = await supabase.from('contact_submissions').insert({ name, email, subject, message, is_read: false });
  if (error) {
    console.warn('[IONA] Gelen kutusuna kayıt başarısız:', error.message);
    return;
  }

  form.reset();
  showConfirmationOverlay();
});

function showConfirmationOverlay() {
  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.zIndex = '95';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.textAlign = 'center';
  overlay.style.padding = '24px';
  overlay.style.background = 'radial-gradient(circle at 20% 15%, rgba(34,112,60,0.4), transparent 55%), radial-gradient(circle at 85% 85%, rgba(255,117,31,0.3), transparent 50%), #0b0f0c';
  overlay.style.opacity = '0';
  overlay.style.transition = 'opacity 500ms ease';
  overlay.innerHTML = `
    <div style="max-width:480px;">
      <div style="width:88px;height:88px;border-radius:50%;background:rgba(63,174,102,0.15);border:1px solid rgba(63,174,102,0.3);display:flex;align-items:center;justify-content:center;margin:0 auto 28px;">
        <svg width="42" height="42" viewBox="0 0 24 24" fill="none">
          <path d="M4 12.5L9.5 18L20 6" stroke="#3fae66" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <h3 style="color:#fff;font-weight:800;font-size:26px;line-height:1.25;margin:0 0 14px;">Teklif Talebiniz Onaylandı!</h3>
      <p style="color:rgba(255,255,255,0.65);font-size:15px;line-height:1.65;margin:0;">Uzman mühendislik ekibimiz mesajınızı aldı, en kısa sürede sizinle iletişime geçeceğiz.</p>
    </div>
  `;

  document.body.appendChild(overlay);
  requestAnimationFrame(() => { overlay.style.opacity = '1'; });

  setTimeout(() => {
    overlay.style.opacity = '0';
    overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
  }, 3200);
}
