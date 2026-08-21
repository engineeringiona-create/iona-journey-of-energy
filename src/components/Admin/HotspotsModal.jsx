import { useState } from 'react';
import ModalFooter from './ModalFooter.jsx';

function makeId() {
  return `pin_${Date.now()}_${Math.round(Math.random() * 1000)}`;
}

export default function HotspotsModal({ initial, onChange, onClose, onToast }) {
  const [list, setList] = useState(initial.list || []);
  const [activeId, setActiveId] = useState(list[0]?.id || null);

  /* Local draft only — reaches the parent's editCount / "Değişiklikleri
     Kaydet" pipeline once, when Uygula is pressed. */
  function commit(nextList) {
    setList(nextList);
  }

  function handleApply() {
    onChange({ list });
    onToast('success', '3D Bilgi Noktaları Uygulandı ✓', 1500);
    onClose();
  }

  function addPin() {
    const pin = { id: makeId(), title: 'Yeni Nokta', description: '', x: 50, y: 50 };
    const next = [...list, pin];
    commit(next);
    setActiveId(pin.id);
  }

  function updateActive(patch) {
    const next = list.map((p) => (p.id === activeId ? { ...p, ...patch } : p));
    commit(next);
  }

  function removeActive() {
    const next = list.filter((p) => p.id !== activeId);
    commit(next);
    setActiveId(next[0]?.id || null);
  }

  function placeActive(e) {
    if (!activeId) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);
    updateActive({ x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) });
  }

  const active = list.find((p) => p.id === activeId);

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#171b18] p-5 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-4 shrink-0">
          <span className="font-label-caps text-[13px] font-bold tracking-[0.06em] text-white">3D Model Bilgi Noktaları</span>
          <button type="button" onClick={onClose} className="text-white/40 hover:text-white text-[18px] leading-none">×</button>
        </div>

        <p className="text-[11px] text-white/40 mb-2">Teknoloji sayfasındaki 3D modelin üzerine konumlandırılır. Aşağıdaki kutuya tıklayarak seçili noktayı taşıyın.</p>

        <div
          onClick={placeActive}
          className="relative w-full aspect-[16/10] rounded-lg bg-white/5 border border-white/10 mb-3 cursor-crosshair shrink-0"
        >
          {list.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={(e) => { e.stopPropagation(); setActiveId(p.id); }}
              style={{ left: `${p.x}%`, top: `${p.y}%` }}
              className={`absolute -translate-x-1/2 -translate-y-1/2 h-4 w-4 rounded-full border-2 ${p.id === activeId ? 'bg-sky-400 border-white scale-125' : 'bg-orange-400/80 border-white/60'}`}
              title={p.title}
            />
          ))}
          {list.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-[11px] text-white/30">Henüz nokta yok</div>
          )}
        </div>

        <button
          type="button"
          onClick={addPin}
          className="mb-4 shrink-0 font-label-caps text-[11px] font-bold tracking-[0.06em] bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 py-2 rounded-full transition-colors duration-200"
        >
          + Yeni Nokta Ekle
        </button>

        {active && (
          <div className="flex-1 overflow-y-auto flex flex-col gap-3">
            <label className="block">
              <span className="block font-label-caps text-[10px] font-bold tracking-[0.06em] text-white/50 mb-1.5">Başlık</span>
              <input
                type="text"
                value={active.title}
                onChange={(e) => updateActive({ title: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[13px] text-white focus:outline-none focus:border-sky-400"
              />
            </label>
            <label className="block">
              <span className="block font-label-caps text-[10px] font-bold tracking-[0.06em] text-white/50 mb-1.5">Açıklama</span>
              <textarea
                rows={3}
                value={active.description}
                onChange={(e) => updateActive({ description: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[13px] text-white focus:outline-none focus:border-sky-400 resize-none"
              />
            </label>
            <button
              type="button"
              onClick={removeActive}
              className="text-[11px] font-bold text-red-400/80 hover:text-red-400 text-left"
            >
              Bu Noktayı Sil
            </button>
          </div>
        )}

        <ModalFooter onApply={handleApply} onCancel={onClose} />
      </div>
    </div>
  );
}
