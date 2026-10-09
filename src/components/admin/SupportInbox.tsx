import React, { useEffect, useState } from 'react';
import { listenAllProfiles } from '../../lib/admin';
import { useAuth } from '../../context/AuthContext';
import { Profile } from '../../types';
import {
  addSupportMessage,
  adminSetSupportStatus,
  listenSupportInbox,
  listenSupportMessages,
  openSupportWithClient,
  SUPPORT_TEMPLATES,
  SupportConversation,
  SupportMessage
} from '../../lib/support';

export const SupportInbox: React.FC = () => {
  const { user } = useAuth();
  const [clients, setClients] = useState<Profile[]>([]);
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<SupportConversation[]>([]);
  const [filter, setFilter] = useState<'waiting' | 'active' | 'closed'>('waiting');
  const [openId, setOpenId] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<SupportMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [pickedName, setPickedName] = useState('');

  useEffect(() => listenAllProfiles(setClients), []);
  useEffect(() => listenSupportInbox(setRows), []);
  useEffect(() => {
    if (!openId) return;
    return listenSupportMessages(openId, setMsgs);
  }, [openId]);

  const list = rows.filter((r) => r.status === filter);
  const current = rows.find((r) => r.id === openId);

  const take = async (id: string) => {
    await adminSetSupportStatus(id, 'active', user?.id || null);
    setOpenId(id);
    setFilter('active');
  };

  const send = async () => {
    if (!openId || !draft.trim()) return;
    await addSupportMessage(openId, 'admin', draft.trim());
    setDraft('');
  };

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-stone-900">1. Pick a client</p>
      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name" className="w-full text-xs px-3 py-2 rounded-xl border border-stone-300 bg-white" />
      <div className="max-h-48 overflow-y-auto space-y-1">
        {clients.filter((c) => !search || (c.displayName || '').toLowerCase().includes(search.toLowerCase())).slice(0, 12).map((c) => (
          <button key={c.id} type="button" className="w-full text-left text-xs bg-white border border-stone-200 rounded-xl px-3 py-2" onClick={() => {
            setNotice('Opening chat…');
            setPickedName(c.displayName || 'this client');
            void openSupportWithClient(c.userId || c.id, c.displayName).then((id) => {
              setOpenId(id);
              setFilter('active');
              setNotice(null);
            }).catch((err) => setNotice(err instanceof Error ? err.message : 'Could not open this chat. Publish the updated Firestore rules.'));
          }}>
            Message {c.displayName || 'Unnamed client'}
          </button>
        ))}
        {clients.length === 0 && <p className="text-xs text-stone-500">No registered clients loaded yet.</p>}
      </div>
      {notice && <p className="text-xs text-rose-800">{notice}</p>}
      {(current || openId) && <p className="text-sm font-semibold text-stone-900">2. Write to {current?.userName || pickedName}</p>}
      <div className="flex flex-wrap gap-1">
        {SUPPORT_TEMPLATES.map((text, index) => (
          <button key={text.slice(0, 18)} type="button" className="px-2 py-1 rounded-full border border-stone-200 text-[10px]" onClick={() => setDraft(text)}>{['Profile', 'Photos', 'Onboarding', 'Payment', 'Account'][index]}</button>
        ))}
      </div>
      <div className="flex gap-1.5">
        {(['waiting', 'active', 'closed'] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={`px-3 py-1.5 rounded-full text-[11px] font-semibold border ${
              filter === id ? 'bg-stone-900 text-amber-100 border-stone-900' : 'bg-white text-stone-600 border-stone-200'
            }`}
          >
            {id === 'waiting' ? 'Needs reply' : id === 'active' ? 'Open' : 'Closed'}
          </button>
        ))}
      </div>
      {list.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => void take(c.id)}
          className="w-full text-left bg-white rounded-2xl border border-stone-200 p-3"
        >
          <p className="text-xs font-semibold text-stone-900">{c.userName || c.userEmail || c.userId.slice(0, 8)}</p>
          <p className="text-[10px] text-stone-500">{c.userEmail}</p>
          <p className="text-[11px] text-stone-600 truncate">{c.lastMessage}</p>
        </button>
      ))}
      {list.length === 0 && <p className="text-xs text-stone-500 text-center py-6">No {filter} conversations.</p>}
      {(current || openId) && (
        <div className="bg-white rounded-2xl border border-stone-200 p-3 space-y-2">
          <div className="flex justify-between items-center">
            <p className="text-xs font-semibold">{current?.userName || pickedName}</p>
            {current && <button type="button" className="text-[11px] font-semibold" onClick={() => void adminSetSupportStatus(current.id, 'closed', current.assignedAdminId)}>Close</button>}
          </div>
          <div className="max-h-48 overflow-y-auto space-y-1">
            {msgs.map((m) => (
              <p key={m.id} className="text-[11px]">
                <span className="font-semibold">{m.senderType}: </span>
                {m.content}
              </p>
            ))}
          </div>
          {openId && (
            <div className="flex gap-2">
              <input value={draft} onChange={(e) => setDraft(e.target.value)} className="flex-1 text-xs px-3 py-2 rounded-xl border border-stone-300" placeholder="Write a message" />
              <button type="button" onClick={() => void send().catch((err) => setNotice(err instanceof Error ? err.message : 'Could not send'))} className="px-3 rounded-xl bg-rose-900 text-amber-100 text-xs font-semibold">
                Send
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
