import { useState } from 'react';
import { transformLinkedInPost } from '../../lib/linkedinImport.js';
import { uploadImage } from '../../lib/imageUpload.js';
import MediaPickerModal from './MediaPickerModal.jsx';

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function makeId() {
  return `ann_${Date.now()}_${Math.round(Math.random() * 1000)}`;
}

export default function LinkedInImportModal({ onImport, onClose, onToast }) {
  const [rawText, setRawText] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [postDate, setPostDate] = useState(todayISO());
  const [targetLanguage, setTargetLanguage] = useState('tr');
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [aiResult, setAiResult] = useState(null);
  const [showMediaPicker, setShowMediaPicker] = useState(false);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !file.type.startsWith('image/')) return;
    setUploading(true);
    const result = await uploadImage(file, { pageId: 'global', key: `linkedin_import_${Date.now()}` });
    setUploading(false);
    if (!result.ok) {
      onToast('error', result.error);
      return;
    }
    setImageUrl(result.url);
  }

  async function handleGenerate() {
    if (!rawText.trim()) {
      setError('Ham LinkedIn gönderi metnini yapıştırın.');
      return;
    }
    setError('');
    setGenerating(true);
    const outcome = await transformLinkedInPost(rawText.trim(), targetLanguage);
    setGenerating(false);
    if (!outcome.ok) {
      setError(outcome.error);
      return;
    }
    setAiResult(outcome.result);
  }

  function handleApprove() {
    if (!aiResult) return;
    onImport({
      id: makeId(),
      title: aiResult.title,
      category: aiResult.category,
      date: postDate || todayISO(),
      description: aiResult.body_markdown,
      bannerImage: imageUrl,
      ctaEnabled: true,
      ctaText: 'Kayıt Ol / Detaylar',
      ctaLink: '',
      showInPopup: false,
      tags: Array.isArray(aiResult.tags) ? aiResult.tags : [],
    });
    onToast('success', 'AI taslağı duyurulara eklendi — yayınlamadan önce gözden geçirin.', 2200);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative w-full max-w-xl rounded-2xl border border-white/10 bg-[#171b18] p-5 max-h-[88vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <span className="font-label-caps text-[13px] font-bold tracking-[0.06em] text-white">✨ LinkedIn'den AI ile Duyuru Oluştur</span>
          <button type="button" onClick={onClose} className="text-white/40 hover:text-white text-[18px] leading-none">×</button>
        </div>

        {!aiResult ? (
          <>
            <label className="block mb-4">
              <span className="block font-label-caps text-[10px] font-bold tracking-[0.06em] text-white/50 mb-1.5">Ham LinkedIn Gönderi Metni</span>
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                rows={8}
                placeholder="LinkedIn gönderisinin metnini buraya yapıştırın..."
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[13px] text-white resize-none focus:outline-none focus:border-sky-400"
              />
            </label>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <label className="block">
                <span className="block font-label-caps text-[10px] font-bold tracking-[0.06em] text-white/50 mb-1.5">Görsel URL</span>
                <input
                  type="text"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[13px] text-white focus:outline-none focus:border-sky-400"
                />
              </label>
              <label className="block">
                <span className="block font-label-caps text-[10px] font-bold tracking-[0.06em] text-white/50 mb-1.5">veya Dosya Yükle</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFile}
                  disabled={uploading}
                  className="w-full text-[12px] text-white/70 file:mr-2 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-white file:text-[12px]"
                />
                <button
                  type="button"
                  onClick={() => setShowMediaPicker(true)}
                  className="mt-1.5 w-full font-label-caps text-[11px] font-bold tracking-[0.06em] bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 py-1.5 rounded-lg transition-colors duration-200"
                >
                  📁 Kütüphaneden Seç
                </button>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <label className="block">
                <span className="block font-label-caps text-[10px] font-bold tracking-[0.06em] text-white/50 mb-1.5">Gönderi Tarihi</span>
                <input
                  type="date"
                  value={postDate}
                  onChange={(e) => setPostDate(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[13px] text-white focus:outline-none focus:border-sky-400"
                />
              </label>
              <label className="block">
                <span className="block font-label-caps text-[10px] font-bold tracking-[0.06em] text-white/50 mb-1.5">Hedef Dil</span>
                <select
                  value={targetLanguage}
                  onChange={(e) => setTargetLanguage(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[13px] text-white focus:outline-none focus:border-sky-400"
                >
                  <option value="tr">Türkçe</option>
                  <option value="en">English</option>
                </select>
              </label>
            </div>

            {error && <p className="text-[12px] text-red-400 mb-3">{error}</p>}

            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating || uploading}
              className="w-full flex items-center justify-center gap-2 bg-sky-500 text-white font-label-caps text-[13px] font-bold rounded-full py-3 disabled:opacity-50"
            >
              {generating ? 'Oluşturuluyor...' : '✨ AI ile Oluştur'}
            </button>
          </>
        ) : (
          <>
            <div className="mb-4">
              <span className="inline-block bg-sky-500/20 text-sky-300 text-[11px] font-bold px-2.5 py-1 rounded-full mb-3">{aiResult.category}</span>
              <h3 className="text-white font-bold text-[18px] mb-2">{aiResult.title}</h3>
              <p className="text-white/70 text-[13px] whitespace-pre-wrap leading-relaxed">{aiResult.description || aiResult.body_markdown}</p>
              {aiResult.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {aiResult.tags.map((tag) => (
                    <span key={tag} className="text-[11px] text-white/50 bg-white/5 px-2 py-1 rounded-full">#{tag}</span>
                  ))}
                </div>
              )}
              {imageUrl && <img src={imageUrl} alt="" className="w-full rounded-lg mt-3 max-h-48 object-cover" />}
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setAiResult(null)} className="flex-1 border border-white/10 text-white/70 font-label-caps text-[13px] rounded-full py-3">
                Geri Dön
              </button>
              <button type="button" onClick={handleApprove} className="flex-1 bg-sky-500 text-white font-label-caps text-[13px] font-bold rounded-full py-3">
                Onayla ve Ekle
              </button>
            </div>
          </>
        )}
      </div>

      <MediaPickerModal
        isOpen={showMediaPicker}
        onClose={() => setShowMediaPicker(false)}
        onSelect={(url) => setImageUrl(url)}
        onToast={onToast}
      />
    </div>
  );
}
