import { useEffect, useMemo, useState } from 'react';
import { listMedia, uploadToLibrary, deleteFromLibrary } from '../../lib/mediaLibrary.js';
import { MAX_UPLOAD_BYTES, ALLOWED_MIME_TYPES } from '../../lib/imageUpload.js';

function formatBytes(bytes) {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
}

/* Global reusable picker — two ways to use it:
   - onSelect provided: clicking a thumbnail selects that image's URL
     into the caller's form field and closes the modal (the "Kütüphaneden
     Seç" flow every image field wires into).
   - onSelect omitted: standalone browse/manage mode for the dedicated
     "Medya Kütüphanesi" admin tab — clicking a thumbnail just opens the
     preview lightbox instead, since there's no target field to fill. */
export default function MediaPickerModal({ isOpen, onClose, onSelect, onToast }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [uploadQueue, setUploadQueue] = useState([]); // {id, name, status: 'uploading'|'done'|'error', error?}
  const [previewItem, setPreviewItem] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);

  useEffect(() => {
    if (isOpen) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  async function refresh() {
    setLoading(true);
    const result = await listMedia();
    setLoading(false);
    if (!result.ok) {
      onToast('error', result.error);
      return;
    }
    setItems(result.items);
  }

  function validateFile(file) {
    if (!ALLOWED_MIME_TYPES.includes(file.type)) return 'Desteklenmeyen dosya türü (PNG, JPG, WEBP, SVG).';
    if (file.size > MAX_UPLOAD_BYTES) return 'Dosya çok büyük (maks. 10MB).';
    return null;
  }

  async function handleFiles(fileList) {
    const files = Array.from(fileList || []);
    if (files.length === 0) return;

    const queueEntries = files.map((file) => ({ id: `${Date.now()}-${file.name}-${Math.random()}`, name: file.name, status: 'uploading' }));
    setUploadQueue((cur) => [...cur, ...queueEntries]);

    const outcomes = await Promise.all(
      files.map(async (file, i) => {
        const entryId = queueEntries[i].id;
        const validationError = validateFile(file);
        if (validationError) {
          setUploadQueue((cur) => cur.map((q) => (q.id === entryId ? { ...q, status: 'error', error: validationError } : q)));
          return false;
        }
        const result = await uploadToLibrary(file);
        if (!result.ok) {
          setUploadQueue((cur) => cur.map((q) => (q.id === entryId ? { ...q, status: 'error', error: result.error } : q)));
          return false;
        }
        setUploadQueue((cur) => cur.map((q) => (q.id === entryId ? { ...q, status: 'done' } : q)));
        return true;
      })
    );

    refresh();
    setTimeout(() => setUploadQueue((cur) => cur.filter((q) => q.status === 'uploading')), 2500);
    const succeeded = outcomes.filter(Boolean).length;
    if (succeeded > 0) onToast('success', `${succeeded} dosya yüklendi.`, 1800);
    if (succeeded < files.length) onToast('error', `${files.length - succeeded} dosya yüklenemedi.`, 2400);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  }

  function handleCopy(item) {
    navigator.clipboard.writeText(item.url).then(
      () => onToast('success', 'URL kopyalandı.', 1200),
      () => onToast('error', 'Kopyalanamadı.')
    );
  }

  async function handleDeleteConfirmed() {
    const item = pendingDelete;
    setPendingDelete(null);
    const result = await deleteFromLibrary(item.path);
    if (!result.ok) {
      onToast('error', result.error);
      return;
    }
    setItems((cur) => cur.filter((i) => i.path !== item.path));
    onToast('success', 'Görsel silindi.', 1500);
  }

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.name.toLowerCase().includes(q));
  }, [items, search]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative w-full max-w-4xl h-[85vh] rounded-2xl border border-white/10 bg-[#171b18] flex flex-col overflow-hidden">
        <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-white/10">
          <span className="font-label-caps text-[13px] font-bold tracking-[0.06em] text-white">📁 Medya Kütüphanesi</span>
          <button type="button" onClick={onClose} className="text-white/40 hover:text-white text-[18px] leading-none">×</button>
        </div>

        <div className="shrink-0 px-5 pt-4 flex items-center gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Dosya adına göre ara..."
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[13px] text-white focus:outline-none focus:border-sky-400"
          />
          <label className="shrink-0 cursor-pointer bg-sky-500 hover:bg-sky-400 text-white font-label-caps text-[11px] font-bold tracking-[0.06em] px-4 py-2.5 rounded-full transition-colors duration-200">
            ⬆️ Yükle
            <input
              type="file"
              accept={ALLOWED_MIME_TYPES.join(',')}
              multiple
              className="hidden"
              onChange={(e) => {
                handleFiles(e.target.files);
                e.target.value = '';
              }}
            />
          </label>
        </div>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`mx-5 mt-3 rounded-xl border-2 border-dashed transition-colors duration-150 ${
            dragOver ? 'border-sky-400 bg-sky-500/10' : 'border-white/10'
          } ${uploadQueue.length > 0 ? 'p-3' : 'py-4'} shrink-0`}
        >
          {uploadQueue.length === 0 ? (
            <p className="text-center text-[12px] text-white/40">Dosyaları buraya sürükleyip bırakın</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {uploadQueue.map((q) => (
                <div key={q.id} className="flex items-center gap-2 text-[11px]">
                  <span className="flex-1 truncate text-white/70">{q.name}</span>
                  {q.status === 'uploading' && <span className="text-sky-400 shrink-0">Yükleniyor...</span>}
                  {q.status === 'done' && <span className="text-emerald-400 shrink-0">✓ Tamamlandı</span>}
                  {q.status === 'error' && <span className="text-red-400 shrink-0">{q.error || 'Hata'}</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading && <p className="text-[13px] text-white/40 text-center mt-8">Yükleniyor...</p>}
          {!loading && filteredItems.length === 0 && (
            <p className="text-[13px] text-white/40 text-center mt-8">
              {items.length === 0 ? 'Kütüphane boş — yukarıdan bir görsel yükleyin.' : 'Sonuç bulunamadı.'}
            </p>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {filteredItems.map((item) => (
              <div key={item.path} className="group relative rounded-lg overflow-hidden border border-white/10 bg-black/20">
                <button
                  type="button"
                  onClick={() => (onSelect ? (onSelect(item.url), onClose()) : setPreviewItem(item))}
                  className="block w-full aspect-square"
                >
                  <img src={item.url} alt={item.name} loading="lazy" className="w-full h-full object-cover" />
                </button>

                <div className="absolute inset-x-0 top-0 flex justify-end gap-1 p-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 bg-gradient-to-b from-black/60 to-transparent">
                  <button type="button" title="URL'yi Kopyala" onClick={() => handleCopy(item)} className="h-7 w-7 rounded-full bg-black/50 hover:bg-black/70 text-white text-[13px] flex items-center justify-center">📋</button>
                  <button type="button" title="Önizle" onClick={() => setPreviewItem(item)} className="h-7 w-7 rounded-full bg-black/50 hover:bg-black/70 text-white text-[13px] flex items-center justify-center">🔍</button>
                  <button type="button" title="Sil" onClick={() => setPendingDelete(item)} className="h-7 w-7 rounded-full bg-black/50 hover:bg-red-600/80 text-white text-[13px] flex items-center justify-center">🗑️</button>
                </div>

                <div className="p-2 bg-black/40">
                  <p className="text-[11px] text-white/80 truncate">{item.name.replace(/^\d+-/, '')}</p>
                  <p className="text-[10px] text-white/40">{formatBytes(item.size)} · {formatDate(item.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {previewItem && (
        <div className="fixed inset-0 z-[66] flex items-center justify-center p-8 bg-black/85" onMouseDown={(e) => e.target === e.currentTarget && setPreviewItem(null)}>
          <button type="button" onClick={() => setPreviewItem(null)} className="absolute top-5 right-5 text-white/60 hover:text-white text-[24px] leading-none">×</button>
          <img src={previewItem.url} alt={previewItem.name} className="max-w-full max-h-full object-contain rounded-lg" />
        </div>
      )}

      {pendingDelete && (
        <div className="fixed inset-0 z-[67] flex items-center justify-center p-4 bg-black/70" onMouseDown={(e) => e.target === e.currentTarget && setPendingDelete(null)}>
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#1c211d] p-5">
            <p className="text-[13px] text-white mb-1 font-bold">Görsel silinsin mi?</p>
            <p className="text-[12px] text-white/50 mb-4 truncate">{pendingDelete.name}</p>
            <p className="text-[11px] text-amber-400/90 mb-4">
              Bu görseli kullanan formlar varsa görsel bağlantısı kırılabilir.
            </p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setPendingDelete(null)} className="flex-1 border border-white/10 text-white/70 font-label-caps text-[12px] rounded-full py-2.5">Vazgeç</button>
              <button type="button" onClick={handleDeleteConfirmed} className="flex-1 bg-red-600 hover:bg-red-500 text-white font-label-caps text-[12px] font-bold rounded-full py-2.5">Sil</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
