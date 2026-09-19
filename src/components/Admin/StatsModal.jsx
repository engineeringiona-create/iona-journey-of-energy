import { useEffect, useState } from 'react';
import { getSupabase } from '../../lib/supabaseClient.js';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export default function StatsModal({ onClose, onToast }) {
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [byPage, setByPage] = useState([]);
  const supabase = getSupabase();

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const since = new Date(Date.now() - SEVEN_DAYS_MS).toISOString();
    supabase
      .from('page_views')
      .select('page_path')
      .gte('created_at', since)
      .limit(5000)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          onToast('error', error.message);
          setLoading(false);
          return;
        }
        const counts = {};
        (data || []).forEach((row) => {
          counts[row.page_path] = (counts[row.page_path] || 0) + 1;
        });
        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        setTotal(data?.length || 0);
        setByPage(sorted);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [supabase, onToast]);

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-[#171b18] p-5 max-h-[70vh] flex flex-col">
        <div className="flex items-center justify-between mb-4 shrink-0">
          <span className="font-label-caps text-[13px] font-bold tracking-[0.06em] text-white">İstatistikler — Son 7 Gün</span>
          <button type="button" onClick={onClose} className="text-white/40 hover:text-white text-[18px] leading-none">×</button>
        </div>

        {!supabase && <p className="text-[13px] text-white/50">Supabase bağlı değil — istatistik yok.</p>}
        {supabase && loading && <p className="text-[13px] text-white/50">Yükleniyor...</p>}

        {supabase && !loading && (
          <>
            <div className="mb-4 shrink-0">
              <p className="text-[32px] font-extrabold text-white leading-none">{total}</p>
              <p className="text-[11px] text-white/50 mt-1">toplam sayfa görüntüleme</p>
            </div>
            <div className="flex-1 overflow-y-auto">
              <p className="font-label-caps text-[10px] font-bold tracking-[0.06em] text-white/50 mb-2">En Çok Ziyaret Edilenler</p>
              {byPage.length === 0 && <p className="text-[12px] text-white/40">Henüz veri yok.</p>}
              {byPage.map(([path, count]) => (
                <div key={path} className="flex items-center justify-between gap-3 py-1.5 border-b border-white/5">
                  <span className="text-[12px] text-white/80 truncate font-mono">{path}</span>
                  <span className="text-[12px] font-bold text-sky-400 shrink-0">{count}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
