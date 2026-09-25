import React, { useEffect, useState } from 'react';
import { Crown, Sparkles } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  BillingTransaction,
  EMPTY_ENTITLEMENTS,
  Entitlements,
  createPendingTransaction,
  listenEntitlements,
  listenMyTransactions,
  planActive
} from '../../lib/billing';
import { PRODUCTS, formatNgn } from '../../lib/products';

export const MembershipPanel: React.FC = () => {
  const { user } = useAuth();
  const [ent, setEnt] = useState<Entitlements>(EMPTY_ENTITLEMENTS(user?.id || ''));
  const [txs, setTxs] = useState<BillingTransaction[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    const a = listenEntitlements(user.id, setEnt);
    const b = listenMyTransactions(user.id, setTxs);
    return () => {
      a();
      b();
    };
  }, [user?.id]);

  const requestProduct = async (productId: string) => {
    setBusy(productId);
    setNote(null);
    try {
      await createPendingTransaction(productId);
      setNote('Request recorded as pending. Access unlocks after Lifebencher confirms payment — the app will not unlock from this screen alone.');
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'Could not start this request.');
    } finally {
      setBusy(null);
    }
  };

  const activePlan = planActive(ent) ? ent.plan : 'free';

  return (
    <div className="bg-white rounded-3xl p-5 border border-stone-200/90 shadow-sm space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-serif font-bold text-base text-stone-900 flex items-center gap-2">
            <Crown className="w-4 h-4 text-amber-700" />
            Membership & Billing
          </h3>
          <p className="text-[11px] text-stone-500 mt-1">
            Current plan: <span className="font-semibold text-stone-800 capitalize">{activePlan}</span>
            {ent.planExpiresAt && planActive(ent) ? ` · until ${new Date(ent.planExpiresAt).toLocaleDateString()}` : ''}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div className="p-2.5 rounded-2xl bg-stone-50 border border-stone-200/70">
          <span className="block text-stone-400 uppercase font-bold text-[10px]">Spotlights</span>
          {ent.spotlightUntil && new Date(ent.spotlightUntil) > new Date()
            ? `Active to ${new Date(ent.spotlightUntil).toLocaleString()}`
            : 'None active'}
        </div>
        <div className="p-2.5 rounded-2xl bg-stone-50 border border-stone-200/70">
          <span className="block text-stone-400 uppercase font-bold text-[10px]">Super Interest</span>
          {ent.superInterestCredits} credit{ent.superInterestCredits === 1 ? '' : 's'}
        </div>
        <div className="p-2.5 rounded-2xl bg-stone-50 border border-stone-200/70">
          <span className="block text-stone-400 uppercase font-bold text-[10px]">Matchmaking</span>
          {ent.matchmakingPackage === 'none'
            ? 'Not purchased'
            : `${ent.matchmakingPackage} · ${ent.matchmakingRemaining} left`}
        </div>
        <div className="p-2.5 rounded-2xl bg-stone-50 border border-stone-200/70">
          <span className="block text-stone-400 uppercase font-bold text-[10px]">Concierge</span>
          {ent.conciergeStatus === 'none' ? 'Not started' : ent.conciergeStatus}
        </div>
      </div>

      <p className="text-[11px] text-stone-500 leading-relaxed">
        Paid plans do not guarantee a relationship or a match. Free members keep profile, Discover, interest, and chat after a match.
      </p>

      {note && <p className="text-[11px] text-amber-900 bg-amber-50 border border-amber-200 rounded-2xl p-2.5">{note}</p>}

      <div className="space-y-2">
        {PRODUCTS.filter((p) => p.kind !== 'extension').map((p) => (
          <button
            key={p.id}
            type="button"
            disabled={busy === p.id}
            onClick={() => void requestProduct(p.id)}
            className="w-full text-left p-3 rounded-2xl border border-stone-200 hover:border-rose-300 bg-stone-50/80 cursor-pointer"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-stone-900">{p.name}</span>
              <span className="text-[11px] font-bold text-rose-900">{p.priceLabel}</span>
            </div>
            <p className="text-[11px] text-stone-500 mt-0.5">{p.summary}</p>
          </button>
        ))}
      </div>

      {txs.length > 0 && (
        <div className="pt-2 border-t border-stone-100 space-y-1.5">
          <p className="text-[10px] uppercase font-bold text-stone-400 flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> Recent requests
          </p>
          {txs.slice(0, 6).map((t) => (
            <div key={t.id} className="flex justify-between text-[11px] text-stone-600">
              <span>{t.productName}</span>
              <span>
                {formatNgn(t.amountNgn)} · {t.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
