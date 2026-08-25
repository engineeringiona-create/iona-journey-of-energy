import { useState } from 'react';
import { uploadImage } from '../../lib/imageUpload.js';
import ModalFooter from './ModalFooter.jsx';
import LinkedInImportModal from './LinkedInImportModal.jsx';

function makeId() {
  return `ann_${Date.now()}_${Math.round(Math.random() * 1000)}`;
}

function blank() {
  return {
    id: makeId(),
    title: 'Yeni Duyuru',
    category: '',
    date: '',
    description: '',
    bannerImage: '',
    ctaEnabled: true,
    ctaText: 'Kayıt Ol / Detaylar',
    ctaLink: '',
    showInPopup: false
  };
}

export default function AnnouncementsModal({ initial, onChange, onClose, onToast }) {
  const [list, setList] = useState(initial.list || []);
  const [activeId, setActiveId] = useState((initial.list || [])[0]?.id || null);
  const [uploading, setUploading] = useState(false);
  const [showLinkedInImport, setShowLinkedInImport] = useState(false);

  function handleLinkedInImport(item) {
    commit([...list, item]);
    setActiveId(item.id);
  }

  /* Local draft only — reaches the parent's editCount / "Değişiklikleri
     Kaydet" pipeline once, when Uygula is pressed. */
  function commit(nextList) {
    setList(nextList);
  }

  function handleApply() {
    onChange({ list });
    onToast('success', 'Duyurular Uygulandı ✓', 1500);
    onClose();
  }

  function addItem() {
    const item = blank();
    commit([...list, item]);
    setActiveId(item.id);
  }

  function updateActive(patch) {
    commit(list.map((a) => (a.id === activeId ? { ...a, ...patch } : a)));
  }

  function removeActive() {
    const next = list.filter((a) => a.id !== activeId);
    commit(next);
    setActiveId(next[0]?.id || null);
  }

  function move(delta) {
    const i = list.findIndex((a) => a.id === activeId);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= list.length) return;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    commit(next);
  }

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !file.type.startsWith('image/') || !activeId) return;
    setUploading(true);
    const result = await uploadImage(file, { pageId: 'global', key: `announcement_${activeId}` });
    setUploading(false);
    if (!result.ok) {
      onToast('error', result.error);
      return;
    }
    updateActive({ bannerImage: result.url });
    onToast('success', 'Banner yüklendi.');
  }

  const active = list.find((a) => a.id === activeId);

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative w-full max-w-2xl rounded-2xl border border-white/10 bg-[#171b18] p-5 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between mb-4 shrink-0">
          <span className="font-label-caps text-[13px] font-bold tracking-[0.06em] text-white">Duyuru Yöneticisi</span>
          <button type="button" onClick={onClose} className="text-white/40 hover:text-white text-[18px] leading-none">×</button>
        </div>

        <div className="flex gap-4 flex-1 min-h-0">
          <div className="w-56 shrink-0 flex flex-col">
            <div className="flex-1 overflow-y-auto flex flex-col gap-1">
              {list.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setActiveId(a.id)}
                  className={`text-left px-3 py-2 rounded-lg text-[12px] truncate ${a.id === activeId ? 'bg-sky-500/20 text-sky-300' : 'text-white/60 hover:bg-white/5'}`}
                >
                  {a.title || 'İsimsiz'}
                </button>
              ))}
              {list.length === 0 && <p className="text-[11px] text-white/40 px-3">Henüz duyuru yok.</p>}
            </div>
            <button
              type="button"
              onClick={addItem}
              className="mt-3 shrink-0 font-label-caps text-[11px] font-bold tracking-[0.06em] bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 py-2 rounded-full transition-colors duration-200"
            >
              + Yeni Duyuru
            </button>
            <button
              type="button"
              onClick={() => setShowLinkedInImport(true)}
              className="mt-2 shrink-0 font-label-caps text-[11px] font-bold tracking-[0.06em] bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 text-sky-300 py-2 rounded-full transition-colors duration-200"
            >
              ✨ LinkedIn'den AI ile Duyuru Oluştur
            </button>
          </div>

          {active && (
            <div className="flex-1 overflow-y-auto flex flex-col gap-3 pr-1">
              <div className="flex gap-2">
                <button type="button" onClick={() => move(-1)} className="text-[11px] font-bold text-white/50 hover:text-white">↑ Yukarı</button>
                <button type="button" onClick={() => move(1)} className="text-[11px] font-bold text-white/50 hover:text-white">↓ Aşağı</button>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!active.showInPopup}
                  onChange={(e) => updateActive({ showInPopup: e.target.checked })}
                  className="accent-sky-400 h-4 w-4"
                />
                <span className="text-[13px] text-white/80">Açılır Pop-Up'ta Göster</span>
              </label>

              <label className="block">
                <span className="block font-label-caps text-[10px] font-bold tracking-[0.06em] text-white/50 mb-1.5">Başlık</span>
                <input
                  type="text"
                  value={active.title}
                  onChange={(e) => updateActive({ title: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[13px] text-white focus:outline-none focus:border-sky-400"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="block font-label-caps text-[10px] font-bold tracking-[0.06em] text-white/50 mb-1.5">Kategori/Etiket</span>
                  <input
                    type="text"
                    value={active.category}
                    onChange={(e) => updateActive({ category: e.target.value })}
                    placeholder="Fuar, Şirket Haberi..."
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[13px] text-white focus:outline-none focus:border-sky-400"
                  />
                </label>
                <label className="block">
                  <span className="block font-label-caps text-[10px] font-bold tracking-[0.06em] text-white/50 mb-1.5">Tarih</span>
                  <input
                    type="text"
                    value={active.date}
                    onChange={(e) => updateActive({ date: e.target.value })}
                    placeholder="12-14 Eylül 2026"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[13px] text-white focus:outline-none focus:border-sky-400"
                  />
                </label>
              </div>

              <label className="block">
                <span className="block font-label-caps text-[10px] font-bold tracking-[0.06em] text-white/50 mb-1.5">Açıklama</span>
                <textarea
                  rows={4}
                  value={active.description}
                  onChange={(e) => updateActive({ description: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[13px] text-white focus:outline-none focus:border-sky-400 resize-none"
                />
              </label>

              <div>
                <span className="block font-label-caps text-[10px] font-bold tracking-[0.06em] text-white/50 mb-1.5">
                  {uploading ? 'Yükleniyor...' : 'Banner Görseli'}
                </span>
                {active.bannerImage && <img src={active.bannerImage} alt="" className="w-full h-24 object-cover rounded-lg mb-2" />}
                <input
                  type="file"
                  accept="image/*"
                  disabled={uploading}
                  onChange={handleFile}
                  className="block w-full text-[11px] text-white/70 file:mr-2 file:rounded-full file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-[11px] file:font-bold file:text-white hover:file:bg-white/20"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!active.ctaEnabled}
                  onChange={(e) => updateActive({ ctaEnabled: e.target.checked })}
                  className="accent-sky-400 h-4 w-4"
                />
                <span className="text-[13px] text-white/80">CTA Butonu Göster</span>
              </label>

              {active.ctaEnabled && (
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="block font-label-caps text-[10px] font-bold tracking-[0.06em] text-white/50 mb-1.5">CTA Buton Metni</span>
                    <input
                      type="text"
                      value={active.ctaText}
                      onChange={(e) => updateActive({ ctaText: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[13px] text-white focus:outline-none focus:border-sky-400"
                    />
                  </label>
                  <label className="block">
                    <span className="block font-label-caps text-[10px] font-bold tracking-[0.06em] text-white/50 mb-1.5">CTA Link</span>
                    <input
                      type="text"
                      value={active.ctaLink}
                      onChange={(e) => updateActive({ ctaLink: e.target.value })}
                      placeholder="/iletisim.html"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[13px] text-white focus:outline-none focus:border-sky-400"
                    />
                  </label>
                </div>
              )}

              <button type="button" onClick={removeActive} className="text-[11px] font-bold text-red-400/80 hover:text-red-400 text-left">
                Bu Duyuruyu Sil
              </button>
            </div>
          )}
        </div>

        <ModalFooter onApply={handleApply} onCancel={onClose} />
      </div>

      {showLinkedInImport && (
        <LinkedInImportModal
          onImport={handleLinkedInImport}
          onClose={() => setShowLinkedInImport(false)}
          onToast={onToast}
        />
      )}
    </div>
  );
}
