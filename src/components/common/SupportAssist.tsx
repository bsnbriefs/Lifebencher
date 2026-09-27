import React, { useState } from 'react';
import { askSupport } from '../../lib/aiClient';

export const SupportAssist: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [a, setA] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const ask = async () => {
    if (!q.trim()) return;
    setBusy(true);
    setA(null);
    try {
      const r = await askSupport(q.trim());
      if (r.answer?.trim()) {
        setA(r.answer.trim());
      } else {
        setA('No answer came back. Try again in a moment.');
      }
    } catch {
      setA('Could not reach support right now. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-3 space-y-2">
      <button type="button" className="text-xs font-semibold text-stone-800" onClick={() => setOpen(!open)}>
        Questions about Lifebencher
      </button>
      {open && (
        <>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="e.g. How does Lifebencher work?"
            className="w-full text-xs px-3 py-2 rounded-xl border border-stone-300"
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => void ask()}
            className="w-full py-2 rounded-xl bg-rose-900 text-amber-100 text-xs font-semibold"
          >
            {busy ? 'Thinking…' : 'Ask'}
          </button>
          {a && <p className="text-[11px] text-stone-600 leading-relaxed">{a}</p>}
        </>
      )}
    </div>
  );
};
