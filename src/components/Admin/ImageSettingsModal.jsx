import { useEffect, useRef, useState } from 'react';
import { uploadImage } from '../../lib/imageUpload.js';
import ModalFooter from './ModalFooter.jsx';
import MediaPickerModal from './MediaPickerModal.jsx';

const GRID_POINTS = [
  [0, 0], [50, 0], [100, 0],
  [0, 50], [50, 50], [100, 50],
  [0, 100], [50, 100], [100, 100]
];

export default function ImageSettingsModal({ imgKey, pageId, position, initial, targetEl, onChange, onClose, onToast }) {
  const [posX, setPosX] = useState(initial.posX ?? 50);
  const [posY, setPosY] = useState(initial.posY ?? 50);
  const [scale, setScale] = useState(initial.scale ?? 1);
  const [previewSrc, setPreviewSrc] = useState(initial.src || '');
  const [uploading, setUploading] = useState(false);
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const panelRef = useRef(null);
  const draftRef = useRef({});

  const isParallax = !!initial.isParallax;
  const isBackground = !!initial.isBackground;
  const isUploadOnly = imgKey === 'ionaflux_panel';

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape') handleCancel();
    }
    function onPointerDown(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) handleCancel();
    }
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onPointerDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Live-mutates the iframe element as the admin drags — pure visual
     preview, not a commit. The draft only reaches the parent's
     editCount / "Değişiklikleri Kaydet" pipeline when Uygula is pressed;
     Vazgeç/Escape/outside-click reverts targetEl back to `initial`. */
  function applyPosition(nextX, nextY) {
    setPosX(nextX);
    setPosY(nextY);
    draftRef.current = { ...draftRef.current, posX: nextX, posY: nextY };
    if (targetEl) {
      const value = `${nextX}% ${nextY}%`;
      if (isBackground) targetEl.style.backgroundPosition = value;
      else targetEl.style.objectPosition = value;
    }
  }

  function applyScale(next) {
    setScale(next);
    draftRef.current = { ...draftRef.current, scale: next };
    if (targetEl) targetEl.style.transform = next !== 1 ? `scale(${next})` : '';
  }

  function applyImageUrl(url) {
    draftRef.current = { ...draftRef.current, src: url };
    if (targetEl) {
      if (isBackground) targetEl.style.backgroundImage = `url(${JSON.stringify(url).slice(1, -1)})`;
      else targetEl.src = url;
    }
    setPreviewSrc(url);
  }

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      onToast('error', 'Sadece görsel dosyası yükleyebilirsiniz.');
      return;
    }
    setUploading(true);
    const result = await uploadImage(file, { pageId, key: imgKey });
    setUploading(false);
    if (!result.ok) {
      onToast('error', result.error);
      return;
    }
    applyImageUrl(result.url);
    onToast('success', 'Görsel yüklendi.');
  }

  function handleApply() {
    if (Object.keys(draftRef.current).length > 0) onChange(draftRef.current);
    onToast('success', 'Görsel Ayarları Uygulandı ✓', 1500);
    onClose();
  }

  function handleCancel() {
    if (targetEl) {
      const value = `${initial.posX ?? 50}% ${initial.posY ?? 50}%`;
      if (isBackground) {
        targetEl.style.backgroundPosition = value;
        if (initial.src) targetEl.style.backgroundImage = `url(${JSON.stringify(initial.src).slice(1, -1)})`;
      } else {
        targetEl.style.objectPosition = value;
        if (initial.src) targetEl.src = initial.src;
      }
      targetEl.style.transform = initial.scale && initial.scale !== 1 ? `scale(${initial.scale})` : '';
    }
    onClose();
  }

  return (
    <div
      ref={panelRef}
      style={{ position: 'fixed', top: position.top, left: position.left }}
      className="z-50 w-[280px] rounded-2xl border border-white/10 bg-[#171b18] p-4 shadow-2xl"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="font-label-caps text-[11px] font-bold tracking-[0.06em] text-sky-400">Görsel Ayarları</span>
        <button type="button" onClick={handleCancel} className="text-white/40 hover:text-white text-[16px] leading-none">×</button>
      </div>

      <div className="rounded-lg overflow-hidden aspect-[16/10] bg-black/40 mb-3">
        {previewSrc && (
          <img
            src={previewSrc}
            alt=""
            className="w-full h-full object-cover"
            style={{ objectPosition: `${posX}% ${posY}%`, transform: !isParallax && scale !== 1 ? `scale(${scale})` : undefined }}
          />
        )}
      </div>

      <label className="block mb-4">
        <span className="block font-label-caps text-[10px] font-bold tracking-[0.06em] text-white/50 mb-1.5">
          {uploading ? 'Yükleniyor...' : 'Yeni Görsel Yükle'}
        </span>
        <input
          type="file"
          accept="image/*"
          disabled={uploading}
          onChange={handleFile}
          className="block w-full text-[11px] text-white/70 file:mr-2 file:rounded-full file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-[11px] file:font-bold file:text-white hover:file:bg-white/20"
        />
      </label>

      <button
        type="button"
        onClick={() => setShowMediaPicker(true)}
        className="w-full mb-4 -mt-2.5 font-label-caps text-[11px] font-bold tracking-[0.06em] bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 py-1.5 rounded-full transition-colors duration-200"
      >
        📁 Kütüphaneden Seç
      </button>

      {isUploadOnly ? (
        <p className="text-[11px] text-white/40 leading-snug">
          Bu görsel için yalnızca yükleme desteklenir — sabit oranlı kırpma alanı yok.
        </p>
      ) : (
        <>
          <div className="mb-4">
            <span className="block font-label-caps text-[10px] font-bold tracking-[0.06em] text-white/50 mb-1.5">Kırpma / Konum</span>
            <div className="grid grid-cols-3 gap-1 w-fit">
              {GRID_POINTS.map(([gx, gy]) => {
                const active = gx === posX && gy === posY;
                return (
                  <button
                    key={`${gx}-${gy}`}
                    type="button"
                    onClick={() => applyPosition(gx, gy)}
                    title={`${gx}% / ${gy}%`}
                    className={`h-7 w-7 rounded border transition-colors duration-150 ${
                      active ? 'bg-sky-500 border-sky-400' : 'bg-white/5 border-white/10 hover:bg-white/15'
                    }`}
                  />
                );
              })}
            </div>
          </div>

          <div className="mb-3">
            <label className="flex items-center justify-between text-[11px] text-white/50 mb-1">
              <span>Yatay (X)</span><span>{posX}%</span>
            </label>
            <input type="range" min="0" max="100" value={posX} onChange={(e) => applyPosition(Number(e.target.value), posY)} className="w-full accent-sky-400" />
          </div>
          <div className="mb-4">
            <label className="flex items-center justify-between text-[11px] text-white/50 mb-1">
              <span>Dikey (Y)</span><span>{posY}%</span>
            </label>
            <input type="range" min="0" max="100" value={posY} onChange={(e) => applyPosition(posX, Number(e.target.value))} className="w-full accent-sky-400" />
          </div>

          <div>
            <label className="flex items-center justify-between text-[11px] text-white/50 mb-1">
              <span>Yakınlaştırma</span><span>{scale.toFixed(2)}x</span>
            </label>
            <input
              type="range"
              min="1"
              max="2"
              step="0.05"
              value={scale}
              disabled={isParallax}
              onChange={(e) => applyScale(Number(e.target.value))}
              title={isParallax ? 'Bu görsel için yakınlaştırma kullanılamıyor (parallax kaydırma efekti ile çakışır)' : undefined}
              className="w-full accent-sky-400 disabled:opacity-30"
            />
          </div>
        </>
      )}

      <ModalFooter onApply={handleApply} onCancel={handleCancel} />

      <MediaPickerModal
        isOpen={showMediaPicker}
        onClose={() => setShowMediaPicker(false)}
        onSelect={(url) => {
          applyImageUrl(url);
          onToast('success', 'Görsel seçildi.', 1200);
        }}
        onToast={onToast}
      />
    </div>
  );
}
