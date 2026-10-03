import React, { useEffect, useRef, useState } from 'react';
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
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const receiptInputRef = useRef<HTMLInputElement>(null);

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
      (t.productId === 'matchmaking_local' || t.productId === 'matchmaking_international' || t.productId === 'matchmaking_both')
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
      const txId = await createPendingTransaction(productId, { receiptUrl });
      try {
        const { reviewReceipt } = await import('../../lib/aiClient');
        const { productById } = await import('../../lib/products');
        const product = productById(productId);
        const ai = await reviewReceipt({
          receiptUrl,
          txId,
          expectedAmountNgn: product?.priceNgn || 0,
          productName: product?.name || productId
        });
        setNote(`Proof submitted for review. ${ai.note}`);
      } catch {
        setNote('Receipt sent. Admin will confirm on the Billing tab.');
      }
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
    <div
      className="fixed inset-0 overflow-y-auto overflow-x-hidden bg-[#FAF8F5] text-stone-900 p-4"
      style={{ WebkitOverflowScrolling: 'touch', paddingBottom: 'calc(4rem + env(safe-area-inset-bottom, 0px))' }}
    >
      <header className="max-w-md w-full mx-auto flex items-center justify-between gap-2 pb-3">
        <div className="flex items-center gap-2">
          <AppLogo variant="lockup" size={44} />
        </div>
        <button type="button" onClick={() => void logout()} className="text-[11px] text-stone-500 font-semibold">
          Sign out
        </button>
      </header>

      <div className="max-w-md w-full mx-auto flex-1 space-y-3">
        <div>
          <h1 className="font-serif text-xl font-bold text-stone-900">Choose your match package</h1>
          <p className="text-xs text-stone-500 mt-1">Choose where you'd like to meet potential matches.</p>
        </div>

        <button
          type="button"
          disabled={!!busy}
          onClick={() => void pay('matchmaking_local')}
          className={`w-full text-left px-4 py-3 rounded-2xl border bg-white space-y-1 ${busy === 'matchmaking_local' ? 'border-rose-300 ring-2 ring-rose-100' : 'border-stone-200'}`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 font-semibold text-stone-900 text-sm">
              <MapPin className="w-4 h-4 text-rose-800" />
              Nigeria
            </span>
            <span className="font-bold text-rose-900 text-sm">₦30,000</span>
          </div>
          <p className="text-[11px] text-stone-600">Meet matches in Nigeria</p>
          <p className="text-[10px] text-stone-400">Up to 3 matches</p>
        </button>

        <button
          type="button"
          disabled={!!busy}
          onClick={() => void pay('matchmaking_international')}
          className={`w-full text-left px-4 py-3 rounded-2xl border bg-white space-y-1 ${busy === 'matchmaking_international' ? 'border-rose-300 ring-2 ring-rose-100' : 'border-stone-200'}`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 font-semibold text-stone-900 text-sm">
              <Globe2 className="w-4 h-4 text-rose-800" />
              Abroad
            </span>
            <span className="font-bold text-rose-900 text-sm">₦50,000</span>
          </div>
          <p className="text-[11px] text-stone-600">Meet international matches</p>
          <p className="text-[10px] text-stone-400">Up to 3 matches</p>
        </button>

        <button
          type="button"
          disabled={!!busy}
          onClick={() => void pay('matchmaking_both')}
          className={`w-full text-left px-4 py-3 rounded-2xl border bg-white space-y-1 ${busy === 'matchmaking_both' ? 'border-fuchsia-400 ring-2 ring-fuchsia-100' : 'border-fuchsia-200'}`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 font-semibold text-stone-900 text-sm">
              <Globe2 className="w-4 h-4 text-rose-800" />
              Local + Foreign
            </span>
            <span className="font-bold text-rose-900 text-sm">₦60,000</span>
          </div>
          <p className="text-[11px] text-stone-600">Meet matches in Nigeria and abroad</p>
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-stone-400">Up to 3 matches total</p>
            <span className="text-[9px] font-semibold uppercase tracking-wide text-rose-800 bg-white/80 px-1.5 py-0.5 rounded-full">Both pools</span>
          </div>
        </button>

        <div className="rounded-2xl border border-stone-200 bg-white p-3 space-y-2">
          <p className="text-xs font-semibold text-stone-800">Already a paying client?</p>
          <p className="text-[11px] text-stone-500">Upload a receipt or bank-alert photo. Do not pay again.</p>
          <input
            ref={receiptInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0] || null;
              setReceiptFile(file);
              setReceiptPreview(file ? URL.createObjectURL(file) : null);
            }}
          />
          <button
            type="button"
            onClick={() => receiptInputRef.current?.click()}
            className="w-full py-3 rounded-xl bg-white border border-stone-300 text-xs font-semibold text-stone-900"
          >
            Choose receipt from gallery
          </button>
          {receiptPreview && (
            <img src={receiptPreview} alt="Receipt preview" className="w-full max-h-36 object-contain rounded-2xl border border-stone-200 bg-white" />
          )}
          {receiptFile && <p className="text-[11px] text-stone-600">{receiptFile.name}</p>}
          <button
            type="button"
            disabled={!!busy}
            onClick={() => void alreadyPaid('matchmaking_local')}
            className="w-full py-2.5 rounded-xl border border-stone-300 text-xs font-semibold"
          >
            Submit proof — Nigeria ₦30,000
          </button>
          <button
            type="button"
            disabled={!!busy}
            onClick={() => void alreadyPaid('matchmaking_international')}
            className="w-full py-2.5 rounded-xl border border-stone-300 text-xs font-semibold"
          >
            Submit proof — Abroad ₦50,000
          </button>
          <button
            type="button"
            disabled={!!busy}
            onClick={() => void alreadyPaid('matchmaking_both')}
            className="w-full py-2.5 rounded-xl border border-stone-300 text-xs font-semibold"
          >
            Submit proof — Local + Foreign ₦60,000
          </button>
        </div>

        {pending && (
          <p className="text-[11px] text-amber-900 bg-amber-50 border border-amber-200 rounded-2xl p-3">
            {pending.productName} is pending confirmation ({pending.reference}). Discover stays closed until admin confirms payment.
          </p>
        )}
        {note && <p className="text-[11px] text-stone-600 bg-stone-100 rounded-2xl p-3">{note}</p>}
      </div>
    </div>
  );
};
