import { useState } from 'react';

const PRESETS = ['#22703c', '#ff751f', '#0ea5e9', '#8b5cf6', '#e11d48', '#14b8a6'];
const PREVIEW_STYLE_ID = 'iona-theme-vars-preview';

export default function ThemeModal({ initial, doc, onChange, onClose }) {
  const [accent, setAccent] = useState(initial.accent || '#22703c');

  function apply(next) {
    setAccent(next);
    onChange({ accent: next });
    if (doc) {
      let style = doc.getElementById(PREVIEW_STYLE_ID);
      if (!style) {
        style = doc.createElement('style');
        style.id = PREVIEW_STYLE_ID;
        doc.head.appendChild(style);
      }
      style.textContent = `:root, :root.dark { --color-accent: ${next}; --brand: ${next}; --brand-orange: ${next}; }`;
    }
  }

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-[#171b18] p-5">
        <div className="flex items-center justify-between mb-4">
          <span className="font-label-caps text-[13px] font-bold tracking-[0.06em] text-white">Tema — Vurgu Rengi</span>
          <button type="button" onClick={onClose} className="text-white/40 hover:text-white text-[18px] leading-none">×</button>
        </div>

        <p className="text-[12px] text-white/50 mb-4">
          Bu renk tüm sayfalarda buton, CTA ve vurgu öğelerini (--color-accent) günceller.
        </p>

        <div className="flex items-center gap-3 mb-4">
          <input
            type="color"
            value={accent}
            onChange={(e) => apply(e.target.value)}
            className="h-10 w-14 rounded-lg border border-white/10 bg-transparent cursor-pointer"
          />
          <span className="text-[13px] font-mono text-white/70">{accent}</span>
        </div>

        <div className="flex flex-wrap gap-2">
          {PRESETS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => apply(color)}
              title={color}
              style={{ background: color }}
              className={`h-7 w-7 rounded-full border-2 transition-transform duration-150 ${accent === color ? 'border-white scale-110' : 'border-white/20'}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
