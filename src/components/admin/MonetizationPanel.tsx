import React, { useEffect, useMemo, useState } from 'react';
import {
  BillingTransaction,
  adminGrantFromTransaction,
  adminRemoveBillingRecord,
  adminSetTransactionStatus,
  listenAllTransactions
} from '../../lib/billing';
import { formatNgn } from '../../lib/products';
import { listenAllProfiles } from '../../lib/admin';
import { Profile } from '../../types';

const FILTERS = [
  { id: 'pending', label: 'Pending proof' },
  { id: 'all', label: 'All' },
  { id: 'plus_monthly', label: 'Plus' },
  { id: 'boost_24h', label: 'Boost' },
  { id: 'extra_match', label: 'Extra Match' },
  { id: 'matchmaking_local', label: 'Local' },
  { id: 'matchmaking_international', label: 'International' },
  { id: 'matchmaking_both', label: 'Local + Foreign — ₦60,000' }
];

export const MonetizationPanel: React.FC<{ onNotice: (msg: string) => void }> = ({ onNotice }) => {
  const [rows, setRows] = useState<BillingTransaction[]>([]);
  const [filter, setFilter] = useState('pending');
  const [showArchived, setShowArchived] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [reviewTx, setReviewTx] = useState<BillingTransaction | null>(null);
  const [profileTx, setProfileTx] = useState<BillingTransaction | null>(null);

  useEffect(() => listenAllProfiles(setProfiles), []);
  useEffect(
    () =>
      listenAllTransactions(setRows, (msg) => {
        setListError(msg);
      }),
    []
  );

  const unique = useMemo(() => {
    const seen = new Set<string>();
    return rows.filter((row) => {
      if (!showArchived && row.archived) return false;
      const key = row.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [rows, showArchived]);
  const visible = (filter === 'all' ? unique : filter === 'pending' ? unique.filter((r) => r.status === 'pending') : unique.filter((r) => r.productId === filter)).sort((a, b) => {
    if (a.status === 'pending' && b.status !== 'pending') return -1;
    if (b.status === 'pending' && a.status !== 'pending') return 1;
    return 0;
  });

  const totals = useMemo(() => {
    const success = rows.filter((r) => r.status === 'success');
    const seen = new Set<string>();
    const uniqueSuccess = success.filter((r) => {
      const key = r.reference || r.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const pending = rows.filter((r) => r.status === 'pending' && !r.archived);
    const failed = rows.filter((r) => r.status === 'failed' && !r.archived);
    const revenue = uniqueSuccess.reduce((sum, r) => sum + (r.amountNgn || 0), 0);
    const byProduct: Record<string, number> = {};
    uniqueSuccess.forEach((r) => {
      byProduct[r.productName] = (byProduct[r.productName] || 0) + r.amountNgn;
    });
    return { success, pending, failed, revenue, byProduct };
  }, [rows]);

  const profileFor = (userId: string) => profiles.find((p) => p.userId === userId || p.id === userId);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-white p-3 rounded-2xl border border-stone-200">
          <span className="text-[10px] uppercase font-bold text-stone-400 block">Confirmed revenue</span>
          <span className="font-serif text-lg font-bold text-emerald-800">{formatNgn(totals.revenue)}</span>
        </div>
        <div className="bg-white p-3 rounded-2xl border border-stone-200">
          <span className="text-[10px] uppercase font-bold text-stone-400 block">Pending / failed</span>
          <span className="font-serif text-lg font-bold text-stone-800">
            {totals.pending.length} / {totals.failed.length}
          </span>
        </div>
      </div>

      {Object.keys(totals.byProduct).length > 0 && (
        <div className="bg-white p-3 rounded-2xl border border-stone-200 text-[11px] space-y-1">
          <p className="text-[10px] uppercase font-bold text-stone-400">By product (confirmed)</p>
          {Object.entries(totals.byProduct).map(([name, amount]) => (
            <div key={name} className="flex justify-between">
              <span>{name}</span>
              <span className="font-semibold">{formatNgn(amount)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`px-2 py-1 rounded-full text-[10px] font-semibold border ${
              filter === f.id ? 'bg-rose-900 text-amber-100 border-rose-950' : 'bg-white text-stone-600 border-stone-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
      <button type="button" className="text-[11px] font-semibold text-stone-600" onClick={() => setShowArchived((v) => !v)}>{showArchived ? 'Hide archived' : 'Show archived'}</button>

      <p className="text-[11px] text-stone-500">
        Flutterwave checkouts confirm themselves after verification. Use Confirm only for bank or already-paid claims.
      </p>

      {listError && (
        <p className="text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-2xl p-3">{listError}</p>
      )}

      {visible.length === 0 && !listError && (
        <p className="text-xs text-stone-500 bg-white rounded-2xl border border-stone-200 p-4 text-center">
          No billing requests in this filter.
        </p>
      )}

      {visible.slice(0, 40).map((tx) => {
        const profile = profileFor(tx.userId);
        return (
        <div key={tx.id} className="bg-white p-3 rounded-2xl border border-stone-200 space-y-2">
          <div className="flex gap-2 text-xs">
            {profile?.photos?.[0] && <img src={profile.photos[0]} alt="" className="w-12 h-12 rounded-xl object-cover" />}
            <div className="min-w-0">
              <p className="font-semibold text-stone-900">{profile?.displayName || 'Customer profile unavailable'}</p>
              <p className="text-[11px] text-stone-600">{profile?.location || 'Location unavailable'}</p>
              <p className="text-[11px] text-stone-700">{tx.productName} · {formatNgn(tx.amountNgn)}</p>
              <p className="text-[10px] text-stone-500">{tx.reference} · {tx.source || 'payment'} · {tx.status}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" className="flex-1 py-2 rounded-xl border text-[11px] font-semibold" onClick={() => setProfileTx(tx)}>View profile</button>
            <button type="button" className="flex-1 py-2 rounded-xl border text-[11px] font-semibold" onClick={() => setReviewTx(tx)}>Review payment</button>
          </div>
          {tx.status === 'pending' && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setReviewTx(tx)}
                className="flex-1 py-2 rounded-xl bg-emerald-700 text-white text-[11px] font-semibold"
              >
                Confirm & grant
              </button>
              <button
                type="button"
                onClick={() =>
                  void adminSetTransactionStatus(tx.id, 'failed').then(() => onNotice('Marked failed'))
                }
                className="flex-1 py-2 rounded-xl border border-stone-300 text-[11px] font-semibold"
              >
                Mark failed
              </button>
              <button type="button" className="px-3 py-2 rounded-xl border border-rose-300 text-[11px] font-semibold text-rose-800" onClick={() => {
                const name = profile?.displayName || 'this customer';
                const ok = window.confirm(`${tx.status === 'success' ? 'Archive this billing record?' : 'Delete this billing record?'}\n\n${name}\n${tx.productName}\n${formatNgn(tx.amountNgn)}\n${tx.reference}\n${tx.status}\n\nThis does not remove a package already granted.`);
                if (!ok) return;
                void adminRemoveBillingRecord(tx).then((result) => onNotice(result === 'archived' ? 'Archived from the active list. Entitlement kept.' : 'Record removed. Entitlement kept.'));
              }}>Delete</button>
            </div>
          )}
          {tx.status !== 'pending' && (
            <button type="button" className="w-full py-2 rounded-xl border border-rose-300 text-[11px] font-semibold text-rose-800" onClick={() => {
              const name = profile?.displayName || 'this customer';
              const ok = window.confirm(`${tx.status === 'success' ? 'Archive this billing record?' : 'Delete this billing record?'}\n\n${name}\n${tx.productName}\n${formatNgn(tx.amountNgn)}\n${tx.reference}\n${tx.status}`);
              if (!ok) return;
              void adminRemoveBillingRecord(tx).then((result) => onNotice(result === 'archived' ? 'Archived from the active list. Entitlement kept.' : 'Record removed.'));
            }}>{tx.status === 'success' ? 'Archive' : 'Delete'}</button>
          )}
        </div>
        );
      })}
      {(reviewTx || profileTx) && (
        <div className="fixed inset-0 z-50 bg-black/60 p-4 overflow-y-auto" onClick={() => { setReviewTx(null); setProfileTx(null); }}>
          <div className="max-w-md mx-auto bg-white rounded-3xl p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            {(() => {
              const tx = reviewTx || profileTx;
              if (!tx) return null;
              const profile = profileFor(tx.userId);
              return (
                <>
                  <div className="flex justify-between"><h3 className="font-serif font-bold">{profile?.displayName || 'Customer profile unavailable'}</h3><button type="button" onClick={() => { setReviewTx(null); setProfileTx(null); }}>Close</button></div>
                  <p className="text-xs text-stone-600">{profile?.location} · {profile?.profession} · {profile?.age || ''}</p>
                  <p className="text-xs">{profile?.bio}</p>
                  <div className="flex gap-2 overflow-x-auto">{(profile?.photos || []).map((src) => <img key={src} src={src} alt="" className="h-28 rounded-xl object-cover" />)}</div>
                  <p className="text-xs">{tx.productName} · {formatNgn(tx.amountNgn)} · {tx.status}</p>
                  <p className="text-[11px] text-stone-500">{tx.reference} · {tx.createdAt}</p>
                  <p className="text-[10px] text-stone-400">Account: {tx.userId || 'unavailable'}</p>
                  {tx.receiptUrl ? <a href={tx.receiptUrl} target="_blank" rel="noreferrer" className="text-xs text-rose-800 underline">View full receipt</a> : <p className="text-xs text-stone-500">No uploaded receipt. Flutterwave payments are verified automatically.</p>}
                  {reviewTx && tx.status === 'pending' && (
                    <button type="button" className="w-full py-2 rounded-xl bg-emerald-700 text-white text-xs font-semibold" onClick={() => {
                      if (!tx.userId || !profile) return onNotice('Customer profile unavailable');
                      const ok = window.confirm(`Confirm payment?\n\nCustomer: ${profile.displayName}\nPackage: ${tx.productName}\nAmount: ${formatNgn(tx.amountNgn)}\nReference: ${tx.reference}`);
                      if (!ok) return;
                      void adminGrantFromTransaction(tx).then(() => { onNotice(`Confirmed ${tx.productName}`); setReviewTx(null); }).catch((e) => onNotice(e instanceof Error ? e.message : 'Confirm failed'));
                    }}>Confirm & grant</button>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};
