import { useCallback, useEffect, useRef, useState } from 'react';
import { getSupabase } from '../../lib/supabaseClient.js';
import { writeLocalContent } from '../../lib/localContent.js';
import { writeLocalImages, clearLocalImages } from '../../lib/imageContent.js';
import { readLocalBucket, writeLocalBucket, clearLocalBucket } from '../../lib/adminStore.js';
import { PAGES, pageIdForPath } from '../../lib/pages.js';
import ImageSettingsModal from './ImageSettingsModal.jsx';
import Toast from './Toast.jsx';
import InboxDrawer from './InboxDrawer.jsx';
import SeoModal from './SeoModal.jsx';
import ThemeModal from './ThemeModal.jsx';
import SectionsPanel from './SectionsPanel.jsx';
import AnnouncementModal from './AnnouncementModal.jsx';
import HistoryDropdown from './HistoryDropdown.jsx';
import HotspotsModal from './HotspotsModal.jsx';
import EventPopupModal from './EventPopupModal.jsx';
import StatsModal from './StatsModal.jsx';

const STYLE_ID = 'iona-admin-editor-style';
const VIEWPORTS = [
  { id: 'desktop', label: 'Masaüstü', width: '100%' },
  { id: 'tablet', label: 'Tablet', width: '768px' },
  { id: 'mobile', label: 'Mobil', width: '390px' }
];
const TOOLS = [
  { id: 'inbox', label: 'Gelen Kutusu', icon: 'mail' },
  { id: 'seo', label: 'SEO', icon: 'travel_explore' },
  { id: 'theme', label: 'Tema', icon: 'palette' },
  { id: 'sections', label: 'Bölümler', icon: 'visibility' },
  { id: 'announcement', label: 'Duyuru Bandı', icon: 'campaign' },
  { id: 'hotspots', label: '3D Bilgi Noktaları', icon: 'view_in_ar' },
  { id: 'eventPopup', label: 'Etkinlik Duyurusu', icon: 'event' },
  { id: 'stats', label: 'İstatistikler', icon: 'bar_chart' },
  { id: 'history', label: 'Geçmiş', icon: 'history' }
];

function injectEditorStyles(doc) {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .iona-edit-mode .iona-admin-editable { outline-offset: 2px; cursor: text; }
    .iona-edit-mode .iona-admin-editable:hover { outline: 1px dashed #10b981; }
    .iona-edit-mode .iona-admin-editable[contenteditable="true"] {
      outline: 2px solid #10b981;
      background: rgba(16, 185, 129, 0.08);
      border-radius: 2px;
    }
    .iona-edit-mode [data-img-key] { pointer-events: auto; cursor: pointer; }
    .iona-edit-mode .iona-admin-image-editable { outline-offset: 2px; }
    .iona-edit-mode .iona-admin-image-editable:hover { outline: 2px dashed #38bdf8; }
    .iona-edit-mode .iona-admin-image-editable.iona-admin-image-active { outline: 2px solid #38bdf8; }
  `;
  doc.head.appendChild(style);
}

/* Theme + announcement live in their own site_content rows (id "theme" /
   "announcement") since they're site-wide, not tied to whichever page is
   currently open in the editor — so they persist independently of the
   page-scoped "Değişiklikleri Kaydet" button, right when their modal closes. */
async function saveGlobalBucket(id, patch) {
  const supabase = getSupabase();
  if (!supabase) {
    writeLocalBucket(id, patch);
    return null;
  }
  const { data: existing } = await supabase.from('site_content').select('content').eq('id', id).maybeSingle();
  const content = { ...(existing?.content || {}), ...patch };
  const { error } = await supabase.from('site_content').upsert({ id, content, updated_at: new Date().toISOString() });
  return error;
}

/* Fire-and-forget: a failed/unreachable revisions insert must never
   block or fail the save the user actually asked for, so this is never
   awaited by its callers — the try/catch just keeps a real network
   rejection (not only a resolved {error}) from surfacing as an
   unhandled promise rejection. */
async function saveRevisionSnapshot(pageId, content) {
  try {
    const supabase = getSupabase();
    if (!supabase) return;
    const { error } = await supabase.from('site_content_revisions').insert({ page_id: pageId, content });
    if (error) console.warn('[IONA Admin] Geçmiş kaydı oluşturulamadı:', error.message);
  } catch (e) {
    console.warn('[IONA Admin] Geçmiş kaydı oluşturulamadı:', e.message);
  }
}

export default function LiveEditor({ onLogout }) {
  const iframeRef = useRef(null);
  const cleanupRef = useRef(null);
  const modeRef = useRef('edit');
  const langRef = useRef('tr');
  const imageElRef = useRef(null);
  const imageOriginalsRef = useRef({});
  const seoOriginalsRef = useRef({});
  const sectionsListRef = useRef([]);
  const [edits, setEdits] = useState({});
  const [imageEdits, setImageEdits] = useState({});
  const [seoEdits, setSeoEdits] = useState({});
  const [sectionEdits, setSectionEdits] = useState({});
  const [themeEdits, setThemeEdits] = useState({});
  const [announcementEdits, setAnnouncementEdits] = useState({});
  const [hotspotsEdits, setHotspotsEdits] = useState({});
  const [eventPopupEdits, setEventPopupEdits] = useState({});
  const [globalSettings, setGlobalSettings] = useState({ theme: {}, announcement: {}, hotspots: {}, eventPopup: {} });
  const [activeImageKey, setActiveImageKey] = useState(null);
  const [imagePosition, setImagePosition] = useState(null);
  const [panel, setPanel] = useState(null);
  const [lang, setLangState] = useState('tr');
  const [selectedPage, setSelectedPage] = useState(PAGES[0].id);
  const [mode, setMode] = useState('edit');
  const [viewport, setViewport] = useState('desktop');
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [toast, setToast] = useState(null);

  const currentPage = PAGES.find((p) => p.id === selectedPage) || PAGES[0];

  const showToast = useCallback((type, message, duration) => setToast({ type, message, duration, id: Date.now() }), []);

  useEffect(() => {
    (async () => {
      const supabase = getSupabase();
      if (!supabase) {
        setGlobalSettings({
          theme: readLocalBucket('theme') || {},
          announcement: readLocalBucket('announcement') || {},
          hotspots: readLocalBucket('hotspots') || {},
          eventPopup: readLocalBucket('eventPopup') || {}
        });
        return;
      }
      const { data } = await supabase
        .from('site_content')
        .select('id,content')
        .in('id', ['theme', 'announcement', 'hotspots', 'eventPopup']);
      setGlobalSettings({
        theme: data?.find((r) => r.id === 'theme')?.content || {},
        announcement: data?.find((r) => r.id === 'announcement')?.content || {},
        hotspots: data?.find((r) => r.id === 'hotspots')?.content || {},
        eventPopup: data?.find((r) => r.id === 'eventPopup')?.content || {}
      });
    })();
  }, []);

  /* edits is keyed by language first ({ tr: {key: value}, en: {...} })
     so that switching the admin's TR/EN target mid-session — without a
     save in between — can't misattribute pending text edits to the
     wrong language bucket. Reads langRef (not the `lang` state) so this
     stays correct even though recordEdit's own closure is created once
     and never rebuilt (same stale-closure hazard modeRef already guards
     against for edit/navigate mode). */
  const recordEdit = useCallback((key, value) => {
    const activeLang = langRef.current;
    setEdits((current) => ({
      ...current,
      [activeLang]: { ...(current[activeLang] || {}), [key]: value }
    }));
    setSaved(false);
  }, []);

  const recordImageEdit = useCallback((key, patch) => {
    setImageEdits((current) => ({ ...current, [key]: { ...(current[key] || {}), ...patch } }));
    setSaved(false);
  }, []);

  const recordSeoEdit = useCallback((patch) => {
    setSeoEdits((current) => ({ ...current, ...patch }));
    setSaved(false);
  }, []);

  const recordSectionEdit = useCallback((id, hidden) => {
    setSectionEdits((current) => ({ ...current, [id]: hidden }));
    const doc = iframeRef.current?.contentDocument;
    const el = doc?.getElementById(id);
    if (el) el.style.display = hidden ? 'none' : '';
    setSaved(false);
  }, []);

  const handleLoad = useCallback(() => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;

    setActiveImageKey(null);
    injectEditorStyles(doc);
    doc.documentElement.classList.toggle('iona-edit-mode', modeRef.current === 'edit');
    setLangState(doc.documentElement.lang || 'tr');
    doc.querySelectorAll('[data-i18n]').forEach((el) => el.classList.add('iona-admin-editable'));

    imageOriginalsRef.current = {};
    doc.querySelectorAll('[data-img-key]').forEach((el) => {
      el.classList.add('iona-admin-image-editable');
      const key = el.dataset.imgKey;
      const isImg = el.tagName === 'IMG';
      const cs = doc.defaultView.getComputedStyle(el);
      const posSource = isImg ? cs.objectPosition : cs.backgroundPosition;
      const [posX, posY] = posSource.split(' ').map((v) => parseFloat(v) || 50);
      const scaleMatch = /scale\(([\d.]+)\)/.exec(el.style.transform || '');
      let bgSrc = '';
      if (!isImg) {
        const match = /url\((['"]?)(.*?)\1\)/.exec(cs.backgroundImage || '');
        bgSrc = match ? match[2] : '';
      }
      imageOriginalsRef.current[key] = {
        src: isImg ? (el.currentSrc || el.src) : bgSrc,
        isBackground: !isImg,
        posX,
        posY,
        scale: scaleMatch ? parseFloat(scaleMatch[1]) : 1,
        isParallax: el.classList.contains('parallax-media')
      };
    });

    seoOriginalsRef.current = {
      title: doc.title || '',
      description: doc.querySelector('meta[name="description"]')?.getAttribute('content') || '',
      ogImage: doc.querySelector('meta[property="og:image"]')?.getAttribute('content') || ''
    };
    sectionsListRef.current = Array.from(doc.querySelectorAll('section[id]')).map((el) => ({
      id: el.id,
      hidden: el.style.display === 'none'
    }));

    const loadedPageId = pageIdForPath(iframeRef.current.contentWindow.location.pathname);
    if (loadedPageId) setSelectedPage((current) => (current === loadedPageId ? current : loadedPageId));

    let activeEl = null;
    let activeOriginal = '';

    function enterEdit(el) {
      activeEl = el;
      activeOriginal = el.textContent;
      el.contentEditable = 'true';
      el.focus();
      const range = doc.createRange();
      range.selectNodeContents(el);
      const sel = doc.defaultView.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }

    function commit(el) {
      el.contentEditable = 'false';
      const key = el.dataset.i18n;
      if (key) recordEdit(key, el.textContent.trim());
      activeEl = null;
    }

    function openImageModal(el) {
      const key = el.dataset.imgKey;
      imageElRef.current = el;
      const iframeRect = iframeRef.current.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const MODAL_W = 280;
      const MODAL_H = 420;
      let top = iframeRect.top + elRect.top;
      let left = iframeRect.left + elRect.right + 12;
      if (left + MODAL_W > window.innerWidth) left = iframeRect.left + elRect.left - MODAL_W - 12;
      if (left < 8) left = 8;
      top = Math.min(Math.max(top, 8), window.innerHeight - MODAL_H - 8);
      setImagePosition({ top, left });
      doc.querySelectorAll('.iona-admin-image-active').forEach((n) => n.classList.remove('iona-admin-image-active'));
      el.classList.add('iona-admin-image-active');
      setActiveImageKey(key);
    }

    function onClick(e) {
      if (modeRef.current === 'navigate') return;
      const imgTarget = e.target.closest('[data-img-key]');
      if (imgTarget) {
        e.preventDefault();
        e.stopPropagation();
        openImageModal(imgTarget);
        return;
      }
      if (e.target.closest('a')) e.preventDefault();
      const el = e.target.closest('[data-i18n]');
      if (!el || el.isContentEditable) return;
      enterEdit(el);
    }

    function onFocusOut(e) {
      const el = e.target.closest?.('[data-i18n]');
      if (el && el.isContentEditable) commit(el);
    }

    function onKeyDown(e) {
      if (!activeEl) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        activeEl.textContent = activeOriginal;
        activeEl.blur();
      } else if (e.key === 'Enter' && activeEl.tagName !== 'P') {
        e.preventDefault();
        activeEl.blur();
      }
    }

    function onI18nChange(e) {
      if (e.detail?.lang) setLangState(e.detail.lang);
    }

    doc.addEventListener('click', onClick, true);
    doc.addEventListener('focusout', onFocusOut, true);
    doc.addEventListener('keydown', onKeyDown, true);
    doc.addEventListener('i18nchange', onI18nChange);

    cleanupRef.current = () => {
      doc.removeEventListener('click', onClick, true);
      doc.removeEventListener('focusout', onFocusOut, true);
      doc.removeEventListener('keydown', onKeyDown, true);
      doc.removeEventListener('i18nchange', onI18nChange);
    };

    setReady(true);
  }, [recordEdit]);

  useEffect(() => () => cleanupRef.current?.(), []);

  useEffect(() => {
    modeRef.current = mode;
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    doc.documentElement.classList.toggle('iona-edit-mode', mode === 'edit');
    if (mode === 'navigate' && doc.activeElement?.isContentEditable) doc.activeElement.blur();
  }, [mode]);

  useEffect(() => {
    langRef.current = lang;
  }, [lang]);

  /* Reuses the live site's own language switcher (src/i18n.js's
     initLangSwitcher()) instead of reimplementing lang-switching here —
     clicking the nav's hidden data-lang button re-renders the page's
     text in place, same page/scroll position, no iframe reload. The
     resulting "i18nchange" event (also dispatched by that same code)
     is what actually updates the `lang` state below. */
  function switchLang(code) {
    const doc = iframeRef.current?.contentDocument;
    doc?.querySelector(`[data-lang="${code}"]`)?.click();
  }

  function handlePageChange(nextPageId) {
    if (nextPageId === selectedPage) return;
    setEdits({});
    setImageEdits({});
    setSeoEdits({});
    setSectionEdits({});
    setActiveImageKey(null);
    setPanel(null);
    setSaved(false);
    setSaveError('');
    setReady(false);
    setSelectedPage(nextPageId);
  }

  async function handleSave() {
    setSaveError('');
    const hasTextEdits = Object.keys(edits).length > 0;
    const hasImageEdits = Object.keys(imageEdits).length > 0;
    const hasSeoEdits = Object.keys(seoEdits).length > 0;
    const hasSectionEdits = Object.keys(sectionEdits).length > 0;

    const supabase = getSupabase();
    if (!supabase) {
      console.warn('[IONA Admin] Supabase yapılandırılmamış (.env eksik) — değişiklik veritabanına yazılmadı.');
      if (hasTextEdits) Object.entries(edits).forEach(([langCode, patch]) => writeLocalContent(langCode, patch));
      if (hasImageEdits) writeLocalImages(currentPage.id, imageEdits);
      if (hasSeoEdits) writeLocalBucket(`seo:${currentPage.id}`, seoEdits);
      if (hasSectionEdits) writeLocalBucket(`sections:${currentPage.id}`, sectionEdits);
      setSaveError('Supabase bağlı değil — .env dosyasına VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY ekleyin.');
      setEdits({});
      setImageEdits({});
      setSeoEdits({});
      setSectionEdits({});
      setReady(false);
      iframeRef.current?.contentWindow?.location.reload();
      return;
    }

    setSaving(true);

    const { data: existing, error: fetchError } = await supabase
      .from('site_content')
      .select('*')
      .eq('id', currentPage.id)
      .maybeSingle();

    if (fetchError) {
      setSaving(false);
      setSaveError(fetchError.message);
      showToast('error', fetchError.message);
      return;
    }

    const payload = { ...(existing?.content || {}) };
    if (hasTextEdits) {
      Object.entries(edits).forEach(([langCode, patch]) => {
        payload[langCode] = { ...(payload[langCode] || {}), ...patch };
      });
    }
    if (hasImageEdits) {
      const mergedImages = { ...(payload.images || {}) };
      Object.entries(imageEdits).forEach(([key, patch]) => {
        mergedImages[key] = { ...(mergedImages[key] || {}), ...patch };
      });
      payload.images = mergedImages;
    }
    if (hasSeoEdits) payload.seo = { ...(payload.seo || {}), ...seoEdits };
    if (hasSectionEdits) payload.sections = { ...(payload.sections || {}), ...sectionEdits };

    const { error } = await supabase.from('site_content').upsert({
      id: currentPage.id,
      content: payload,
      updated_at: new Date().toISOString()
    });
    setSaving(false);

    if (error) {
      console.error('[IONA Admin] Kaydetme hatası:', error);
      setSaveError(error.message);
      showToast('error', error.message);
      return;
    }

    saveRevisionSnapshot(currentPage.id, payload);

    setEdits({});
    setImageEdits({});
    setSeoEdits({});
    setSectionEdits({});
    setSaved(true);
    /* Reload so the iframe re-runs the site's own i18n pipeline against
       what's actually in the DB now — the definitive way to confirm the
       save really took, rather than trusting in-memory DOM mutations. */
    setReady(false);
    iframeRef.current?.contentWindow?.location.reload();
    showToast('success', 'Değişiklikler kaydedildi.', 1000);
  }

  async function handleReset() {
    const ok = window.confirm(
      `${currentPage.label} sayfasındaki TÜM metin, görsel, SEO ve bölüm değişiklikleri VE genel tema renkleri varsayılana sıfırlansın mı? Bu işlem geri alınamaz.`
    );
    if (!ok) return;

    setResetting(true);
    const supabase = getSupabase();
    if (supabase) {
      const [{ error }, { error: themeError }] = await Promise.all([
        supabase.from('site_content').upsert({ id: currentPage.id, content: {}, updated_at: new Date().toISOString() }),
        supabase.from('site_content').upsert({ id: 'theme', content: {}, updated_at: new Date().toISOString() })
      ]);
      setResetting(false);
      if (error || themeError) {
        showToast('error', (error || themeError).message);
        return;
      }
      showToast('success', `${currentPage.label} ve tema renkleri varsayılana sıfırlandı.`);
    } else {
      clearLocalImages(currentPage.id);
      clearLocalBucket('theme');
      setResetting(false);
      showToast(
        'success',
        'Bu tarayıcıdaki görsel ve tema değişiklikleri temizlendi. (Not: Supabase bağlı olmadığından diğer değişiklikler bu tarayıcıda sıfırlanamıyor.)'
      );
    }

    setEdits({});
    setImageEdits({});
    setSeoEdits({});
    setSectionEdits({});
    setThemeEdits({});
    setGlobalSettings((g) => ({ ...g, theme: {} }));
    setSaved(false);
    setActiveImageKey(null);
    setPanel(null);
    setReady(false);
    iframeRef.current?.contentWindow?.location.reload();
  }

  async function handleRestoreRevision(content) {
    const supabase = getSupabase();
    if (!supabase) return;
    const { error } = await supabase
      .from('site_content')
      .upsert({ id: currentPage.id, content, updated_at: new Date().toISOString() });
    if (error) {
      showToast('error', error.message);
      return;
    }
    saveRevisionSnapshot(currentPage.id, content);
    setPanel(null);
    showToast('success', 'Sürüm geri yüklendi.');
    setEdits({});
    setImageEdits({});
    setSeoEdits({});
    setSectionEdits({});
    setReady(false);
    iframeRef.current?.contentWindow?.location.reload();
  }

  async function closeThemeModal() {
    if (Object.keys(themeEdits).length > 0) {
      const error = await saveGlobalBucket('theme', themeEdits);
      if (error) showToast('error', error.message);
      else {
        setGlobalSettings((g) => ({ ...g, theme: { ...g.theme, ...themeEdits } }));
        showToast('success', 'Tema kaydedildi.');
      }
      setThemeEdits({});
    }
    setPanel(null);
  }

  async function closeAnnouncementModal() {
    if (Object.keys(announcementEdits).length > 0) {
      const error = await saveGlobalBucket('announcement', announcementEdits);
      if (error) showToast('error', error.message);
      else {
        setGlobalSettings((g) => ({ ...g, announcement: { ...g.announcement, ...announcementEdits } }));
        showToast('success', 'Duyuru bandı kaydedildi.');
      }
      setAnnouncementEdits({});
    }
    setPanel(null);
  }

  async function closeHotspotsModal() {
    if (Object.keys(hotspotsEdits).length > 0) {
      const error = await saveGlobalBucket('hotspots', hotspotsEdits);
      if (error) showToast('error', error.message);
      else {
        setGlobalSettings((g) => ({ ...g, hotspots: { ...g.hotspots, ...hotspotsEdits } }));
        showToast('success', '3D bilgi noktaları kaydedildi.');
      }
      setHotspotsEdits({});
    }
    setPanel(null);
  }

  async function closeEventPopupModal() {
    if (Object.keys(eventPopupEdits).length > 0) {
      const error = await saveGlobalBucket('eventPopup', eventPopupEdits);
      if (error) showToast('error', error.message);
      else {
        setGlobalSettings((g) => ({ ...g, eventPopup: { ...g.eventPopup, ...eventPopupEdits } }));
        showToast('success', 'Etkinlik duyurusu kaydedildi.');
      }
      setEventPopupEdits({});
    }
    setPanel(null);
  }

  const textEditCount = Object.values(edits).reduce((sum, bucket) => sum + Object.keys(bucket).length, 0);
  const editCount =
    textEditCount + Object.keys(imageEdits).length + Object.keys(seoEdits).length + Object.keys(sectionEdits).length;
  const activeImageOriginal = activeImageKey ? imageOriginalsRef.current[activeImageKey] : null;
  const activeImageInitial = activeImageOriginal
    ? { ...activeImageOriginal, ...(imageEdits[activeImageKey] || {}) }
    : null;

  return (
    <div className="fixed inset-0 flex flex-col bg-[#0e1210]">
      <header className="h-14 shrink-0 z-10 flex items-center justify-between px-6 bg-[#171b18] border-b border-white/10 gap-4">
        <div className="flex items-center gap-3 min-w-0 overflow-x-auto">
          <img src="/images/iona-star-mark.png" alt="" width="22" height="22" className="shrink-0" />
          <span className="text-[14px] font-extrabold tracking-tight text-white shrink-0">IONA Live Editor</span>
          <span className="h-4 w-px bg-white/15 shrink-0" />
          <select
            value={selectedPage}
            onChange={(e) => handlePageChange(e.target.value)}
            className="bg-[#0e1210] border border-white/15 text-white text-[12px] font-bold rounded-full px-3 py-1.5 focus:outline-none focus:border-emerald-400 shrink-0"
          >
            {PAGES.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setMode((m) => (m === 'edit' ? 'navigate' : 'edit'))}
            title="Düzenle / Gezin modu değiştir"
            className="flex items-center gap-1 rounded-full bg-white/5 border border-white/10 p-1 shrink-0"
          >
            <span className={`px-3 py-1 rounded-full font-label-caps text-[11px] font-bold tracking-[0.06em] transition-colors duration-200 ${mode === 'edit' ? 'bg-emerald-500 text-black' : 'text-white/50'}`}>
              Düzenle
            </span>
            <span className={`px-3 py-1 rounded-full font-label-caps text-[11px] font-bold tracking-[0.06em] transition-colors duration-200 ${mode === 'navigate' ? 'bg-[var(--brand-orange)] text-white' : 'text-white/50'}`}>
              Gezin
            </span>
          </button>
          <div className="flex items-center gap-1 rounded-full bg-white/5 border border-white/10 p-1 shrink-0">
            {['tr', 'en'].map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => switchLang(code)}
                title={code === 'tr' ? 'Türkçe metinleri düzenle' : 'İngilizce metinleri düzenle'}
                className={`px-3 py-1 rounded-full font-label-caps text-[11px] font-bold tracking-[0.06em] transition-colors duration-200 ${lang === code ? 'bg-emerald-500 text-black' : 'text-white/50'}`}
              >
                {code.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 rounded-full bg-white/5 border border-white/10 p-1 shrink-0">
            {VIEWPORTS.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setViewport(v.id)}
                title={v.label}
                className={`px-3 py-1 rounded-full font-label-caps text-[11px] font-bold tracking-[0.06em] transition-colors duration-200 ${viewport === v.id ? 'bg-sky-500 text-black' : 'text-white/50'}`}
              >
                {v.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-0.5 rounded-full bg-white/5 border border-white/10 p-1 shrink-0">
            {TOOLS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setPanel(t.id)}
                title={t.label}
                className={`p-1.5 rounded-full transition-colors duration-200 ${panel === t.id ? 'bg-sky-500 text-black' : 'text-white/60 hover:text-white hover:bg-white/10'}`}
              >
                <span className="material-symbols-outlined text-[18px] block leading-none">{t.icon}</span>
              </button>
            ))}
          </div>
          {editCount > 0 && (
            <span className="font-label-caps text-[11px] font-bold text-white/50 truncate shrink-0">{editCount} değişiklik</span>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {saveError && <span className="text-[12px] text-red-400 max-w-xs truncate" title={saveError}>{saveError}</span>}
          {saved && !saveError && <span className="text-[12px] text-emerald-400">Kaydedildi</span>}
          <button
            type="button"
            onClick={handleReset}
            disabled={resetting}
            className="font-label-caps text-[12px] font-bold tracking-[0.06em] text-red-400/80 hover:text-red-400 transition-colors duration-300 disabled:opacity-40 disabled:pointer-events-none"
          >
            {resetting ? 'Sıfırlanıyor...' : 'Varsayılana Sıfırla'}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="font-label-caps text-[12px] font-bold tracking-[0.08em] bg-[var(--brand-orange)] text-white px-4 py-2 rounded-full hover:brightness-110 transition-all duration-300 disabled:opacity-40 disabled:pointer-events-none"
          >
            {saving ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="font-label-caps text-[12px] font-bold tracking-[0.06em] text-white/60 hover:text-white transition-colors duration-300"
          >
            Çıkış
          </button>
        </div>
      </header>

      <div className="relative flex-1 overflow-auto flex justify-center bg-[#0a0d0b] py-4">
        <div
          style={{ width: VIEWPORTS.find((v) => v.id === viewport)?.width }}
          className="relative h-full max-w-full shrink-0 transition-[width] duration-300 ease-out shadow-2xl"
        >
          {!ready && (
            <div className="absolute inset-0 flex items-center justify-center text-[14px] text-white/60">
              Yükleniyor...
            </div>
          )}
          <iframe
            ref={iframeRef}
            src={currentPage.path}
            title={`IONA ${currentPage.label} - Canlı Düzenleyici`}
            onLoad={handleLoad}
            className="w-full h-full border-0 bg-white"
          />
        </div>
      </div>

      {activeImageKey && activeImageInitial && imagePosition && (
        <ImageSettingsModal
          imgKey={activeImageKey}
          pageId={currentPage.id}
          position={imagePosition}
          initial={activeImageInitial}
          targetEl={imageElRef.current}
          onChange={(patch) => recordImageEdit(activeImageKey, patch)}
          onClose={() => setActiveImageKey(null)}
          onToast={showToast}
        />
      )}

      {panel === 'inbox' && <InboxDrawer onClose={() => setPanel(null)} onToast={showToast} />}

      {panel === 'seo' && (
        <SeoModal
          pageId={currentPage.id}
          pageLabel={currentPage.label}
          initial={{ ...seoOriginalsRef.current, ...seoEdits }}
          doc={iframeRef.current?.contentDocument}
          onChange={recordSeoEdit}
          onClose={() => setPanel(null)}
          onToast={showToast}
        />
      )}

      {panel === 'theme' && (
        <ThemeModal
          initial={{ ...globalSettings.theme, ...themeEdits }}
          doc={iframeRef.current?.contentDocument}
          onChange={(patch) => setThemeEdits((current) => ({ ...current, ...patch }))}
          onClose={closeThemeModal}
        />
      )}

      {panel === 'sections' && (
        <SectionsPanel
          sections={sectionsListRef.current.map((s) => ({ id: s.id, hidden: sectionEdits[s.id] ?? s.hidden }))}
          onToggle={recordSectionEdit}
          onClose={() => setPanel(null)}
        />
      )}

      {panel === 'announcement' && (
        <AnnouncementModal
          initial={{ ...globalSettings.announcement, ...announcementEdits }}
          onChange={(patch) => setAnnouncementEdits((current) => ({ ...current, ...patch }))}
          onClose={closeAnnouncementModal}
        />
      )}

      {panel === 'hotspots' && (
        <HotspotsModal
          initial={{ ...globalSettings.hotspots, ...hotspotsEdits }}
          onChange={(patch) => setHotspotsEdits((current) => ({ ...current, ...patch }))}
          onClose={closeHotspotsModal}
        />
      )}

      {panel === 'eventPopup' && (
        <EventPopupModal
          initial={{ ...globalSettings.eventPopup, ...eventPopupEdits }}
          onChange={(patch) => setEventPopupEdits((current) => ({ ...current, ...patch }))}
          onClose={closeEventPopupModal}
          onToast={showToast}
        />
      )}

      {panel === 'stats' && <StatsModal onClose={() => setPanel(null)} onToast={showToast} />}

      {panel === 'history' && (
        <HistoryDropdown
          pageId={currentPage.id}
          pageLabel={currentPage.label}
          onRestore={handleRestoreRevision}
          onFactoryReset={() => {
            setPanel(null);
            handleReset();
          }}
          onClose={() => setPanel(null)}
          onToast={showToast}
        />
      )}

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
