import React, { useState } from 'react';
import { askSupport } from '../../lib/aiClient';

function localAnswer(q: string): string {
  const s = q.toLowerCase();
  if (s.includes('receipt') || s.includes('already paid') || s.includes('bank')) {
    return 'If you paid before this website, open the matchmaking pay screen, choose a package, upload your receipt or bank alert from the gallery, and submit. Admin confirms on Billing. Do not pay again.';
  }
  if (s.includes('price') || s.includes('cost') || s.includes('naira') || s.includes('₦')) {
    return 'Nigeria matchmaking is ₦30,000 (up to 3 introductions). International is ₦50,000. Lifebencher Plus is ₦5,000/month. Profile Boost is ₦1,000 for 24 hours. New card payments use Flutterwave.';
  }
  if (s.includes('discover') || s.includes('visible') || s.includes('hidden')) {
    return 'Your profile stays hidden on Discover until a matchmaking payment is verified or an admin approves it.';
  }
  if (s.includes('password') || s.includes('login') || s.includes('phone')) {
    return 'Use email and password, or Google. Forgot password is on the Email login tab. Phone SMS can fail depending on Firebase; email always works.';
  }
  return '';
}

export const SupportAssist: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [a, setA] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const ask = async () => {
    if (!q.trim()) return;
    setBusy(true);
    const fallback = localAnswer(q);
    try {
      const r = await askSupport(q.trim());
      setA(r.answer || fallback);
    } catch {
      setA(
        fallback ||
          'Live chat assist is paused. Nigeria ₦30,000 · Abroad ₦50,000 · Plus ₦5,000/month. Upload an old receipt on the pay screen if you already paid. Email login if phone SMS fails.'
      );
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
