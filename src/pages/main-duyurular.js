import { initFadeIn, initThemeToggle, initSiteSearch, initMobileNav, initSmoothScroll, initPageCurtain, initFooterCurve, initDnaScroll } from '../common.js';
import { initI18n, initLangSwitcher } from '../i18n.js';
import { initQuoteModal } from '../lib/quoteModal.js';
import { getSupabase } from '../lib/supabaseClient.js';
import { readLocalBucket } from '../lib/adminStore.js';
import { openAnnouncementModal } from '../lib/announcements.js';

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

/* Phase 108: Dezeen/ArchDaily-style editorial magazine layout. index 0
   is the featured article (lg:col-span-8, massive headline/image); every
   other card is a secondary (lg:col-span-4, smaller/punchy). Solid
   bg-white on every card — no backdrop-blur, no transparency — is what
   actually fixes the readability/scroll-lag complaint against the
   .iona-dna-bg watermark behind this page; sharp corners everywhere
   (no rounded-*) for the brutalist grid look; the only hover cost is a
   pure-CSS group-hover:scale-105 on the image, nothing else animates. */
function cardHtml(a, index) {
  const isFeatured = index === 0;
  const bannerHtml = a.bannerImage
    ? `<img src="${a.bannerImage}" alt="" class="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105" loading="lazy" decoding="async">`
    : `<div class="w-full h-full bg-[var(--surface-2)]"></div>`;
  const metaParts = [a.category, a.date].filter(Boolean).map(escapeHtml).join(' &middot; ');
  const metaHtml = metaParts ? `<span class="text-xs uppercase tracking-widest mb-4 block font-bold" style="color:#2d9937">${metaParts}</span>` : '';

  if (isFeatured) {
    return `
      <button type="button" class="group text-left bg-white lg:col-span-8 lg:border-r border-b border-slate-200 p-8 lg:p-12 flex flex-col" data-announcement-card>
        <div class="w-full aspect-video overflow-hidden mb-6">${bannerHtml}</div>
        ${metaHtml}
        <h2 class="text-4xl lg:text-6xl font-bold mb-6 leading-tight">${escapeHtml(a.title)}</h2>
        <p class="text-base text-black/60 max-w-2xl">${escapeHtml((a.description || '').slice(0, 220))}${(a.description || '').length > 220 ? '…' : ''}</p>
      </button>
    `;
  }
  return `
    <button type="button" class="group text-left bg-white lg:col-span-4 border-b border-slate-200 p-6 lg:p-8 flex flex-col" data-announcement-card>
      <div class="w-full aspect-video overflow-hidden mb-4">${bannerHtml}</div>
      ${metaHtml}
      <h3 class="text-2xl font-bold mb-3 leading-tight">${escapeHtml(a.title)}</h3>
      <p class="text-sm text-black/60 line-clamp-3">${escapeHtml((a.description || '').slice(0, 140))}${(a.description || '').length > 140 ? '…' : ''}</p>
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
