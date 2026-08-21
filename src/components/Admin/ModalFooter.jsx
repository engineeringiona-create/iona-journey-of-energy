export default function ModalFooter({ onApply, onCancel, applyLabel = 'Uygula', cancelLabel = 'Vazgeç' }) {
  return (
    <div className="flex items-center justify-end gap-2 mt-5 pt-4 border-t border-white/10">
      <button
        type="button"
        onClick={onCancel}
        className="font-label-caps text-[11px] font-bold tracking-[0.06em] text-white/50 hover:text-white/80 px-4 py-2.5 rounded-full transition-colors duration-200"
      >
        {cancelLabel}
      </button>
      <button
        type="button"
        onClick={onApply}
        className="flex items-center gap-1.5 font-label-caps text-[11px] font-bold tracking-[0.06em] bg-emerald-500 text-black px-5 py-2.5 rounded-full hover:brightness-110 transition-all duration-200"
      >
        <span className="material-symbols-outlined text-[16px] leading-none">check</span>
        {applyLabel}
      </button>
    </div>
  );
}
