import { useEffect, useRef, useState } from 'react';
import ModalFooter from './ModalFooter.jsx';

const FONT_SIZES = [14, 18, 24, 36, 48, 64];

const COLOR_PRESETS = [
  { id: 'green', label: 'IONA Yeşili', hex: '#78dc77' },
  { id: 'slate', label: 'Koyu Slate', hex: '#1e293b' },
  { id: 'white', label: 'Beyaz', hex: '#ffffff' },
  { id: 'amber', label: 'Amber', hex: '#f59e0b' }
];

const WEIGHTS = [
  { id: '400', label: 'Normal' },
  { id: '500', label: 'Orta' },
  { id: '700', label: 'Kalın' },
  { id: '900', label: 'Siyah' }
];

const ALIGNS = [
  { id: 'left', label: 'Sola', icon: 'format_align_left' },
  { id: 'center', label: 'Ortala', icon: 'format_align_center' },
  { id: 'right', label: 'Sağa', icon: 'format_align_right' }
];

/* Floating "Liquid Glass" quick-edit card (Phase 62) — opened by
   LiveEditor's openTextPopover next to whichever [data-i18n] text the
   admin clicked, replacing the old click-to-contentEditable-in-place
   flow. Every control here live-mutates targetEl directly as it's
   touched (same "preview now, commit on an explicit button" pattern
   ImageSettingsModal already established for images) — Kaydet hands the
   accumulated patch up to LiveEditor, İptal/Escape/outside-click just
   asks the parent to revert targetEl and closes. */
export default function TextEditPopover({ position, initial, targetEl, onSave, onClose }) {
  const [text, setText] = useState(initial.text || '');
  const [fontSize, setFontSize] = useState(initial.fontSize ?? 16);
  const [color, setColor] = useState(initial.color || '#14181a');
  const [fontWeight, setFontWeight] = useState(String(initial.fontWeight ?? '400'));
  const [textAlign, setTextAlign] = useState(initial.textAlign || 'left');
  const panelRef = useRef(null);
  const textareaRef = useRef(null);
  const draftRef = useRef({});

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape') onClose();
    }
    function onPointerDown(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onPointerDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = 'auto';
    textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
  }, [text]);

  function handleText(value) {
    setText(value);
    draftRef.current = { ...draftRef.current, text: value };
    if (targetEl) targetEl.textContent = value;
  }

  function handleFontSize(px) {
    setFontSize(px);
    draftRef.current = { ...draftRef.current, fontSize: px };
    if (targetEl) targetEl.style.fontSize = `${px}px`;
  }

  function handleColor(hex) {
    setColor(hex);
    draftRef.current = { ...draftRef.current, color: hex };
    if (targetEl) targetEl.style.color = hex;
  }

  function handleWeight(weight) {
    setFontWeight(weight);
    draftRef.current = { ...draftRef.current, fontWeight: weight };
    if (targetEl) targetEl.style.fontWeight = weight;
  }

  function handleAlign(align) {
    setTextAlign(align);
    draftRef.current = { ...draftRef.current, textAlign: align };
    if (targetEl) targetEl.style.textAlign = align;
  }

  function handleSave() {
    onSave(draftRef.current);
  }

  return (
    <div
      ref={panelRef}
      style={{ position: 'fixed', top: position.top, left: position.left, maxHeight: position.maxHeight ?? '80vh' }}
      className="z-50 w-[300px] flex flex-col rounded-2xl border border-white/15 bg-[#171b18]/80 backdrop-blur-xl shadow-2xl overflow-hidden"
    >
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/10">
        <span className="font-label-caps text-[11px] font-bold tracking-[0.06em] text-emerald-400">📝 Metin Düzenle</span>
        <button type="button" onClick={onClose} className="text-white/40 hover:text-white text-[16px] leading-none">×</button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => handleText(e.target.value)}
          rows={2}
          className="w-full resize-none bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[13px] text-white leading-snug focus:outline-none focus:border-emerald-400"
        />

        <div>
          <span className="block font-label-caps text-[10px] font-bold tracking-[0.06em] text-white/50 mb-1.5">🔠 Yazı Boyutu</span>
          <div className="flex flex-wrap gap-1.5">
            {FONT_SIZES.map((px) => (
              <button
                key={px}
                type="button"
                onClick={() => handleFontSize(px)}
                className={`px-2.5 py-1 rounded-full border text-[11px] font-bold ${fontSize === px ? 'bg-emerald-500 border-emerald-400 text-black' : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/15'}`}
              >
                {px}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="block font-label-caps text-[10px] font-bold tracking-[0.06em] text-white/50 mb-1.5">🎨 Metin Rengi</span>
          <div className="flex items-center gap-1.5">
            {COLOR_PRESETS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => handleColor(c.hex)}
                title={c.label}
                style={{ backgroundColor: c.hex }}
                className={`h-7 w-7 rounded-full border-2 ${color.toLowerCase() === c.hex ? 'border-sky-400' : 'border-white/20'}`}
              />
            ))}
            <input
              type="color"
              value={color}
              onChange={(e) => handleColor(e.target.value)}
              title="Özel renk"
              className="h-7 w-7 rounded-full border-2 border-white/20 bg-transparent cursor-pointer p-0"
            />
          </div>
        </div>

        <div>
          <span className="block font-label-caps text-[10px] font-bold tracking-[0.06em] text-white/50 mb-1.5">🏋️ Kalınlık</span>
          <div className="grid grid-cols-4 gap-1">
            {WEIGHTS.map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => handleWeight(w.id)}
                className={`py-1.5 rounded-md border text-[10px] font-bold ${fontWeight === w.id ? 'bg-emerald-500 border-emerald-400 text-black' : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/15'}`}
              >
                {w.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="block font-label-caps text-[10px] font-bold tracking-[0.06em] text-white/50 mb-1.5">📐 Hizalama</span>
          <div className="grid grid-cols-3 gap-1">
            {ALIGNS.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => handleAlign(a.id)}
                title={a.label}
                className={`py-1.5 rounded-md border flex items-center justify-center ${textAlign === a.id ? 'bg-emerald-500 border-emerald-400 text-black' : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/15'}`}
              >
                <span className="material-symbols-outlined text-[16px] leading-none">{a.icon}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="shrink-0 px-4 pb-4">
        <ModalFooter onApply={handleSave} onCancel={onClose} applyLabel="Kaydet" cancelLabel="İptal" />
      </div>
    </div>
  );
}
