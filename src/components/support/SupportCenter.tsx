import React, { useEffect, useMemo, useState } from 'react';
import { askSupport } from '../../lib/aiClient';
import { SUPPORT_FAQS, SUGGESTED_FAQ_IDS } from '../../data/supportFaqs';
import {
  addSupportMessage,
  createSupportConversation,
  listenMyConversations,
  listenSupportMessages,
  SupportConversation,
  SupportMessage
} from '../../lib/support';
import { useAuth } from '../../context/AuthContext';

export const SupportCenter: React.FC = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState<'ai' | 'admin'>('ai');
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [aiLines, setAiLines] = useState<{ role: 'user' | 'ai'; text: string; escalate?: boolean }[]>([]);
  const [convs, setConvs] = useState<SupportConversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<SupportMessage[]>([]);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    if (!user?.id) return;
    return listenMyConversations(user.id, (rows) => {
      setConvs(rows);
      setActiveId((cur) => {
        if (cur && rows.some((r) => r.id === cur)) return cur;
        const open = rows.find((r) => r.status === 'waiting' || r.status === 'active');
        return open?.id || rows[0]?.id || null;
      });
    });
  }, [user?.id]);

  useEffect(() => {
    if (!activeId || tab !== 'admin') return;
    return listenSupportMessages(activeId, setMsgs);
  }, [activeId, tab]);

  const conv = convs.find((c) => c.id === activeId) || null;
  const suggestions = useMemo(() => SUPPORT_FAQS.filter((f) => SUGGESTED_FAQ_IDS.includes(f.id)), []);

  const ask = async (question: string) => {
    const text = question.trim();
    if (!text) return;
    setBusy(true);
    setAiLines((prev) => [...prev, { role: 'user', text }]);
    try {
      const r = await askSupport(text);
      const escalate = Boolean(r.escalate) || /admin/i.test(r.answer || '');
      setAiLines((prev) => [...prev, { role: 'ai', text: r.answer || 'I could not answer that.', escalate }]);
    } catch {
      setAiLines((prev) => [
        ...prev,
        { role: 'ai', text: "I'll need to connect you with a Lifebencher admin to help with that.", escalate: true }
      ]);
    } finally {
      setBusy(false);
      setQ('');
    }
  };

  const escalate = async () => {
    const open = convs.find((c) => c.status === 'waiting' || c.status === 'active');
    const id = open?.id || (await createSupportConversation('Requested a Lifebencher admin'));
    await addSupportMessage(id, 'user', 'I would like to talk to an admin.');
    setActiveId(id);
    setTab('admin');
  };

  const sendLive = async () => {
    if (!draft.trim()) return;
    const open = conv && conv.status !== 'closed' ? conv.id : null;
    const id = open || (await createSupportConversation(draft.trim()));
    await addSupportMessage(id, 'user', draft.trim());
    setActiveId(id);
    setDraft('');
  };

  return (
    <div className="bg-white rounded-3xl border border-stone-200 p-4 space-y-3">
      <div>
        <h3 className="font-serif font-bold text-stone-900">Help & Support</h3>
        <p className="text-[11px] text-stone-500">AI assistance • Human support available</p>
      </div>
      <div className="flex gap-1 p-1 bg-stone-100 rounded-2xl">
        <button type="button" onClick={() => setTab('ai')} className={`flex-1 py-1.5 rounded-xl text-[11px] font-semibold ${tab === 'ai' ? 'bg-white text-stone-900' : 'text-stone-500'}`}>
          AI Assistant
        </button>
        <button type="button" onClick={() => setTab('admin')} className={`flex-1 py-1.5 rounded-xl text-[11px] font-semibold ${tab === 'admin' ? 'bg-white text-stone-900' : 'text-stone-500'}`}>
          Talk to an Admin
        </button>
      </div>
      {tab === 'ai' && (
        <div className="space-y-2">
          <p className="text-xs text-stone-600">Hi! How can we help you?</p>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((f) => (
              <button key={f.id} type="button" onClick={() => void ask(f.question)} className="text-[10px] px-2 py-1 rounded-full bg-[#2a2422] text-[#f3ece6]">
                {f.question}
              </button>
            ))}
          </div>
          <div className="max-h-48 overflow-y-auto space-y-2">
            {aiLines.map((l, i) => (
              <div key={i} className="text-[11px] leading-relaxed text-stone-700">
                <span className="font-semibold">{l.role === 'user' ? 'You' : 'AI'}: </span>
                {l.text}
                {l.escalate && (
                  <button type="button" onClick={() => void escalate()} className="block mt-1 text-[11px] font-semibold text-rose-900">
                    Talk to an Admin
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask a question" className="flex-1 text-xs px-3 py-2 rounded-xl border border-stone-300" />
            <button type="button" disabled={busy} onClick={() => void ask(q)} className="px-3 rounded-xl bg-rose-900 text-amber-100 text-xs font-semibold">
              {busy ? '…' : 'Ask'}
            </button>
          </div>
        </div>
      )}
      {tab === 'admin' && (
        <div className="space-y-2">
          <p className="text-[11px] text-stone-500">
            {!conv && 'Tap Talk to an Admin to send a request.'}
            {conv?.status === 'waiting' && 'Your request has been sent. Waiting for an admin...'}
            {conv?.status === 'active' && "You're now chatting with a Lifebencher admin."}
            {conv?.status === 'closed' && 'This conversation has been closed.'}
          </p>
          <div className="max-h-48 overflow-y-auto space-y-1.5">
            {msgs.map((m) => (
              <p key={m.id} className="text-[11px] text-stone-700">
                <span className="font-semibold">{m.senderType}: </span>
                {m.content}
              </p>
            ))}
          </div>
          {conv?.status !== 'closed' ? (
            <div className="flex gap-2">
              <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Message admin" className="flex-1 text-xs px-3 py-2 rounded-xl border border-stone-300" />
              <button type="button" onClick={() => void sendLive()} className="px-3 rounded-xl bg-rose-900 text-amber-100 text-xs font-semibold">
                Send
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => void escalate()} className="w-full py-2 rounded-xl border border-stone-300 text-xs font-semibold">
              Start New Conversation
            </button>
          )}
          {!conv && (
            <button type="button" onClick={() => void escalate()} className="w-full py-2 rounded-xl bg-rose-900 text-amber-100 text-xs font-semibold">
              Talk to an Admin
            </button>
          )}
        </div>
      )}
    </div>
  );
};
