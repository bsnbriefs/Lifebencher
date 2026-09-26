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
    try {
      const r = await askSupport(q.trim());
      setA(r.answer);
    } catch (err) {
      setA(err instanceof Error ? err.message : 'Could not answer.');
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
            placeholder="e.g. How do I submit an old receipt?"
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
