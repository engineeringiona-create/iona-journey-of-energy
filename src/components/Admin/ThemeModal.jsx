import { useState } from 'react';
import ModalFooter from './ModalFooter.jsx';
import { FONT_OPTIONS, applyThemeVars } from '../../lib/themeVars.js';

/* The site's real documented brand colors (DESIGN.md / base.css :root) —
   used both as this modal's defaults when nothing's been overridden yet,
   and as the exact target of the "Orijinal Renklere Dön" preset. Distinct
   from the light/dark-mode variants base.css also defines; this is the
   canonical brand value used for admin-facing defaults. */
const ORIGINAL = {
  brand: '#22703c',
  cta: '#ff751f',
  surface: '#22703c',
  fontFamily: 'arial',
  fontScale: 1,
  borderOpacity: 0.06,
  surfaceTint: 0
};

const COLOR_FIELDS = [
  { key: 'brand', label: 'Ana Marka Rengi (Yeşil tonları)', hint: 'Logo, ikon, rozet, kenarlık' },
  { key: 'cta', label: 'Buton & Vurgu Rengi (Turuncu tonları)', hint: '"Teklif Alın" gibi aksiyon butonları, ışıma' },
  { key: 'surface', label: 'Arka Plan & Kart Vurgusu', hint: 'Bölüm kenarlıkları ve kart vurgu tonu' }
];

export default function ThemeModal({ initial, doc, onChange, onClose, onToast }) {
  const initialSettings = { ...ORIGINAL, ...initial };
  const [settings, setSettings] = useState(initialSettings);

  /* Live-previews into the iframe's own document as knobs move — visual
     only, not a commit. The draft only reaches the parent's editCount /
     "Değişiklikleri Kaydet" pipeline when Uygula is pressed. */
  function preview(patch) {
    const next = { ...settings, ...patch };
    setSettings(next);
    applyThemeVars(doc, next);
  }

  function restoreOriginal() {
    preview(ORIGINAL);
  }

  function handleApply() {
    onChange(settings);
    onToast('success', 'Tema Uygulandı ✓', 1500);
    onClose();
  }

  function handleCancel() {
    applyThemeVars(doc, initialSettings);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center" onMouseDown={(e) => e.target === e.currentTarget && handleCancel()}>
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative w-full max-w-sm max-h-[85vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#171b18] p-5">
        <div className="flex items-center justify-between mb-4">
          <span className="font-label-caps text-[13px] font-bold tracking-[0.06em] text-white">Tipografi &amp; Tema</span>
          <button type="button" onClick={handleCancel} className="text-white/40 hover:text-white text-[18px] leading-none">×</button>
        </div>

        <p className="font-label-caps text-[10px] font-bold tracking-[0.06em] text-white/40 mb-3">Renk Paleti</p>
        <div className="flex flex-col gap-4 mb-5">
          {COLOR_FIELDS.map((f) => (
            <div key={f.key} className="flex items-center gap-3">
              <input
                type="color"
                value={settings[f.key]}
                onChange={(e) => preview({ [f.key]: e.target.value })}
                className="h-10 w-14 shrink-0 rounded-lg border border-white/10 bg-transparent cursor-pointer"
              />
              <div className="min-w-0">
                <p className="text-[12px] font-bold text-white/90">{f.label}</p>
                <p className="text-[11px] text-white/40 truncate">{f.hint}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="font-label-caps text-[10px] font-bold tracking-[0.06em] text-white/40 mb-3">Yazı Tipi</p>
        <div className="mb-3">
          <select
            value={settings.fontFamily}
            onChange={(e) => preview({ fontFamily: e.target.value })}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[13px] text-white focus:outline-none focus:border-emerald-400"
          >
            {FONT_OPTIONS.map((f) => (
              <option key={f.id} value={f.id}>{f.label}</option>
            ))}
          </select>
        </div>

        <div className="mb-5">
          <label className="flex items-center justify-between text-[11px] text-white/50 mb-1">
            <span>Yazı Boyutu Ölçeği</span><span>{settings.fontScale.toFixed(2)}x</span>
          </label>
          <input
            type="range"
            min="0.85"
            max="1.25"
            step="0.01"
            value={settings.fontScale}
            onChange={(e) => preview({ fontScale: Number(e.target.value) })}
            className="w-full accent-emerald-400"
          />
        </div>

        <p className="font-label-caps text-[10px] font-bold tracking-[0.06em] text-white/40 mb-3">Yüzey &amp; Kenarlık</p>
        <div className="mb-3">
          <label className="flex items-center justify-between text-[11px] text-white/50 mb-1">
            <span>Kart / Yüzey Rengi Tonu</span><span>%{settings.surfaceTint}</span>
          </label>
          <input
            type="range"
            min="0"
            max="30"
            step="1"
            value={settings.surfaceTint}
            onChange={(e) => preview({ surfaceTint: Number(e.target.value) })}
            title="Kart ve bölüm arka planlarına ana marka renginden ne kadar karışım eklendiği"
            className="w-full accent-emerald-400"
          />
        </div>
        <div className="mb-4">
          <label className="flex items-center justify-between text-[11px] text-white/50 mb-1">
            <span>Kenarlık Opaklığı</span><span>{Math.round(settings.borderOpacity * 100)}%</span>
          </label>
          <input
            type="range"
            min="0.02"
            max="0.2"
            step="0.01"
            value={settings.borderOpacity}
            onChange={(e) => preview({ borderOpacity: Number(e.target.value) })}
            className="w-full accent-emerald-400"
          />
        </div>

        <button
          type="button"
          onClick={restoreOriginal}
          className="w-full font-label-caps text-[11px] font-bold tracking-[0.06em] bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 py-2.5 rounded-full transition-colors duration-200"
        >
          Orijinal Ayarlara Dön
        </button>

        <ModalFooter onApply={handleApply} onCancel={handleCancel} />
      </div>
    </div>
  );
}
