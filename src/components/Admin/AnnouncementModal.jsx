import { useState } from 'react';

export default function AnnouncementModal({ initial, onChange, onClose }) {
  const [enabled, setEnabled] = useState(!!initial.enabled);
  const [text, setText] = useState(initial.text || '');
  const [link, setLink] = useState(initial.link || '');
  const [bgColor, setBgColor] = useState(initial.bgColor || '#22703c');

  function commit(patch) {
    onChange(patch);
  }

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-[#171b18] p-5">
        <div className="flex items-center justify-between mb-4">
          <span className="font-label-caps text-[13px] font-bold tracking-[0.06em] text-white">Duyuru Bandı</span>
          <button type="button" onClick={onClose} className="text-white/40 hover:text-white text-[18px] leading-none">×</button>
        </div>

        <label className="flex items-center gap-2 mb-4 cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => { setEnabled(e.target.checked); commit({ enabled: e.target.checked }); }}
            className="accent-sky-400 h-4 w-4"
          />
          <span className="text-[13px] text-white/80">Sitede göster</span>
        </label>

        <label className="block mb-4">
          <span className="block font-label-caps text-[10px] font-bold tracking-[0.06em] text-white/50 mb-1.5">Metin</span>
          <input
            type="text"
            value={text}
            onChange={(e) => { setText(e.target.value); commit({ text: e.target.value }); }}
            placeholder="Örn: Yeni IonaFlux paneli yayında!"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[13px] text-white focus:outline-none focus:border-sky-400"
          />
        </label>

        <label className="block mb-4">
          <span className="block font-label-caps text-[10px] font-bold tracking-[0.06em] text-white/50 mb-1.5">Bağlantı (opsiyonel)</span>
          <input
            type="text"
            value={link}
            onChange={(e) => { setLink(e.target.value); commit({ link: e.target.value }); }}
            placeholder="/ionaflux.html"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[13px] text-white focus:outline-none focus:border-sky-400"
          />
        </label>

        <label className="flex items-center gap-3">
          <span className="font-label-caps text-[10px] font-bold tracking-[0.06em] text-white/50">Arka Plan Rengi</span>
          <input
            type="color"
            value={bgColor}
            onChange={(e) => { setBgColor(e.target.value); commit({ bgColor: e.target.value }); }}
            className="h-8 w-12 rounded-lg border border-white/10 bg-transparent cursor-pointer"
          />
        </label>
      </div>
    </div>
  );
}
