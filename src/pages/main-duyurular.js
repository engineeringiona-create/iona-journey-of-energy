import { initFadeIn, initThemeToggle, initSiteSearch, initMobileNav, initSmoothScroll } from '../common.js';
import { initI18n, initLangSwitcher } from '../i18n.js';
import { initQuoteModal } from '../lib/quoteModal.js';
import { getSupabase } from '../lib/supabaseClient.js';
import { readLocalBucket } from '../lib/adminStore.js';
import { openAnnouncementModal } from '../lib/announcements.js';

await initI18n();
initSmoothScroll();
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

const grid = document.getElementById('announcements-grid');
const empty = document.getElementById('announcements-empty');

const list = await loadAnnouncements();
if (list.length === 0) {
  empty.classList.remove('hidden');
} else {
  grid.innerHTML = list.map(cardHtml).join('');
  grid.querySelectorAll('[data-announcement-card]').forEach((el, i) => {
    el.addEventListener('click', () => openAnnouncementModal(list, i));
  });
}
