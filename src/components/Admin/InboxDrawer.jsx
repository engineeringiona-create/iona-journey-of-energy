import { useEffect, useState } from 'react';
import { getSupabase } from '../../lib/supabaseClient.js';

export default function InboxDrawer({ onClose, onToast }) {
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
      .from('contact_submissions')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) onToast('error', error.message);
        else setRows(data || []);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [supabase, onToast]);

  async function markRead(row) {
    const { error } = await supabase.from('contact_submissions').update({ is_read: true }).eq('id', row.id);
    if (error) {
      onToast('error', error.message);
      return;
    }
    setRows((current) => current.map((r) => (r.id === row.id ? { ...r, is_read: true } : r)));
  }

  async function remove(row) {
    if (!window.confirm(`${row.name} adlı kişinin mesajı silinsin mi?`)) return;
    const { error } = await supabase.from('contact_submissions').delete().eq('id', row.id);
    if (error) {
      onToast('error', error.message);
      return;
    }
    setRows((current) => current.filter((r) => r.id !== row.id));
  }

  return (
    <div className="fixed inset-0 z-[55] flex justify-end" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative w-full max-w-md h-full bg-[#171b18] border-l border-white/10 flex flex-col">
        <div className="h-14 shrink-0 flex items-center justify-between px-5 border-b border-white/10">
          <span className="font-label-caps text-[13px] font-bold tracking-[0.06em] text-white">Gelen Kutusu</span>
          <button type="button" onClick={onClose} className="text-white/40 hover:text-white text-[18px] leading-none">×</button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {!supabase && (
            <p className="p-5 text-[13px] text-white/50">
              Supabase bağlı değil — .env dosyasına VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY ekleyin.
            </p>
          )}
          {supabase && loading && <p className="p-5 text-[13px] text-white/50">Yükleniyor...</p>}
          {supabase && !loading && rows.length === 0 && (
            <p className="p-5 text-[13px] text-white/50">Henüz mesaj yok.</p>
          )}
          {rows.map((row) => {
            const isQuote = row.page_source === 'teklif_talebi';
            return (
            <div key={row.id} className={`p-4 border-b border-white/5 ${row.is_read ? 'opacity-60' : ''}`}>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="text-[13px] font-bold text-white flex items-center gap-2">
                  {!row.is_read && <span className="h-2 w-2 rounded-full bg-sky-400 shrink-0" />}
                  {row.name}
                </span>
                <span className="text-[11px] text-white/40 shrink-0">{new Date(row.created_at).toLocaleString('tr-TR')}</span>
              </div>
              <span className={`inline-block text-[10px] font-bold tracking-[0.04em] px-2 py-0.5 rounded-full mb-1.5 ${isQuote ? 'bg-orange-500/15 text-orange-400' : 'bg-emerald-500/15 text-emerald-400'}`}>
                {isQuote ? 'Teklif Talebi' : 'İletişim Mesajı'}
              </span>
              <p className="text-[12px] text-white/50 mb-1">{row.email}{row.phone ? ` · ${row.phone}` : ''}{row.subject ? ` — ${row.subject}` : ''}</p>
              <p className="text-[13px] text-white/80 whitespace-pre-wrap mb-3">{row.message}</p>
              <div className="flex gap-3">
                {!row.is_read && (
                  <button type="button" onClick={() => markRead(row)} className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300">
                    Okundu İşaretle
                  </button>
                )}
                <button type="button" onClick={() => remove(row)} className="text-[11px] font-bold text-red-400/80 hover:text-red-400">
                  Sil
                </button>
              </div>
            </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
