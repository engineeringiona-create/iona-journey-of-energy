import { useState } from 'react';

/* Phase 61: "Sayfa Düzeni & Bölümler" — reorder/visibility/title manager
   for the homepage's real <section id="..."> blocks. The task that asked
   for this named eight logical sections (Hero, Showcase3D, Hakkımızda,
   Hizmetler, Sektörler, BiyogazHesaplayici, Duyurular, Iletisim), but
   index.html's actual DOM only has seven, and four of those names
   (Hizmetler/Sektörler/Duyurular/Iletisim) are separate *pages*, not
   homepage sections — there's nothing on this page to move/hide/rename
   under those names. LABELS below maps the real ids to human labels
   instead of inventing sections that don't exist and would silently do
   nothing when toggled. titleKey/eyebrowKey are only set where the
   section actually has a matching data-i18n key in index.html; sections
   without one (stats, biogaz-hesaplayici — both hardcoded text, no key
   at all yet) just don't get a title field, rather than a fake one that
   edits nothing. */
export const SECTION_LABELS = {
  hero: { label: 'Hero', titleKey: 'home.hero.slide1_title' },
  'about-teaser': { label: 'Hakkımızda', eyebrowKey: 'home.about.eyebrow', titleKey: 'home.about.title' },
  'ionaflux-teaser': { label: 'Showcase3D (IonaFlux)', titleKey: 'home.ionaflux.title' },
  'why-choose-us': { label: 'Neden Iona', eyebrowKey: 'home.why.eyebrow', titleKey: 'home.why.title' },
  explore: { label: 'Keşfedin', eyebrowKey: 'home.explore.eyebrow', titleKey: 'home.explore.title' },
  stats: { label: 'İstatistikler' },
  'biogaz-hesaplayici': { label: 'Biyogaz Hesaplayıcı' }
};

export default function SectionsPanel({ sections, texts, onToggle, onMove, onEditText, onClose }) {
  const [hidden, setHidden] = useState(() => new Set(sections.filter((s) => s.hidden).map((s) => s.id)));

  function toggle(id) {
    const next = new Set(hidden);
    const nowHidden = !next.has(id);
    if (nowHidden) next.add(id);
    else next.delete(id);
    setHidden(next);
    onToggle(id, nowHidden);
  }

  return (
    <div className="fixed inset-0 z-[55] flex justify-end" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative w-full max-w-md h-full bg-[#171b18] border-l border-white/10 flex flex-col">
        <div className="h-14 shrink-0 flex items-center justify-between px-5 border-b border-white/10">
          <span className="font-label-caps text-[13px] font-bold tracking-[0.06em] text-white">Sayfa Düzeni &amp; Bölümler</span>
          <button type="button" onClick={onClose} className="text-white/40 hover:text-white text-[18px] leading-none">×</button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
          {sections.length === 0 && <p className="p-2 text-[13px] text-white/50">Bu sayfada tanımlı bölüm bulunamadı.</p>}
          {sections.map((s, i) => {
            const isHidden = hidden.has(s.id);
            const meta = SECTION_LABELS[s.id] || { label: s.id };
            const eyebrowVal = meta.eyebrowKey ? (texts[meta.eyebrowKey] ?? '') : null;
            const titleVal = meta.titleKey ? (texts[meta.titleKey] ?? '') : null;
            return (
              <div key={s.id} className={`rounded-lg border border-white/10 p-2.5 ${isHidden ? 'opacity-50' : ''}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => onMove(i, -1)}
                      disabled={i === 0}
                      title="Yukarı taşı"
                      className="h-6 w-6 rounded bg-white/5 hover:bg-white/15 disabled:opacity-20 disabled:pointer-events-none text-white/70 flex items-center justify-center text-[14px]"
                    >
                      ⬆️
                    </button>
                    <button
                      type="button"
                      onClick={() => onMove(i, 1)}
                      disabled={i === sections.length - 1}
                      title="Aşağı taşı"
                      className="h-6 w-6 rounded bg-white/5 hover:bg-white/15 disabled:opacity-20 disabled:pointer-events-none text-white/70 flex items-center justify-center text-[14px]"
                    >
                      ⬇️
                    </button>
                  </div>
                  <span className={`flex-1 text-[13px] font-bold truncate ${isHidden ? 'text-white/40 line-through' : 'text-white/90'}`}>
                    {meta.label}
                  </span>
                  <button
                    type="button"
                    onClick={() => toggle(s.id)}
                    title={isHidden ? 'Göster' : 'Gizle'}
                    className={`h-7 w-7 rounded-full shrink-0 flex items-center justify-center text-[15px] ${isHidden ? 'bg-white/5 text-white/30' : 'bg-emerald-500/15 text-emerald-400'}`}
                  >
                    👁️
                  </button>
                </div>
                {(eyebrowVal !== null || titleVal !== null) && (
                  <div className="mt-2 flex flex-col gap-1.5 pl-1">
                    {eyebrowVal !== null && (
                      <input
                        type="text"
                        value={eyebrowVal}
                        onChange={(e) => onEditText(meta.eyebrowKey, e.target.value)}
                        placeholder="Üst başlık (eyebrow)"
                        className="w-full bg-white/5 border border-white/10 rounded-md px-2.5 py-1.5 text-[12px] text-white/80 focus:outline-none focus:border-emerald-400"
                      />
                    )}
                    {titleVal !== null && (
                      <input
                        type="text"
                        value={titleVal}
                        onChange={(e) => onEditText(meta.titleKey, e.target.value)}
                        placeholder="Başlık"
                        className="w-full bg-white/5 border border-white/10 rounded-md px-2.5 py-1.5 text-[12px] text-white/80 focus:outline-none focus:border-emerald-400"
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
