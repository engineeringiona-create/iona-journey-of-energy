import { useEffect, useState } from 'react';
import { getSupabase } from '../../lib/supabaseClient.js';
import { diffContent } from '../../lib/contentDiff.js';

const FETCH_LIMIT = 11; // 10 to show + 1 older row to diff the oldest shown row against

function formatTimestamp(iso) {
  const d = new Date(iso);
  const datePart = d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' });
  const timePart = d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  return `${datePart} ${timePart}`;
}

export default function HistoryDropdown({ pageId, pageLabel, onRestore, onFactoryReset, onClose, onToast }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
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
      .limit(FETCH_LIMIT)
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

  const visibleRows = rows.slice(0, 10);

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#171b18] p-5 max-h-[75vh] flex flex-col">
        <div className="flex items-center justify-between mb-4 shrink-0">
          <span className="font-label-caps text-[13px] font-bold tracking-[0.06em] text-white">Geçmiş — {pageLabel}</span>
          <button type="button" onClick={onClose} className="text-white/40 hover:text-white text-[18px] leading-none">×</button>
        </div>

        <div className="flex-1 overflow-y-auto -mx-1 px-1">
          {!supabase && <p className="text-[13px] text-white/50">Supabase bağlı değil — geçmiş kaydı yok.</p>}
          {supabase && loading && <p className="text-[13px] text-white/50">Yükleniyor...</p>}
          {supabase && !loading && visibleRows.length === 0 && <p className="text-[13px] text-white/50">Henüz kayıtlı sürüm yok.</p>}
          {visibleRows.map((row, i) => {
            const older = rows[i + 1]; // one row older, chronologically — the diff baseline
            const changes = diffContent(older?.content, row.content);
            const isExpanded = expandedId === row.id;
            return (
              <div key={row.id} className="py-2.5 border-b border-white/5">
                <div className="flex items-center justify-between gap-3 mb-1">
                  <span className="text-[12px] font-bold text-white/80">{formatTimestamp(row.created_at)}</span>
                  <button
                    type="button"
                    onClick={() => onRestore(row.content)}
                    className="text-[11px] font-bold text-sky-400 hover:text-sky-300 shrink-0"
                  >
                    Bu Sürüme Geri Dön
                  </button>
                </div>

                {changes.length === 0 ? (
                  <p className="text-[11px] text-white/40">{older ? 'Değişiklik bulunamadı.' : 'İlk kayıtlı sürüm.'}</p>
                ) : (
                  <>
                    <p className="text-[11px] text-white/50 mb-1">
                      Değişen alanlar: {changes.map((c) => c.label).join(', ')}
                    </p>
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : row.id)}
                      className="text-[11px] font-bold text-white/60 hover:text-white"
                    >
                      {isExpanded ? 'Farkı gizle ▲' : 'Eski vs Yeni farkını göster ▼'}
                    </button>
                    {isExpanded && (
                      <div className="mt-2 flex flex-col gap-2">
                        {changes.map((c, idx) => (
                          <div key={idx} className="rounded-lg bg-white/5 p-2">
                            <p className="text-[10px] font-bold text-white/50 mb-1">{c.label}</p>
                            <p className="text-[11px] text-red-300/80 line-through truncate">{String(c.oldValue)}</p>
                            <p className="text-[11px] text-emerald-300/90 truncate">{String(c.newValue)}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
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
