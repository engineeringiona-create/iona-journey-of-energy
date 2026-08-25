import { useEffect, useRef, useState } from 'react';
import { sendCopilotMessage } from '../../lib/adminCopilot.js';

function makeId() {
  return `msg_${Date.now()}_${Math.round(Math.random() * 1000)}`;
}

/* Persistent floating chat, independent of LiveEditor's exclusive `panel`
   state on purpose — the admin should be able to keep it open while
   editing content elsewhere, not have it compete with the other modals
   for a single panel slot. */
export default function CopilotChat({ onProposeAnnouncement, onToast }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, sending]);

  function toApiHistory(list) {
    return list.map((m) => ({ role: m.role, parts: [{ text: m.text }] }));
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;
    const userMsg = { id: makeId(), role: 'user', text };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput('');
    setSending(true);

    const outcome = await sendCopilotMessage(toApiHistory(nextMessages));
    setSending(false);

    if (!outcome.ok) {
      setMessages((cur) => [...cur, { id: makeId(), role: 'model', text: `⚠️ ${outcome.error}` }]);
      return;
    }

    if (outcome.type === 'proposal') {
      const p = outcome.proposal;
      setMessages((cur) => [
        ...cur,
        { id: makeId(), role: 'model', text: `Duyuru taslağı hazırladım: "${p.title}"`, proposal: p },
      ]);
    } else {
      setMessages((cur) => [...cur, { id: makeId(), role: 'model', text: outcome.text || '(boş yanıt)' }]);
    }
  }

  function handleApprove(messageId, proposal) {
    /* Maps the raw Gemini tool-call args onto the announcement item shape
       AnnouncementsModal/LinkedInImportModal already use — body_markdown
       -> description is the one field name that actually differs; the
       rest (date/ctaEnabled/showInPopup) just get sane defaults since the
       chat never collected them the way the LinkedIn import form does. */
    onProposeAnnouncement({
      title: proposal.title,
      category: proposal.category,
      date: new Date().toISOString().slice(0, 10),
      description: proposal.body_markdown,
      bannerImage: '',
      ctaEnabled: true,
      ctaText: 'Kayıt Ol / Detaylar',
      ctaLink: '',
      showInPopup: false,
      tags: Array.isArray(proposal.tags) ? proposal.tags : [],
    });
    setMessages((cur) => cur.map((m) => (m.id === messageId ? { ...m, proposalApproved: true } : m)));
    onToast('success', 'Duyuru taslağı Duyuru Yöneticisi listesine eklendi.', 2200);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-[70] flex items-center gap-2 rounded-full border border-white/15 bg-[#171b18]/90 backdrop-blur-md px-5 py-3.5 text-white shadow-2xl hover:border-sky-400/50 transition-colors duration-200"
      >
        <span className="text-[16px]">✨</span>
        <span className="font-label-caps text-[12px] font-bold tracking-[0.06em]">IONA AI Assistant</span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-[70] w-full max-w-sm h-[560px] max-h-[80vh] flex flex-col rounded-2xl border border-white/15 bg-[#171b18]/85 backdrop-blur-xl shadow-2xl overflow-hidden">
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/5">
        <span className="font-label-caps text-[12px] font-bold tracking-[0.06em] text-white flex items-center gap-2">
          <span>✨</span> IONA AI Assistant
        </span>
        <button type="button" onClick={() => setOpen(false)} className="text-white/40 hover:text-white text-[18px] leading-none">×</button>
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        {messages.length === 0 && (
          <p className="text-[12px] text-white/40 text-center mt-6 leading-relaxed">
            Duyuru taslağı isteyin ("bu metinden duyuru oluştur..."), gelen mesajları sorun
            ("son lead'leri göster") ya da kapasite hesaplattırın ("50 ton büyükbaş gübre ile ne kadar güç çıkar?").
          </p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap ${
                m.role === 'user' ? 'bg-sky-500 text-white' : 'bg-white/8 border border-white/10 text-white/90'
              }`}
            >
              {m.text}
              {m.proposal && (
                <div className="mt-3 rounded-xl border border-white/15 bg-black/20 p-3">
                  <span className="inline-block bg-sky-500/20 text-sky-300 text-[10px] font-bold px-2 py-0.5 rounded-full mb-2">
                    {m.proposal.category}
                  </span>
                  <p className="text-[13px] font-bold text-white mb-1">{m.proposal.title}</p>
                  <p className="text-[12px] text-white/60 line-clamp-3">{m.proposal.body_markdown}</p>
                  {m.proposalApproved ? (
                    <p className="text-[11px] text-emerald-400 font-bold mt-2">✓ Eklendi</p>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleApprove(m.id, m.proposal)}
                      className="mt-2 w-full bg-sky-500 text-white font-label-caps text-[11px] font-bold rounded-full py-2"
                    >
                      Onayla ve Ekle
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-white/8 border border-white/10 rounded-2xl px-3.5 py-2.5 text-[13px] text-white/50">
              Yazıyor...
            </div>
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-white/10 p-3 flex gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder="Bir mesaj yazın..."
          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-[13px] text-white resize-none focus:outline-none focus:border-sky-400"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={sending || !input.trim()}
          className="bg-sky-500 text-white rounded-xl px-4 py-2 text-[13px] font-bold disabled:opacity-40 shrink-0"
        >
          Gönder
        </button>
      </div>
    </div>
  );
}
