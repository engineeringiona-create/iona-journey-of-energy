import { useCallback, useEffect, useRef, useState } from 'react';
import { getSupabase } from '../../lib/supabaseClient.js';
import { writeLocalContent } from '../../lib/localContent.js';
import { writeLocalImages, clearLocalImages } from '../../lib/imageContent.js';
import { readLocalBucket, writeLocalBucket, clearLocalBucket } from '../../lib/adminStore.js';
import { PAGES, pageIdForPath } from '../../lib/pages.js';
import ImageSettingsModal from './ImageSettingsModal.jsx';
import TextEditPopover from './TextEditPopover.jsx';
import Toast from './Toast.jsx';
import InboxDrawer from './InboxDrawer.jsx';
import SeoModal from './SeoModal.jsx';
import ThemeModal from './ThemeModal.jsx';
import SectionsPanel, { SECTION_LABELS } from './SectionsPanel.jsx';
import { reorderSections } from '../../lib/sectionLayout.js';
import { pickFrameTarget } from '../../lib/imageFrameTarget.js';
import AnnouncementModal from './AnnouncementModal.jsx';
import HistoryDropdown from './HistoryDropdown.jsx';
import HotspotsModal from './HotspotsModal.jsx';
import AnnouncementsModal from './AnnouncementsModal.jsx';
import StatsModal from './StatsModal.jsx';
import CopilotChat from './CopilotChat.jsx';
import MediaPickerModal from './MediaPickerModal.jsx';

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
  { id: 'sections', label: 'Sayfa Düzeni & Bölümler', icon: 'dashboard_customize' },
  { id: 'announcement', label: 'Duyuru Bandı', icon: 'campaign' },
  { id: 'hotspots', label: '3D Bilgi Noktaları', icon: 'view_in_ar' },
  { id: 'announcements', label: 'Duyuru Yöneticisi', icon: 'newspaper' },
  { id: 'media', label: 'Medya Kütüphanesi', icon: 'perm_media' },
  { id: 'stats', label: 'İstatistikler', icon: 'bar_chart' },
  { id: 'history', label: 'Geçmiş', icon: 'history' }
];

/* getComputedStyle().color always resolves to "rgb(r, g, b)" (or
   "rgba(...)") regardless of how the color was originally authored — the
   TextEditPopover's preset swatches and native <input type="color"> both
   need a #rrggbb string to compare against/seed from. */
function rgbStringToHex(rgb) {
  const match = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(rgb || '');
  if (!match) return '#14181a';
  const toHex = (n) => Number(n).toString(16).padStart(2, '0');
  return `#${toHex(match[1])}${toHex(match[2])}${toHex(match[3])}`;
}

function injectEditorStyles(doc) {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    /* Phase 62: text elements now open the floating TextEditPopover on
       click (see LiveEditor's openTextPopover) instead of turning
       contentEditable in place, so the cursor reads as a click target
       (pointer), not a text-insertion caret. The ✏️ badge is pure hover
       affordance — pointer-events:none so it never steals the click. */
    .iona-edit-mode .iona-admin-editable { outline-offset: 2px; cursor: pointer; position: relative; }
    .iona-edit-mode .iona-admin-editable:hover { outline: 1px dashed #78dc77; }
    .iona-edit-mode .iona-admin-editable:hover::after {
      content: '✏️';
      position: absolute;
      top: -9px;
      right: -9px;
      font-size: 12px;
      line-height: 1;
      pointer-events: none;
    }
    .iona-edit-mode .iona-admin-editable.iona-admin-text-active {
      outline: 2px solid #78dc77;
      background: rgba(120, 220, 119, 0.08);
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
  const textElRef = useRef(null);
  const textOriginalsRef = useRef({});
  const [edits, setEdits] = useState({});
  const [imageEdits, setImageEdits] = useState({});
  const [textStyleEdits, setTextStyleEdits] = useState({});
  const [seoEdits, setSeoEdits] = useState({});
  const [sectionEdits, setSectionEdits] = useState({});
  const [themeEdits, setThemeEdits] = useState({});
  const [announcementEdits, setAnnouncementEdits] = useState({});
  const [hotspotsEdits, setHotspotsEdits] = useState({});
  const [announcementsEdits, setAnnouncementsEdits] = useState({});
  const [globalSettings, setGlobalSettings] = useState({ theme: {}, announcement: {}, hotspots: {}, announcements: {} });
  const [activeImageKey, setActiveImageKey] = useState(null);
  const [imagePosition, setImagePosition] = useState(null);
  const [activeTextKey, setActiveTextKey] = useState(null);
  const [textPopoverPosition, setTextPopoverPosition] = useState(null);
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
          announcements: readLocalBucket('announcements') || {}
        });
        return;
      }
      const { data } = await supabase
        .from('site_content')
        .select('id,content')
        .in('id', ['theme', 'announcement', 'hotspots', 'announcements']);
      setGlobalSettings({
        theme: data?.find((r) => r.id === 'theme')?.content || {},
        announcement: data?.find((r) => r.id === 'announcement')?.content || {},
        hotspots: data?.find((r) => r.id === 'hotspots')?.content || {},
        announcements: data?.find((r) => r.id === 'announcements')?.content || {}
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

  /* Phase 62: fontSize/color/fontWeight/textAlign from the floating
     TextEditPopover — a sibling bucket to imageEdits above, same shape,
     saved into content.textStyles[key] alongside content.images[key]. The
     popover's actual text content still goes through recordEdit (below),
     since that's the exact same per-i18n-key text bucket the old inline
     contentEditable flow already wrote to — no reason to duplicate it. */
  const recordTextStyleEdit = useCallback((key, patch) => {
    setTextStyleEdits((current) => ({ ...current, [key]: { ...(current[key] || {}), ...patch } }));
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

  /* Reorder ("Sayfa Düzeni & Bölümler" ⬆️/⬇️): sectionEdits._order sits
     alongside the per-id hidden booleans in the very same bucket, since
     that's exactly the shape content.sections is saved/applied as (see
     applySectionLayout in src/i18n.js) — no separate storage needed.
     Falls back to the DOM's own current order (sectionsListRef, captured
     at iframe load) until the first move. */
  const recordSectionMove = useCallback((index, direction) => {
    setSectionEdits((current) => {
      const order = current._order || sectionsListRef.current.map((s) => s.id);
      const target = index + direction;
      if (target < 0 || target >= order.length) return current;
      const next = [...order];
      [next[index], next[target]] = [next[target], next[index]];
      const doc = iframeRef.current?.contentDocument;
      if (doc) reorderSections(doc, next);
      return { ...current, _order: next };
    });
    setSaved(false);
  }, []);

  /* Section title/subtitle fields in the layout panel are just a
     convenience surface over the SAME per-key text edits the inline
     contenteditable flow already produces (see SECTION_LABELS in
     SectionsPanel.jsx) — reuses recordEdit's exact save path instead of
     inventing a parallel one. */
  const recordSectionTextEdit = useCallback(
    (key, value) => {
      recordEdit(key, value);
      const doc = iframeRef.current?.contentDocument;
      const el = doc?.querySelector(`[data-i18n="${key}"]`);
      if (el) el.textContent = value;
    },
    [recordEdit]
  );

  function sectionTextsSnapshot() {
    const doc = iframeRef.current?.contentDocument;
    const activeLang = langRef.current;
    const keys = Object.values(SECTION_LABELS).flatMap((m) => [m.eyebrowKey, m.titleKey]).filter(Boolean);
    const out = {};
    keys.forEach((key) => {
      out[key] = edits[activeLang]?.[key] ?? doc?.querySelector(`[data-i18n="${key}"]`)?.textContent ?? '';
    });
    return out;
  }

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
      /* Framing fields (Phase 61, fixed Phase 63, fixed again Phase 65)
         always land as inline styles via applyImageFraming (i18n.js) /
         applyFraming (ImageSettingsModal) — read straight from inline
         style rather than computed style, since a not-yet-set property
         should read back as the real "no override" default, not the
         browser's resolved value.
         frameTarget picks the wrapper over the img itself whenever the
         img is geometrically stretched to fill an overflow-hidden parent
         (see src/lib/imageFrameTarget.js) — Phase 63's `h-full` class
         check missed Phase 64's .bento-card-media, which fills its
         parent via a plain CSS rule instead of that class. */
      const frameTarget = pickFrameTarget(el, isImg);
      const placementFromMargins = () => {
        const ml = frameTarget.style.marginLeft;
        const mr = frameTarget.style.marginRight;
        if (ml === '0' && mr === 'auto') return 'left';
        if (ml === 'auto' && mr === '0') return 'right';
        if (ml === 'auto' && mr === 'auto') return 'center';
        return 'full';
      };
      imageOriginalsRef.current[key] = {
        src: isImg ? (el.currentSrc || el.src) : bgSrc,
        isBackground: !isImg,
        posX,
        posY,
        scale: scaleMatch ? parseFloat(scaleMatch[1]) : 1,
        isParallax: el.classList.contains('parallax-media'),
        objectFit: el.style.objectFit || 'cover',
        aspectRatio: frameTarget.style.aspectRatio || 'auto',
        borderRadius: frameTarget.style.borderRadius ? parseFloat(frameTarget.style.borderRadius) : 0,
        maxWidthPercent: frameTarget.style.maxWidth ? parseFloat(frameTarget.style.maxWidth) : 100,
        placement: placementFromMargins()
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

    /* Phase 62: clicking a [data-i18n] element opens the floating
       TextEditPopover instead of turning it contentEditable in place —
       same "compute a position next to the clicked element, read its
       current live values as the modal's `initial`" pattern openImageModal
       already uses for images, just for text (content + fontSize/color/
       fontWeight/textAlign) instead of crop/framing. Values are read from
       computed style lazily here (not prescanned for every text node up
       front the way images are) since there can be hundreds of text
       elements per page and only the one actually clicked needs it. */
    function openTextPopover(el) {
      const key = el.dataset.i18n;
      if (!key) return;
      textElRef.current = el;
      const cs = doc.defaultView.getComputedStyle(el);
      textOriginalsRef.current[key] = {
        text: el.textContent.trim(),
        fontSize: Math.round(parseFloat(cs.fontSize)) || 16,
        color: rgbStringToHex(cs.color),
        fontWeight: String(cs.fontWeight === 'normal' ? 400 : cs.fontWeight === 'bold' ? 700 : cs.fontWeight),
        textAlign: cs.textAlign === 'start' ? 'left' : cs.textAlign === 'end' ? 'right' : cs.textAlign
      };

      const iframeRect = iframeRef.current.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const POPOVER_W = 300;
      const POPOVER_MIN_H = 320;
      const MARGIN = 8;
      let left = iframeRect.left + elRect.left;
      if (left + POPOVER_W > window.innerWidth) left = window.innerWidth - POPOVER_W - MARGIN;
      if (left < MARGIN) left = MARGIN;

      /* Anchor just below the clicked element by default; if there isn't
         POPOVER_MIN_H of room below it, anchor above it instead — same
         "pick whichever side has room" idea as openImageModal's left/right
         flip, just on the vertical axis since this popover opens below/
         above rather than beside. */
      const belowTop = iframeRect.top + elRect.bottom + 8;
      const roomBelow = window.innerHeight - belowTop - MARGIN;
      let top;
      if (roomBelow >= POPOVER_MIN_H || iframeRect.top + elRect.top < POPOVER_MIN_H) {
        top = Math.min(belowTop, window.innerHeight - POPOVER_MIN_H - MARGIN);
      } else {
        top = Math.max(MARGIN, iframeRect.top + elRect.top - POPOVER_MIN_H - 8);
      }
      top = Math.max(top, MARGIN);
      const maxHeight = Math.min(window.innerHeight * 0.8, window.innerHeight - top - MARGIN);
      setTextPopoverPosition({ top, left, maxHeight });

      doc.querySelectorAll('.iona-admin-text-active').forEach((n) => n.classList.remove('iona-admin-text-active'));
      el.classList.add('iona-admin-text-active');
      setActiveTextKey(key);
    }

    function openImageModal(el) {
      const key = el.dataset.imgKey;
      imageElRef.current = el;
      const iframeRect = iframeRef.current.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const MODAL_W = 300;
      const MARGIN = 8;
      let top = iframeRect.top + elRect.top;
      let left = iframeRect.left + elRect.right + 12;
      if (left + MODAL_W > window.innerWidth) left = iframeRect.left + elRect.left - MODAL_W - 12;
      if (left < MARGIN) left = MARGIN;
      top = Math.min(Math.max(top, MARGIN), window.innerHeight - MARGIN);
      /* Phase 63 fix: the panel grew (crop + framing tabs) well past the
         old hardcoded 420px height guess, so clamping `top` against a
         fixed height let the panel's real content run off the bottom of
         the screen. Compute the actual room available below `top` instead
         and hand it to the panel as a real max-height cap — the panel's
         own flex layout (sticky-ish header/footer, scrolling body) takes
         it from there. */
      const maxHeight = Math.min(window.innerHeight * 0.85, window.innerHeight - top - MARGIN);
      setImagePosition({ top, left, maxHeight });
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
      if (!el) return;
      openTextPopover(el);
    }

    function onI18nChange(e) {
      if (e.detail?.lang) setLangState(e.detail.lang);
    }

    doc.addEventListener('click', onClick, true);
    doc.addEventListener('i18nchange', onI18nChange);

    cleanupRef.current = () => {
      doc.removeEventListener('click', onClick, true);
      doc.removeEventListener('i18nchange', onI18nChange);
    };

    setReady(true);
  }, []);

  useEffect(() => () => cleanupRef.current?.(), []);

  useEffect(() => {
    modeRef.current = mode;
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    doc.documentElement.classList.toggle('iona-edit-mode', mode === 'edit');
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

  /* The three global (non-page-scoped) modals converted to "Uygula" in
     Phase 38 no longer save-on-close — their drafts sit in *Edits state
     just like the page-scoped ones, and now flush together with the
     page content whenever "Değişiklikleri Kaydet" runs. */
  async function flushGlobalEdits() {
    const buckets = [
      ['theme', themeEdits, setThemeEdits],
      ['hotspots', hotspotsEdits, setHotspotsEdits],
      ['announcements', announcementsEdits, setAnnouncementsEdits]
    ].filter(([, bucketEdits]) => Object.keys(bucketEdits).length > 0);
    if (buckets.length === 0) return;
    await Promise.all(
      buckets.map(async ([key, bucketEdits, setBucketEdits]) => {
        const error = await saveGlobalBucket(key, bucketEdits);
        if (error) {
          showToast('error', error.message);
          return;
        }
        setGlobalSettings((g) => ({ ...g, [key]: { ...g[key], ...bucketEdits } }));
        setBucketEdits({});
      })
    );
  }

  function handlePageChange(nextPageId) {
    if (nextPageId === selectedPage) return;
    setEdits({});
    setImageEdits({});
    setTextStyleEdits({});
    setSeoEdits({});
    setSectionEdits({});
    setActiveImageKey(null);
    setActiveTextKey(null);
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
    const hasTextStyleEdits = Object.keys(textStyleEdits).length > 0;
    const hasSeoEdits = Object.keys(seoEdits).length > 0;
    const hasSectionEdits = Object.keys(sectionEdits).length > 0;

    const supabase = getSupabase();
    if (!supabase) {
      console.warn('[IONA Admin] Supabase yapılandırılmamış (.env eksik) — değişiklik veritabanına yazılmadı.');
      if (hasTextEdits) Object.entries(edits).forEach(([langCode, patch]) => writeLocalContent(langCode, patch));
      if (hasImageEdits) writeLocalImages(currentPage.id, imageEdits);
      if (hasTextStyleEdits) writeLocalBucket(`textStyles:${currentPage.id}`, textStyleEdits);
      if (hasSeoEdits) writeLocalBucket(`seo:${currentPage.id}`, seoEdits);
      if (hasSectionEdits) writeLocalBucket(`sections:${currentPage.id}`, sectionEdits);
      await flushGlobalEdits();
      setSaveError('Supabase bağlı değil — .env dosyasına VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY ekleyin.');
      setEdits({});
      setImageEdits({});
      setTextStyleEdits({});
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
    if (hasTextStyleEdits) {
      const mergedTextStyles = { ...(payload.textStyles || {}) };
      Object.entries(textStyleEdits).forEach(([key, patch]) => {
        mergedTextStyles[key] = { ...(mergedTextStyles[key] || {}), ...patch };
      });
      payload.textStyles = mergedTextStyles;
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
    await flushGlobalEdits();

    setEdits({});
    setImageEdits({});
    setTextStyleEdits({});
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
    setTextStyleEdits({});
    setSeoEdits({});
    setSectionEdits({});
    setThemeEdits({});
    setGlobalSettings((g) => ({ ...g, theme: {} }));
    setSaved(false);
    setActiveImageKey(null);
    setActiveTextKey(null);
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
    setTextStyleEdits({});
    setSeoEdits({});
    setSectionEdits({});
    setReady(false);
    iframeRef.current?.contentWindow?.location.reload();
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

  const textEditCount = Object.values(edits).reduce((sum, bucket) => sum + Object.keys(bucket).length, 0);
  const editCount =
    textEditCount +
    Object.keys(imageEdits).length +
    Object.keys(textStyleEdits).length +
    Object.keys(seoEdits).length +
    Object.keys(sectionEdits).length +
    Object.keys(themeEdits).length +
    Object.keys(hotspotsEdits).length +
    Object.keys(announcementsEdits).length;
  const activeImageOriginal = activeImageKey ? imageOriginalsRef.current[activeImageKey] : null;
  const activeImageInitial = activeImageOriginal
    ? { ...activeImageOriginal, ...(imageEdits[activeImageKey] || {}) }
    : null;
  const activeTextOriginal = activeTextKey ? textOriginalsRef.current[activeTextKey] : null;
  const activeTextInitial = activeTextOriginal
    ? {
        ...activeTextOriginal,
        ...(textStyleEdits[activeTextKey] || {}),
        ...(edits[lang]?.[activeTextKey] !== undefined ? { text: edits[lang][activeTextKey] } : {})
      }
    : null;

  /* Kaydet in the popover: text goes through recordEdit (the same
     per-i18n-key bucket the old inline contentEditable flow wrote to —
     this is a UI change, not a new storage shape), style knobs through
     recordTextStyleEdit. İptal/outside-click/Escape (handled inside
     TextEditPopover itself) just closes without calling this at all. */
  function handleTextPopoverSave(patch) {
    const { text, ...style } = patch;
    if (text !== undefined) recordEdit(activeTextKey, text);
    if (Object.keys(style).length > 0) recordTextStyleEdit(activeTextKey, style);
    const doc = iframeRef.current?.contentDocument;
    doc?.querySelectorAll('.iona-admin-text-active').forEach((n) => n.classList.remove('iona-admin-text-active'));
    setActiveTextKey(null);
  }

  function handleTextPopoverClose() {
    /* Revert the iframe element back to its pre-popover state — the
       popover live-previewed every keystroke/control change straight
       onto textElRef.current, same as ImageSettingsModal's cancel does
       for images, so İptal has to undo that, not just close the panel. */
    const el = textElRef.current;
    if (el && activeTextOriginal) {
      el.textContent = activeTextOriginal.text;
      el.style.fontSize = `${activeTextOriginal.fontSize}px`;
      el.style.color = activeTextOriginal.color;
      el.style.fontWeight = activeTextOriginal.fontWeight;
      el.style.textAlign = activeTextOriginal.textAlign;
    }
    const doc = iframeRef.current?.contentDocument;
    doc?.querySelectorAll('.iona-admin-text-active').forEach((n) => n.classList.remove('iona-admin-text-active'));
    setActiveTextKey(null);
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-[#0e1210]">
      <header className="h-14 shrink-0 z-10 flex items-center justify-between px-6 bg-[#171b18] border-b border-white/10 gap-4">
        <div className="flex items-center gap-3 min-w-0 overflow-x-auto">
          <img src="/images/iona-wordmark.svg" alt="iona" width="70" height="22" className="h-[18px] w-auto shrink-0" />
          <span className="text-[14px] font-extrabold tracking-tight text-white shrink-0">Live Editor</span>
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

      {activeTextKey && activeTextInitial && textPopoverPosition && (
        <TextEditPopover
          position={textPopoverPosition}
          initial={activeTextInitial}
          targetEl={textElRef.current}
          onSave={handleTextPopoverSave}
          onClose={handleTextPopoverClose}
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
          onClose={() => setPanel(null)}
          onToast={showToast}
        />
      )}

      {panel === 'sections' && (
        <SectionsPanel
          sections={(sectionEdits._order || sectionsListRef.current.map((s) => s.id))
            .map((id) => sectionsListRef.current.find((s) => s.id === id))
            .filter(Boolean)
            .map((s) => ({ id: s.id, hidden: sectionEdits[s.id] ?? s.hidden }))}
          texts={sectionTextsSnapshot()}
          onToggle={recordSectionEdit}
          onMove={recordSectionMove}
          onEditText={recordSectionTextEdit}
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
          onClose={() => setPanel(null)}
          onToast={showToast}
        />
      )}

      {panel === 'announcements' && (
        <AnnouncementsModal
          initial={{ ...globalSettings.announcements, ...announcementsEdits }}
          onChange={(patch) => setAnnouncementsEdits((current) => ({ ...current, ...patch }))}
          onClose={() => setPanel(null)}
          onToast={showToast}
        />
      )}

      {panel === 'media' && (
        <MediaPickerModal isOpen onClose={() => setPanel(null)} onToast={showToast} />
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

      <CopilotChat
        onProposeAnnouncement={(item) => {
          setAnnouncementsEdits((current) => {
            const baseList = current.list ?? globalSettings.announcements?.list ?? [];
            const newItem = { ...item, id: `ann_${Date.now()}_${Math.round(Math.random() * 1000)}` };
            return { ...current, list: [...baseList, newItem] };
          });
        }}
        onToast={showToast}
      />
    </div>
  );
}
