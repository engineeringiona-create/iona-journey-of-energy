import { useEffect } from 'react';

export default function Toast({ toast, onDismiss }) {
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(onDismiss, toast.duration || 3000);
    return () => clearTimeout(t);
  }, [toast, onDismiss]);

  if (!toast) return null;
  const isError = toast.type === 'error';

  return (
    <div
      role="status"
      className={`fixed bottom-6 right-6 z-[60] max-w-sm rounded-xl border px-4 py-3 text-[13px] font-semibold shadow-lg ${
        isError ? 'bg-red-500/15 border-red-500/40 text-red-300' : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
      }`}
    >
      {toast.message}
    </div>
  );
}
