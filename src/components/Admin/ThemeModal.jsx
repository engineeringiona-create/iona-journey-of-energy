import { useState } from 'react';

/* The site's real documented brand colors (DESIGN.md / base.css :root) —
   used both as this modal's defaults when nothing's been overridden yet,
   and as the exact target of the "Orijinal Renklere Dön" preset. Distinct
   from the light/dark-mode variants base.css also defines; this is the
   canonical brand value used for admin-facing defaults. */
const ORIGINAL = { brand: '#22703c', cta: '#ff751f', surface: '#22703c' };
const PREVIEW_STYLE_ID = 'iona-theme-vars-preview';

const FIELDS = [
  { key: 'brand', label: 'Ana Marka Rengi (Yeşil tonları)', hint: 'Logo, ikon, rozet, kenarlık' },
  { key: 'cta', label: 'Buton & Vurgu Rengi (Turuncu tonları)', hint: '"Teklif Alın" gibi aksiyon butonları, ışıma' },
  { key: 'surface', label: 'Arka Plan & Kart Vurgusu', hint: 'Bölüm kenarlıkları ve kart vurgu tonu' }
];

function applyPreview(doc, colors) {
  if (!doc) return;
  let style = doc.getElementById(PREVIEW_STYLE_ID);
  if (!style) {
    style = doc.createElement('style');
    style.id = PREVIEW_STYLE_ID;
    doc.head.appendChild(style);
  }
  style.textContent = `:root, :root.dark {
    --color-accent: ${colors.cta};
    --brand: ${colors.brand};
    --brand-orange: ${colors.cta};
    --border-green: color-mix(in srgb, ${colors.surface} 24%, transparent);
  }`;
}

export default function ThemeModal({ initial, doc, onChange, onClose }) {
  const [colors, setColors] = useState({
    brand: initial.brand || ORIGINAL.brand,
    cta: initial.cta || ORIGINAL.cta,
    surface: initial.surface || ORIGINAL.surface
  });

  function apply(patch) {
    const next = { ...colors, ...patch };
    setColors(next);
    onChange(patch);
    applyPreview(doc, next);
  }

  function restoreOriginal() {
    apply(ORIGINAL);
  }

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-[#171b18] p-5">
        <div className="flex items-center justify-between mb-4">
          <span className="font-label-caps text-[13px] font-bold tracking-[0.06em] text-white">Tema — Renk Paleti</span>
          <button type="button" onClick={onClose} className="text-white/40 hover:text-white text-[18px] leading-none">×</button>
        </div>

        <div className="flex flex-col gap-4 mb-4">
          {FIELDS.map((f) => (
            <div key={f.key} className="flex items-center gap-3">
              <input
                type="color"
                value={colors[f.key]}
                onChange={(e) => apply({ [f.key]: e.target.value })}
                className="h-10 w-14 shrink-0 rounded-lg border border-white/10 bg-transparent cursor-pointer"
              />
              <div className="min-w-0">
                <p className="text-[12px] font-bold text-white/90">{f.label}</p>
                <p className="text-[11px] text-white/40 truncate">{f.hint}</p>
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={restoreOriginal}
          className="w-full font-label-caps text-[11px] font-bold tracking-[0.06em] bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 py-2.5 rounded-full transition-colors duration-200"
        >
          Orijinal Renklere Dön (Yeşil &amp; Turuncu)
        </button>
      </div>
    </div>
  );
}
