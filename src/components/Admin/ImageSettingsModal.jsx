import { useEffect, useRef, useState } from 'react';
import { uploadImage } from '../../lib/imageUpload.js';
import ModalFooter from './ModalFooter.jsx';
import MediaPickerModal from './MediaPickerModal.jsx';

const GRID_POINTS = [
  [0, 0], [50, 0], [100, 0],
  [0, 50], [50, 50], [100, 50],
  [0, 100], [50, 100], [100, 100]
];

const PLACEMENTS = [
  { id: 'left', label: 'Sola Yasla' },
  { id: 'center', label: 'Ortala' },
  { id: 'right', label: 'Sağa Yasla' },
  { id: 'full', label: 'Tam Genişlik' }
];

const ASPECT_RATIOS = [
  { id: 'auto', label: 'Otomatik' },
  { id: '16/9', label: '16:9 Geniş' },
  { id: '4/3', label: '4:3 Klasik' },
  { id: '1/1', label: '1:1 Kare' }
];

export default function ImageSettingsModal({ imgKey, pageId, position, initial, targetEl, onChange, onClose, onToast }) {
  const [posX, setPosX] = useState(initial.posX ?? 50);
  const [posY, setPosY] = useState(initial.posY ?? 50);
  const [scale, setScale] = useState(initial.scale ?? 1);
  const [placement, setPlacement] = useState(initial.placement ?? 'full');
  const [aspectRatio, setAspectRatio] = useState(initial.aspectRatio ?? 'auto');
  const [objectFit, setObjectFit] = useState(initial.objectFit ?? 'cover');
  const [borderRadius, setBorderRadius] = useState(initial.borderRadius ?? 0);
  const [maxWidthPercent, setMaxWidthPercent] = useState(initial.maxWidthPercent ?? 100);
  const [previewSrc, setPreviewSrc] = useState(initial.src || '');
  const [uploading, setUploading] = useState(false);
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [tab, setTab] = useState('crop');
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

  /* Çerçeveleme (Phase 61) — object-fit/aspect-ratio/radius/width-scale
     apply straight to targetEl as inline styles, same live-preview-then-
     "Uygula" pattern as crop position/zoom above. Placement only visibly
     does anything once maxWidthPercent < 100 — at full width there's no
     free space left inside the element's box to align within. */
  function applyFraming(patch) {
    if ('placement' in patch) setPlacement(patch.placement);
    if ('aspectRatio' in patch) setAspectRatio(patch.aspectRatio);
    if ('objectFit' in patch) setObjectFit(patch.objectFit);
    if ('borderRadius' in patch) setBorderRadius(patch.borderRadius);
    if ('maxWidthPercent' in patch) setMaxWidthPercent(patch.maxWidthPercent);
    draftRef.current = { ...draftRef.current, ...patch };
    if (!targetEl) return;

    if ('objectFit' in patch && !isBackground) targetEl.style.objectFit = patch.objectFit;
    if ('aspectRatio' in patch) targetEl.style.aspectRatio = patch.aspectRatio === 'auto' ? '' : patch.aspectRatio;
    if ('borderRadius' in patch) targetEl.style.borderRadius = `${patch.borderRadius}px`;
    if ('maxWidthPercent' in patch) {
      const full = patch.maxWidthPercent >= 100;
      targetEl.style.maxWidth = full ? '' : `${patch.maxWidthPercent}%`;
      targetEl.style.width = full ? '' : '100%';
    }
    if ('placement' in patch) {
      const margins = { left: ['0', 'auto'], right: ['auto', '0'], center: ['auto', 'auto'], full: ['', ''] };
      const [ml, mr] = margins[patch.placement] || margins.full;
      targetEl.style.marginLeft = ml;
      targetEl.style.marginRight = mr;
      targetEl.style.display = patch.placement === 'full' ? '' : 'block';
    }
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
      if (!isBackground) targetEl.style.objectFit = initial.objectFit || '';
      targetEl.style.aspectRatio = initial.aspectRatio && initial.aspectRatio !== 'auto' ? initial.aspectRatio : '';
      targetEl.style.borderRadius = initial.borderRadius ? `${initial.borderRadius}px` : '';
      const fullWidth = (initial.maxWidthPercent ?? 100) >= 100;
      targetEl.style.maxWidth = fullWidth ? '' : `${initial.maxWidthPercent}%`;
      targetEl.style.width = fullWidth ? '' : '100%';
      const margins = { left: ['0', 'auto'], right: ['auto', '0'], center: ['auto', 'auto'], full: ['', ''] };
      const [ml, mr] = margins[initial.placement] || margins.full;
      targetEl.style.marginLeft = ml;
      targetEl.style.marginRight = mr;
      targetEl.style.display = !initial.placement || initial.placement === 'full' ? '' : 'block';
    }
    onClose();
  }

  return (
    <div
      ref={panelRef}
      style={{ position: 'fixed', top: position.top, left: position.left }}
      className="z-50 w-[300px] max-h-[85vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#171b18] p-4 shadow-2xl"
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

      <div className="flex items-center gap-1 rounded-full bg-white/5 border border-white/10 p-1 mb-4">
        <button
          type="button"
          onClick={() => setTab('crop')}
          className={`flex-1 py-1.5 rounded-full font-label-caps text-[10px] font-bold tracking-[0.06em] transition-colors duration-200 ${tab === 'crop' ? 'bg-sky-500 text-black' : 'text-white/50'}`}
        >
          Kırpma
        </button>
        <button
          type="button"
          onClick={() => setTab('frame')}
          className={`flex-1 py-1.5 rounded-full font-label-caps text-[10px] font-bold tracking-[0.06em] transition-colors duration-200 ${tab === 'frame' ? 'bg-sky-500 text-black' : 'text-white/50'}`}
        >
          Çerçeveleme
        </button>
      </div>

      {tab === 'crop' && (
        isUploadOnly ? (
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
        )
      )}

      {tab === 'frame' && (
        <>
          <div className="mb-4">
            <span className="block font-label-caps text-[10px] font-bold tracking-[0.06em] text-white/50 mb-1.5">Yerleşim</span>
            <div className="grid grid-cols-4 gap-1">
              {PLACEMENTS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyFraming({ placement: p.id })}
                  title={p.label}
                  className={`py-1.5 rounded-md border text-[9px] font-bold leading-tight ${placement === p.id ? 'bg-sky-500 border-sky-400 text-black' : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/15'}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <span className="block font-label-caps text-[10px] font-bold tracking-[0.06em] text-white/50 mb-1.5">En-Boy Oranı</span>
            <div className="grid grid-cols-2 gap-1">
              {ASPECT_RATIOS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => applyFraming({ aspectRatio: a.id })}
                  className={`py-1.5 rounded-md border text-[10px] font-bold ${aspectRatio === a.id ? 'bg-sky-500 border-sky-400 text-black' : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/15'}`}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>

          {!isBackground && (
            <div className="mb-4">
              <span className="block font-label-caps text-[10px] font-bold tracking-[0.06em] text-white/50 mb-1.5">Sığdırma</span>
              <div className="grid grid-cols-2 gap-1">
                {[{ id: 'cover', label: 'Doldur (Cover)' }, { id: 'contain', label: 'Sığdır (Contain)' }].map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => applyFraming({ objectFit: o.id })}
                    className={`py-1.5 rounded-md border text-[10px] font-bold ${objectFit === o.id ? 'bg-sky-500 border-sky-400 text-black' : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/15'}`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mb-3">
            <label className="flex items-center justify-between text-[11px] text-white/50 mb-1">
              <span>Köşe Yuvarlaklığı</span><span>{borderRadius}px</span>
            </label>
            <input type="range" min="0" max="24" step="1" value={borderRadius} onChange={(e) => applyFraming({ borderRadius: Number(e.target.value) })} className="w-full accent-sky-400" />
          </div>

          <div>
            <label className="flex items-center justify-between text-[11px] text-white/50 mb-1">
              <span>Genişlik (Ölçek)</span><span>%{maxWidthPercent}</span>
            </label>
            <input type="range" min="30" max="100" step="5" value={maxWidthPercent} onChange={(e) => applyFraming({ maxWidthPercent: Number(e.target.value) })} className="w-full accent-sky-400" />
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
