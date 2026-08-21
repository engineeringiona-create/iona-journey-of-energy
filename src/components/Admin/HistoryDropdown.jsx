import { useEffect, useState } from 'react';
import { getSupabase } from '../../lib/supabaseClient.js';

function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'az önce';
  if (mins < 60) return `${mins} dk önce`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} sa önce`;
  return `${Math.round(hours / 24)} gün önce`;
}

export default function HistoryDropdown({ pageId, pageLabel, onRestore, onFactoryReset, onClose, onToast }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const supabase = getSupabase();

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    supabase
      .from('site_content_revisions')
      .select('*')
      .eq('page_id', pageId)
      .order('created_at', { ascending: false })
      .limit(10)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) onToast('error', error.message);
        else setRows(data || []);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [supabase, pageId, onToast]);

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-[#171b18] p-5 max-h-[70vh] flex flex-col">
        <div className="flex items-center justify-between mb-4 shrink-0">
          <span className="font-label-caps text-[13px] font-bold tracking-[0.06em] text-white">Geçmiş — {pageLabel}</span>
          <button type="button" onClick={onClose} className="text-white/40 hover:text-white text-[18px] leading-none">×</button>
        </div>

        <div className="flex-1 overflow-y-auto -mx-1 px-1">
          {!supabase && <p className="text-[13px] text-white/50">Supabase bağlı değil — geçmiş kaydı yok.</p>}
          {supabase && loading && <p className="text-[13px] text-white/50">Yükleniyor...</p>}
          {supabase && !loading && rows.length === 0 && <p className="text-[13px] text-white/50">Henüz kayıtlı sürüm yok.</p>}
          {rows.map((row) => (
            <div key={row.id} className="flex items-center justify-between gap-3 py-2 border-b border-white/5">
              <span className="text-[12px] text-white/60">{timeAgo(row.created_at)}</span>
              <button
                type="button"
                onClick={() => onRestore(row.content)}
                className="text-[11px] font-bold text-sky-400 hover:text-sky-300"
              >
                Geri Yükle
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={onFactoryReset}
          className="mt-4 shrink-0 text-[12px] font-bold text-red-400/80 hover:text-red-400 text-left"
        >
          Fabrika Ayarlarına Sıfırla
        </button>
      </div>
    </div>
  );
}
