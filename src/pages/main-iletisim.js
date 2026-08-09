import { initFadeIn, initThemeToggle, initSiteSearch, initCardSpotlight, initMobileNav } from '../common.js';
import { initI18n, initLangSwitcher } from '../i18n.js';

await initI18n();
initLangSwitcher();
initFadeIn();
initThemeToggle();
initSiteSearch();
initMobileNav();
initCardSpotlight();

/* No backend on this static site, so the form composes a real email
   in the visitor's own mail client instead of pretending to submit
   somewhere. */
const form = document.getElementById('contact-mail-form');
form?.addEventListener('submit', (e) => {
  e.preventDefault();
  const data = new FormData(form);
  const name = data.get('name') || '';
  const email = data.get('email') || '';
  const subject = data.get('subject') || 'Teklif Talebi';
  const message = data.get('message') || '';
  const body = `Ad Soyad: ${name}\nE-posta: ${email}\n\n${message}`;
  window.location.href = `mailto:info@ionaengineering.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
});
