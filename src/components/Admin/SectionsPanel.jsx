import { useState } from 'react';

export default function SectionsPanel({ sections, onToggle, onClose }) {
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
      <div className="relative w-full max-w-sm h-full bg-[#171b18] border-l border-white/10 flex flex-col">
        <div className="h-14 shrink-0 flex items-center justify-between px-5 border-b border-white/10">
          <span className="font-label-caps text-[13px] font-bold tracking-[0.06em] text-white">Bölüm Görünürlüğü</span>
          <button type="button" onClick={onClose} className="text-white/40 hover:text-white text-[18px] leading-none">×</button>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {sections.length === 0 && <p className="p-2 text-[13px] text-white/50">Bu sayfada tanımlı bölüm bulunamadı.</p>}
          {sections.map((s) => {
            const isHidden = hidden.has(s.id);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => toggle(s.id)}
                className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors duration-150"
              >
                <span className={`text-[13px] font-mono truncate ${isHidden ? 'text-white/30 line-through' : 'text-white/80'}`}>{s.id}</span>
                <span className={`material-symbols-outlined text-[20px] shrink-0 ${isHidden ? 'text-white/30' : 'text-sky-400'}`}>
                  {isHidden ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
