import { useCallback, useEffect, useRef, useState } from 'react';
import { getSupabase } from '../../lib/supabaseClient.js';
import { writeLocalContent } from '../../lib/localContent.js';

const STYLE_ID = 'iona-admin-editor-style';

function injectEditorStyles(doc) {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .iona-admin-editable { outline-offset: 2px; cursor: text; }
    .iona-admin-editable:hover { outline: 1px dashed #10b981; }
    .iona-admin-editable[contenteditable="true"] {
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
  const [edits, setEdits] = useState({});
  const [lang, setLangState] = useState('tr');
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');

  const recordEdit = useCallback((key, value) => {
    setEdits((current) => ({ ...current, [key]: value }));
    setSaved(false);
  }, []);

  const handleLoad = useCallback(() => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;

    injectEditorStyles(doc);
    setLangState(doc.documentElement.lang || 'tr');
    doc.querySelectorAll('[data-i18n]').forEach((el) => el.classList.add('iona-admin-editable'));

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

  async function handleSave() {
    setSaveError('');
    if (Object.keys(edits).length === 0) return;

    const supabase = getSupabase();
    if (!supabase) {
      console.warn('[IONA Admin] Supabase yapılandırılmamış (.env eksik) — değişiklik veritabanına yazılmadı.');
      console.log('[IONA Admin] Anasayfa metin değişiklikleri:', { lang, edits });
      setSaveError('Supabase bağlı değil — .env dosyasına VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY ekleyin.');
      return;
    }

    setSaving(true);

    const { data: existing, error: fetchError } = await supabase
      .from('site_content')
      .select('*')
      .eq('id', 'home')
      .maybeSingle();

    if (fetchError) {
      setSaving(false);
      setSaveError(fetchError.message);
      return;
    }

    const payload = { ...(existing?.content || {}) };
    payload[lang] = { ...(payload[lang] || {}), ...edits };

    const { error } = await supabase.from('site_content').upsert({
      id: 'home',
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
      <header className="h-14 shrink-0 z-10 flex items-center justify-between px-6 bg-[#171b18] border-b border-white/10">
        <div className="flex items-center gap-3">
          <img src="/images/iona-star-mark.png" alt="" width="22" height="22" />
          <span className="text-[14px] font-extrabold tracking-tight text-white">IONA Live Editor</span>
          <span className="h-4 w-px bg-white/15" />
          <span className="font-label-caps text-[11px] font-bold tracking-[0.08em] text-emerald-400 uppercase">
            Mode: Edit
          </span>
          {editCount > 0 && (
            <span className="font-label-caps text-[11px] font-bold text-white/50">{editCount} değişiklik</span>
          )}
        </div>
        <div className="flex items-center gap-3">
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
          src="/index.html"
          title="IONA Anasayfa - Canlı Düzenleyici"
          onLoad={handleLoad}
          className="w-full h-full border-0 bg-white"
        />
      </div>
    </div>
  );
}
