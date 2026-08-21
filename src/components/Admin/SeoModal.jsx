import { useState } from 'react';
import { uploadImage } from '../../lib/imageUpload.js';
import ModalFooter from './ModalFooter.jsx';

function upsertMeta(doc, attr, key, content) {
  let el = doc.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = doc.createElement('meta');
    el.setAttribute(attr, key);
    doc.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

export default function SeoModal({ pageId, pageLabel, initial, doc, onChange, onClose, onToast }) {
  const [title, setTitle] = useState(initial.title || '');
  const [description, setDescription] = useState(initial.description || '');
  const [ogImage, setOgImage] = useState(initial.ogImage || '');
  const [uploading, setUploading] = useState(false);

  /* Live-previews into the iframe's own head as the admin types — pure
     visual feedback, not a commit. The draft only reaches the parent's
     editCount / "Değişiklikleri Kaydet" pipeline when Uygula is pressed. */
  function preview(patch) {
    if (!doc) return;
    if (patch.title !== undefined) doc.title = patch.title;
    if (patch.description !== undefined) upsertMeta(doc, 'name', 'description', patch.description);
    if (patch.ogImage !== undefined) {
      upsertMeta(doc, 'property', 'og:image', patch.ogImage);
      upsertMeta(doc, 'property', 'og:title', title);
    }
  }

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !file.type.startsWith('image/')) return;
    setUploading(true);
    const result = await uploadImage(file, { pageId, key: 'seo_og' });
    setUploading(false);
    if (!result.ok) {
      onToast('error', result.error);
      return;
    }
    setOgImage(result.url);
    preview({ ogImage: result.url });
    onToast('success', 'OG görseli yüklendi.');
  }

  function handleApply() {
    onChange({ title, description, ogImage });
    onToast('success', 'SEO Ayarları Uygulandı ✓', 1500);
    onClose();
  }

  function handleCancel() {
    preview({ title: initial.title || '', description: initial.description || '', ogImage: initial.ogImage || '' });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center" onMouseDown={(e) => e.target === e.currentTarget && handleCancel()}>
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#171b18] p-5">
        <div className="flex items-center justify-between mb-4">
          <span className="font-label-caps text-[13px] font-bold tracking-[0.06em] text-white">SEO — {pageLabel}</span>
          <button type="button" onClick={handleCancel} className="text-white/40 hover:text-white text-[18px] leading-none">×</button>
        </div>

        <label className="block mb-4">
          <span className="block font-label-caps text-[10px] font-bold tracking-[0.06em] text-white/50 mb-1.5">Sayfa Başlığı (title)</span>
          <input
            type="text"
            value={title}
            onChange={(e) => { setTitle(e.target.value); preview({ title: e.target.value }); }}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[13px] text-white focus:outline-none focus:border-sky-400"
          />
        </label>

        <label className="block mb-4">
          <span className="block font-label-caps text-[10px] font-bold tracking-[0.06em] text-white/50 mb-1.5">Meta Açıklama (description)</span>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => { setDescription(e.target.value); preview({ description: e.target.value }); }}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[13px] text-white focus:outline-none focus:border-sky-400 resize-none"
          />
        </label>

        <label className="block">
          <span className="block font-label-caps text-[10px] font-bold tracking-[0.06em] text-white/50 mb-1.5">
            {uploading ? 'Yükleniyor...' : 'OpenGraph Paylaşım Görseli'}
          </span>
          {ogImage && <img src={ogImage} alt="" className="w-full h-28 object-cover rounded-lg mb-2" />}
          <input
            type="file"
            accept="image/*"
            disabled={uploading}
            onChange={handleFile}
            className="block w-full text-[11px] text-white/70 file:mr-2 file:rounded-full file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-[11px] file:font-bold file:text-white hover:file:bg-white/20"
          />
        </label>

        <ModalFooter onApply={handleApply} onCancel={handleCancel} applyLabel="Kaydet ve Uygula" />
      </div>
    </div>
  );
}
