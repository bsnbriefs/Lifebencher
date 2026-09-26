import React, { useEffect, useMemo, useState } from 'react';
import {
  BillingTransaction,
  adminGrantFromTransaction,
  adminSetTransactionStatus,
  listenAllTransactions
} from '../../lib/billing';
import { formatNgn } from '../../lib/products';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'plus_monthly', label: 'Plus' },
  { id: 'boost_24h', label: 'Boost' },
  { id: 'extra_match', label: 'Extra Match' },
  { id: 'matchmaking_local', label: 'Local' },
  { id: 'matchmaking_international', label: 'International' }
];

export const MonetizationPanel: React.FC<{ onNotice: (msg: string) => void }> = ({ onNotice }) => {
  const [rows, setRows] = useState<BillingTransaction[]>([]);
  const [filter, setFilter] = useState('all');

  useEffect(() => listenAllTransactions(setRows), []);

  const visible = filter === 'all' ? rows : rows.filter((r) => r.productId === filter);

  const totals = useMemo(() => {
    const success = rows.filter((r) => r.status === 'success');
    const pending = rows.filter((r) => r.status === 'pending');
    const failed = rows.filter((r) => r.status === 'failed');
    const revenue = success.reduce((sum, r) => sum + (r.amountNgn || 0), 0);
    const byProduct: Record<string, number> = {};
    success.forEach((r) => {
      byProduct[r.productName] = (byProduct[r.productName] || 0) + r.amountNgn;
    });
    return { success, pending, failed, revenue, byProduct };
  }, [rows]);

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

      <p className="text-[11px] text-stone-500">
        Flutterwave checkouts confirm themselves after verification. Use Confirm only for bank or already-paid claims.
      </p>

      {visible.length === 0 && (
        <p className="text-xs text-stone-500 bg-white rounded-2xl border border-stone-200 p-4 text-center">
          No billing requests yet.
        </p>
      )}

      {visible.slice(0, 40).map((tx) => (
        <div key={tx.id} className="bg-white p-3 rounded-2xl border border-stone-200 space-y-2">
          <div className="flex justify-between gap-2 text-xs">
            <div>
              <p className="font-semibold text-stone-900">{tx.productName}</p>
              <p className="text-[10px] text-stone-500">{tx.reference}</p>
              <p className="text-[10px] text-stone-400">{tx.userId.slice(0, 10)}…</p>
              {tx.receiptUrl && (
                <a href={tx.receiptUrl} target="_blank" rel="noreferrer" className="text-[10px] text-rose-800 underline">
                  View receipt
                </a>
              )}
            </div>
            <div className="text-right">
              <p className="font-bold text-rose-900">{formatNgn(tx.amountNgn)}</p>
              <p className="text-[10px] uppercase font-bold text-stone-500">{tx.status}</p>
            </div>
          </div>
          {tx.status === 'pending' && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() =>
                  void adminGrantFromTransaction(tx)
                    .then(() => onNotice(`Confirmed ${tx.productName}`))
                    .catch((e) => onNotice(e instanceof Error ? e.message : 'Confirm failed'))
                }
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
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
