import { initFadeIn, initThemeToggle, initSiteSearch, initMobileNav } from '../common.js';
import { initI18n, initLangSwitcher } from '../i18n.js';
import { initQuoteModal } from '../lib/quoteModal.js';
import { getSupabase } from '../lib/supabaseClient.js';
import { readLocalBucket } from '../lib/adminStore.js';

await initI18n();
initLangSwitcher();
initQuoteModal();
initFadeIn();
initThemeToggle();
initSiteSearch();
initMobileNav();

async function loadAnnouncements() {
  const supabase = getSupabase();
  if (!supabase) return readLocalBucket('announcements')?.list || [];
  try {
    const { data, error } = await supabase.from('site_content').select('content').eq('id', 'announcements').maybeSingle();
    if (error || !data) return [];
    return data.content?.list || [];
  } catch (e) {
    return [];
  }
}

function escapeHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function cardHtml(a) {
  const bannerHtml = a.bannerImage
    ? `<img src="${a.bannerImage}" alt="" class="w-full h-44 object-cover">`
    : `<div class="w-full h-44 bg-[var(--surface-2)]"></div>`;
  return `
    <button type="button" class="text-left rounded-2xl overflow-hidden bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--border-strong)] transition-colors duration-300 flex flex-col" data-announcement-card>
      ${bannerHtml}
      <div class="p-6 flex flex-col gap-2">
        ${a.category ? `<span class="font-label-caps text-[11px] font-bold tracking-[0.08em] text-[var(--brand-orange)]">${escapeHtml(a.category)}</span>` : ''}
        ${a.date ? `<span class="text-[12px] text-[var(--text-muted)]">${escapeHtml(a.date)}</span>` : ''}
        <h3 class="font-headline-md text-headline-md">${escapeHtml(a.title)}</h3>
        <p class="text-body-md text-[var(--text-muted)] line-clamp-3">${escapeHtml((a.description || '').slice(0, 160))}${(a.description || '').length > 160 ? '…' : ''}</p>
      </div>
    </button>
  `;
}

function modalHtml(a) {
  const bannerHtml = a.bannerImage ? `<img src="${a.bannerImage}" alt="" class="w-full h-56 object-cover">` : '';
  const ctaHtml = a.ctaEnabled
    ? `<a href="${a.ctaLink || '#'}" class="inline-block font-label-caps text-[13px] font-bold tracking-[0.08em] bg-[var(--brand-orange)] text-white px-6 py-3 rounded-full hover:brightness-110 transition-all duration-300">${escapeHtml(a.ctaText || 'Kayıt Ol / Detaylar')}</a>`
    : '';
  return `
    ${bannerHtml}
    <div class="p-8">
      <button type="button" class="float-right text-[var(--text-muted)] hover:text-[var(--text)] text-[20px] leading-none" data-announcement-close>×</button>
      ${a.category ? `<span class="font-label-caps text-[11px] font-bold tracking-[0.08em] text-[var(--brand-orange)] block mb-2">${escapeHtml(a.category)}</span>` : ''}
      <h2 class="font-headline-lg text-headline-lg mb-2">${escapeHtml(a.title)}</h2>
      ${a.date ? `<p class="text-[13px] text-[var(--text-muted)] mb-4">${escapeHtml(a.date)}</p>` : ''}
      <p class="text-body-md text-[var(--text-muted)] whitespace-pre-wrap mb-6">${escapeHtml(a.description)}</p>
      ${ctaHtml}
    </div>
  `;
}

const grid = document.getElementById('announcements-grid');
const empty = document.getElementById('announcements-empty');
const modal = document.getElementById('announcement-modal');
const modalCard = document.getElementById('announcement-modal-card');

function openModal(a) {
  modalCard.innerHTML = modalHtml(a);
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  modalCard.querySelector('[data-announcement-close]')?.addEventListener('click', closeModal);
}

function closeModal() {
  modal.classList.add('hidden');
  modal.classList.remove('flex');
  modalCard.innerHTML = '';
}

document.getElementById('announcement-modal-backdrop')?.addEventListener('click', closeModal);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

const list = await loadAnnouncements();
if (list.length === 0) {
  empty.classList.remove('hidden');
} else {
  grid.innerHTML = list.map(cardHtml).join('');
  grid.querySelectorAll('[data-announcement-card]').forEach((el, i) => {
    el.addEventListener('click', () => openModal(list[i]));
  });
}
