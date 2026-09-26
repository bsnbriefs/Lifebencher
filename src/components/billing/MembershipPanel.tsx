import React, { useEffect, useState } from 'react';
import { Crown } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  BillingTransaction,
  EMPTY_ENTITLEMENTS,
  Entitlements,
  listenEntitlements,
  listenMyTransactions,
  planActive,
  spotlightActive
} from '../../lib/billing';
import { productById, formatNgn } from '../../lib/products';
import { confirmFlutterwaveReturn, startFlutterwaveCheckout } from '../../lib/flutterwaveClient';

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
    confirmFlutterwaveReturn()
      .then((r) => {
        if (r.message) setNote(r.message);
      })
      .catch(() => {
        /* ignore */
      });
    return () => {
      a();
      b();
    };
  }, [user?.id]);

  const requestProduct = async (productId: string) => {
    setBusy(productId);
    setNote(null);
    try {
      await startFlutterwaveCheckout(productId);
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'Could not start Flutterwave checkout.');
      setBusy(null);
    }
  };

  const plusOn = planActive(ent);
  const boostOn = spotlightActive(ent);
  const showExtra = ent.matchmakingPackage !== 'none' && ent.matchmakingRemaining <= 0;
  const plus = productById('plus_monthly');
  const boost = productById('boost_24h');

  return (
    <div className="bg-white rounded-3xl p-5 border border-stone-200/90 shadow-sm space-y-4">
      <div>
        <h3 className="font-serif font-bold text-base text-stone-900 flex items-center gap-2">
          <Crown className="w-4 h-4 text-amber-700" />
          Lifebencher Plus
        </h3>
        <p className="text-[11px] text-stone-500 mt-1">
          {plusOn
            ? `Active until ${new Date(ent.planExpiresAt || '').toLocaleDateString()}`
            : 'Free members keep Discover, interest, and chat after a match.'}
        </p>
      </div>

      {plus && (
        <div className="rounded-2xl border border-stone-200 p-3 space-y-2">
          <div className="flex justify-between text-xs font-semibold">
            <span>{plus.name}</span>
            <span className="text-rose-900">{plus.priceLabel}</span>
          </div>
          <ul className="text-[11px] text-stone-600 space-y-0.5">
            {plus.bullets.map((b) => (
              <li key={b}>✓ {b}</li>
            ))}
          </ul>
          {!plusOn && (
            <button
              type="button"
              disabled={busy === plus.id}
              onClick={() => void requestProduct(plus.id)}
              className="w-full py-2.5 rounded-xl bg-rose-900 text-amber-100 text-xs font-semibold"
            >
              Upgrade to Plus
            </button>
          )}
        </div>
      )}

      {boost && (
        <div className="rounded-2xl border border-stone-200 p-3 space-y-2">
          <div className="flex justify-between text-xs font-semibold">
            <span>Boost Your Profile</span>
            <span className="text-rose-900">{boost.priceLabel}</span>
          </div>
          <p className="text-[11px] text-stone-500">
            {boostOn ? `Boost on until ${new Date(ent.spotlightUntil || '').toLocaleString()}` : '24 hours higher in Discover.'}
          </p>
          {!boostOn && (
            <button
              type="button"
              disabled={busy === boost.id}
              onClick={() => void requestProduct(boost.id)}
              className="w-full py-2.5 rounded-xl border border-stone-300 text-xs font-semibold"
            >
              Boost Profile
            </button>
          )}
        </div>
      )}

      {showExtra && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 space-y-2">
          <p className="text-xs font-semibold text-stone-900">Want another introduction?</p>
          <button
            type="button"
            disabled={busy === 'extra_match'}
            onClick={() => void requestProduct('extra_match')}
            className="w-full py-2.5 rounded-xl bg-stone-900 text-amber-100 text-xs font-semibold"
          >
            Get Another Match — ₦10,000
          </button>
        </div>
      )}

      {note && <p className="text-[11px] text-amber-900 bg-amber-50 border border-amber-200 rounded-2xl p-2.5">{note}</p>}

      {txs.length > 0 && (
        <div className="pt-2 border-t border-stone-100 space-y-1">
          {txs.slice(0, 5).map((t) => (
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
