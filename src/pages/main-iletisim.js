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

/* No real backend on this static site, so the form's primary path is
   still composing an email in the visitor's own mail client. Phase 33
   adds a best-effort Supabase insert alongside it purely so the admin
   Inbox drawer has something to show — it never blocks or delays the
   mailto: fallback, even if Supabase is unreachable or unconfigured. */
const form = document.getElementById('contact-mail-form');
form?.addEventListener('submit', (e) => {
  e.preventDefault();
  const data = new FormData(form);
  const name = data.get('name') || '';
  const email = data.get('email') || '';
  const subject = data.get('subject') || 'Teklif Talebi';
  const message = data.get('message') || '';

  const supabase = getSupabase();
  if (supabase) {
    supabase.from('contact_submissions').insert({ name, email, subject, message }).then(({ error }) => {
      if (error) console.warn('[IONA] Gelen kutusuna kayıt başarısız:', error.message);
    });
  }

  const body = `Ad Soyad: ${name}\nE-posta: ${email}\n\n${message}`;
  window.location.href = `mailto:info@ionaengineering.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
});
