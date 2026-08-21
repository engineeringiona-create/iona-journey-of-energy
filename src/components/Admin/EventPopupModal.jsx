import { useState } from 'react';
import { uploadImage } from '../../lib/imageUpload.js';

export default function EventPopupModal({ initial, onChange, onClose, onToast }) {
  const [enabled, setEnabled] = useState(!!initial.enabled);
  const [title, setTitle] = useState(initial.title || '');
  const [eventInfo, setEventInfo] = useState(initial.eventInfo || '');
  const [bannerImage, setBannerImage] = useState(initial.bannerImage || '');
  const [ctaText, setCtaText] = useState(initial.ctaText || 'Kayıt Ol / Detaylar');
  const [ctaLink, setCtaLink] = useState(initial.ctaLink || '');
  const [uploading, setUploading] = useState(false);

  function commit(patch) {
    onChange(patch);
  }

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !file.type.startsWith('image/')) return;
    setUploading(true);
    const result = await uploadImage(file, { pageId: 'global', key: 'event_popup_banner' });
    setUploading(false);
    if (!result.ok) {
      onToast('error', result.error);
      return;
    }
    setBannerImage(result.url);
    commit({ bannerImage: result.url });
    onToast('success', 'Banner yüklendi.');
  }

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#171b18] p-5 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <span className="font-label-caps text-[13px] font-bold tracking-[0.06em] text-white">Etkinlik / Fuar Duyurusu</span>
          <button type="button" onClick={onClose} className="text-white/40 hover:text-white text-[18px] leading-none">×</button>
        </div>

        <label className="flex items-center gap-2 mb-4 cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => { setEnabled(e.target.checked); commit({ enabled: e.target.checked }); }}
            className="accent-sky-400 h-4 w-4"
          />
          <span className="text-[13px] text-white/80">Ana sayfada göster (oturum başına bir kez)</span>
        </label>

        <label className="block mb-4">
          <span className="block font-label-caps text-[10px] font-bold tracking-[0.06em] text-white/50 mb-1.5">Başlık</span>
          <input
            type="text"
            value={title}
            onChange={(e) => { setTitle(e.target.value); commit({ title: e.target.value }); }}
            placeholder="Örn: IONA, Biogas Expo 2026'da"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[13px] text-white focus:outline-none focus:border-sky-400"
          />
        </label>

        <label className="block mb-4">
          <span className="block font-label-caps text-[10px] font-bold tracking-[0.06em] text-white/50 mb-1.5">Tarih / Konum</span>
          <input
            type="text"
            value={eventInfo}
            onChange={(e) => { setEventInfo(e.target.value); commit({ eventInfo: e.target.value }); }}
            placeholder="12-14 Eylül 2026 · İstanbul"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[13px] text-white focus:outline-none focus:border-sky-400"
          />
        </label>

        <div className="mb-4">
          <span className="block font-label-caps text-[10px] font-bold tracking-[0.06em] text-white/50 mb-1.5">
            {uploading ? 'Yükleniyor...' : 'Banner Görseli'}
          </span>
          {bannerImage && <img src={bannerImage} alt="" className="w-full h-24 object-cover rounded-lg mb-2" />}
          <input
            type="file"
            accept="image/*"
            disabled={uploading}
            onChange={handleFile}
            className="block w-full text-[11px] text-white/70 file:mr-2 file:rounded-full file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-[11px] file:font-bold file:text-white hover:file:bg-white/20"
          />
        </div>

        <label className="block mb-4">
          <span className="block font-label-caps text-[10px] font-bold tracking-[0.06em] text-white/50 mb-1.5">CTA Buton Metni</span>
          <input
            type="text"
            value={ctaText}
            onChange={(e) => { setCtaText(e.target.value); commit({ ctaText: e.target.value }); }}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[13px] text-white focus:outline-none focus:border-sky-400"
          />
        </label>

        <label className="block">
          <span className="block font-label-caps text-[10px] font-bold tracking-[0.06em] text-white/50 mb-1.5">CTA Link</span>
          <input
            type="text"
            value={ctaLink}
            onChange={(e) => { setCtaLink(e.target.value); commit({ ctaLink: e.target.value }); }}
            placeholder="/iletisim.html"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[13px] text-white focus:outline-none focus:border-sky-400"
          />
        </label>
      </div>
    </div>
  );
}
