import { useCallback, useEffect, useRef, useState } from 'react';
import { getSupabase } from '../../lib/supabaseClient.js';
import { writeLocalContent } from '../../lib/localContent.js';
import { PAGES, pageIdForPath } from '../../lib/pages.js';

const STYLE_ID = 'iona-admin-editor-style';

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
  `;
  doc.head.appendChild(style);
}

export default function LiveEditor({ onLogout }) {
  const iframeRef = useRef(null);
  const cleanupRef = useRef(null);
  const modeRef = useRef('edit');
  const [edits, setEdits] = useState({});
  const [lang, setLangState] = useState('tr');
  const [selectedPage, setSelectedPage] = useState(PAGES[0].id);
  const [mode, setMode] = useState('edit');
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');

  const currentPage = PAGES.find((p) => p.id === selectedPage) || PAGES[0];

  const recordEdit = useCallback((key, value) => {
    setEdits((current) => ({ ...current, [key]: value }));
    setSaved(false);
  }, []);

  const handleLoad = useCallback(() => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;

    injectEditorStyles(doc);
    doc.documentElement.classList.toggle('iona-edit-mode', modeRef.current === 'edit');
    setLangState(doc.documentElement.lang || 'tr');
    doc.querySelectorAll('[data-i18n]').forEach((el) => el.classList.add('iona-admin-editable'));

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

    function onClick(e) {
      if (modeRef.current === 'navigate') return;
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

    doc.addEventListener('click', onClick, true);
    doc.addEventListener('focusout', onFocusOut, true);
    doc.addEventListener('keydown', onKeyDown, true);

    cleanupRef.current = () => {
      doc.removeEventListener('click', onClick, true);
      doc.removeEventListener('focusout', onFocusOut, true);
      doc.removeEventListener('keydown', onKeyDown, true);
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

  function handlePageChange(nextPageId) {
    if (nextPageId === selectedPage) return;
    setEdits({});
    setSaved(false);
    setSaveError('');
    setReady(false);
    setSelectedPage(nextPageId);
  }

  async function handleSave() {
    setSaveError('');
    if (Object.keys(edits).length === 0) return;

    const supabase = getSupabase();
    if (!supabase) {
      console.warn('[IONA Admin] Supabase yapılandırılmamış (.env eksik) — değişiklik veritabanına yazılmadı.');
      console.log(`[IONA Admin] ${currentPage.label} metin değişiklikleri:`, { lang, edits });
      writeLocalContent(lang, edits);
      setSaveError('Supabase bağlı değil — .env dosyasına VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY ekleyin.');
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
      return;
    }

    const payload = { ...(existing?.content || {}) };
    payload[lang] = { ...(payload[lang] || {}), ...edits };

    const { error } = await supabase.from('site_content').upsert({
      id: currentPage.id,
      content: payload,
      updated_at: new Date().toISOString()
    });
    setSaving(false);

    if (error) {
      console.error('[IONA Admin] Kaydetme hatası:', error);
      setSaveError(error.message);
      return;
    }
    setEdits({});
    setSaved(true);
  }

  const editCount = Object.keys(edits).length;

  return (
    <div className="fixed inset-0 flex flex-col bg-[#0e1210]">
      <header className="h-14 shrink-0 z-10 flex items-center justify-between px-6 bg-[#171b18] border-b border-white/10 gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <img src="/images/iona-star-mark.png" alt="" width="22" height="22" />
          <span className="text-[14px] font-extrabold tracking-tight text-white shrink-0">IONA Live Editor</span>
          <span className="h-4 w-px bg-white/15 shrink-0" />
          <select
            value={selectedPage}
            onChange={(e) => handlePageChange(e.target.value)}
            className="bg-[#0e1210] border border-white/15 text-white text-[12px] font-bold rounded-full px-3 py-1.5 focus:outline-none focus:border-emerald-400"
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
          {editCount > 0 && (
            <span className="font-label-caps text-[11px] font-bold text-white/50 truncate">{editCount} değişiklik</span>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {saveError && <span className="text-[12px] text-red-400 max-w-xs truncate" title={saveError}>{saveError}</span>}
          {saved && !saveError && <span className="text-[12px] text-emerald-400">Kaydedildi</span>}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || editCount === 0}
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

      <div className="relative flex-1">
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
  );
}
