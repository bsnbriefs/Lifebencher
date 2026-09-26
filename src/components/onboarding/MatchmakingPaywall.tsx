import React, { useEffect, useState } from 'react';
import { Globe2, MapPin } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  BillingTransaction,
  createPendingTransaction,
  uploadPaymentReceipt,
  listenEntitlements,
  listenMyTransactions,
  EMPTY_ENTITLEMENTS,
  Entitlements
} from '../../lib/billing';
import { confirmFlutterwaveReturn, startFlutterwaveCheckout } from '../../lib/flutterwaveClient';
import { AppLogo } from '../common/AppLogo';

export const MatchmakingPaywall: React.FC = () => {
  const { user, logout } = useAuth();
  const [ent, setEnt] = useState<Entitlements>(EMPTY_ENTITLEMENTS(user?.id || ''));
  const [txs, setTxs] = useState<BillingTransaction[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    const a = listenEntitlements(user.id, setEnt);
    const b = listenMyTransactions(user.id, setTxs);
    void confirmFlutterwaveReturn().then((result) => {
      if (result.message) setNote(result.message);
    });
    return () => {
      a();
      b();
    };
  }, [user?.id]);

  const pending = txs.find(
    (t) =>
      t.status === 'pending' &&
      (t.productId === 'matchmaking_local' || t.productId === 'matchmaking_international')
  );

  const pay = async (productId: string) => {
    setBusy(productId);
    setNote(null);
    try {
      await startFlutterwaveCheckout(productId);
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'Could not start Flutterwave checkout.');
      setBusy(null);
    }
  };

  const alreadyPaid = async (productId: string) => {
    if (!receiptFile) {
      setNote('Upload a photo of your receipt or bank alert first.');
      return;
    }
    setBusy(productId);
    setNote(null);
    try {
      const receiptUrl = await uploadPaymentReceipt(receiptFile);
      await createPendingTransaction(productId, { receiptUrl });
      setNote('Receipt sent. Admin will confirm on the Billing tab. Flutterwave payments do not need this.');
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'Could not save claim.');
    } finally {
      setBusy(null);
    }
  };

  if (ent.matchmakingPackage !== 'none') {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-stone-900 p-4 safe-area-top safe-area-bottom flex flex-col">
      <header className="max-w-md w-full mx-auto flex items-center gap-2.5 pb-4">
        <AppLogo size={32} className="rounded-xl" />
        <div>
          <p className="font-serif font-bold text-lg text-rose-950 leading-tight">Lifebencher</p>
          <p className="text-[10px] uppercase tracking-widest text-amber-800 font-semibold">Match</p>
        </div>
      </header>

      <div className="max-w-md w-full mx-auto flex-1 space-y-4">
        <div>
          <h1 className="font-serif text-2xl font-bold text-stone-900">Choose your matchmaking</h1>
          <p className="text-xs text-stone-500 mt-1 leading-relaxed">
            Your profile is ready. Select Nigeria or Abroad to continue. You will see other members only after this package is confirmed.
          </p>
        </div>

        <button
          type="button"
          disabled={!!busy}
          onClick={() => void pay('matchmaking_local')}
          className="w-full text-left p-4 rounded-3xl border border-stone-200 bg-white space-y-2"
        >
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 font-semibold text-stone-900 text-sm">
              <MapPin className="w-4 h-4 text-rose-800" />
              Nigeria
            </span>
            <span className="font-bold text-rose-900">₦30,000</span>
          </div>
          <p className="text-[11px] text-stone-500">Local introductions. Up to 3 matches. One-time.</p>
        </button>

        <button
          type="button"
          disabled={!!busy}
          onClick={() => void pay('matchmaking_international')}
          className="w-full text-left p-4 rounded-3xl border border-stone-200 bg-white space-y-2"
        >
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 font-semibold text-stone-900 text-sm">
              <Globe2 className="w-4 h-4 text-rose-800" />
              Abroad
            </span>
            <span className="font-bold text-rose-900">₦50,000</span>
          </div>
          <p className="text-[11px] text-stone-500">International introductions. Up to 3 matches. One-time.</p>
        </button>

        <div className="rounded-3xl border border-stone-200 bg-stone-50 p-4 space-y-2">
          <p className="text-xs font-semibold text-stone-800">Already paid?</p>
          <p className="text-[11px] text-stone-500">
            Upload a receipt or bank alert, then choose the package you already bought. Admin confirms on Billing. New Flutterwave payments unlock automatically — no admin step.
          </p>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
            className="block w-full text-[11px]"
          />
          <button
            type="button"
            disabled={!!busy}
            onClick={() => void alreadyPaid('matchmaking_local')}
            className="w-full py-2.5 rounded-xl border border-stone-300 text-xs font-semibold"
          >
            I already paid — Nigeria ₦30,000
          </button>
          <button
            type="button"
            disabled={!!busy}
            onClick={() => void alreadyPaid('matchmaking_international')}
            className="w-full py-2.5 rounded-xl border border-stone-300 text-xs font-semibold"
          >
            I already paid — Abroad ₦50,000
          </button>
        </div>

        {pending && (
          <p className="text-[11px] text-amber-900 bg-amber-50 border border-amber-200 rounded-2xl p-3">
            {pending.productName} is pending confirmation ({pending.reference}). Discover stays closed until admin confirms payment.
          </p>
        )}
        {note && <p className="text-[11px] text-stone-600 bg-stone-100 rounded-2xl p-3">{note}</p>}

        <button type="button" onClick={logout} className="text-[11px] text-stone-400 underline">
          Sign out
        </button>
      </div>
    </div>
  );
};
