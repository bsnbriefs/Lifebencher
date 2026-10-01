import React, { useEffect, useState } from 'react';
import { collection, doc, getDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { Flag } from 'lucide-react';
import { db } from '../../lib/firebase';
import { mapProfileDoc } from '../../lib/matches';

export type SafetyReportStatus = 'open' | 'under_review' | 'resolved' | 'dismissed' | 'action_taken';

export interface SafetyReport {
  id: string;
  reportType: 'profile' | 'message';
  reporterId: string;
  reportedUserId: string;
  matchId?: string;
  messageId?: string;
  messagePreview?: string;
  reason: string;
  status: SafetyReportStatus;
  createdAt: string;
  adminNote?: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

function listenSafetyReports(onChange: (rows: SafetyReport[]) => void): () => void {
  return onSnapshot(
    collection(db, 'reports'),
    (snap) => {
      const rows = snap.docs.map((d) => {
        const data = d.data() as Record<string, unknown>;
        const status = String(data.status || 'open') as SafetyReportStatus;
        return {
          id: String(data.id || d.id),
          reportType: data.reportType === 'message' ? 'message' : 'profile',
          reporterId: String(data.reporterId || ''),
          reportedUserId: String(data.reportedUserId || data.targetId || ''),
          matchId: data.matchId ? String(data.matchId) : '',
          messageId: data.messageId ? String(data.messageId) : '',
          messagePreview: data.messagePreview ? String(data.messagePreview) : '',
          reason: String(data.reason || ''),
          status: ['open', 'under_review', 'resolved', 'dismissed', 'action_taken'].includes(status) ? status : 'open',
          createdAt: String(data.createdAt || ''),
          adminNote: data.adminNote ? String(data.adminNote) : '',
          reviewedAt: data.reviewedAt ? String(data.reviewedAt) : '',
          reviewedBy: data.reviewedBy ? String(data.reviewedBy) : ''
        } satisfies SafetyReport;
      }).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
      onChange(rows);
    },
    () => onChange([])
  );
}

async function updateSafetyReport(
  id: string,
  patch: Partial<Pick<SafetyReport, 'status' | 'adminNote' | 'reviewedBy'>>
): Promise<void> {
  await updateDoc(doc(db, 'reports', id), {
    ...patch,
    reviewedAt: new Date().toISOString()
  });
}

export const AdminReportsPanel: React.FC<{ adminUid?: string }> = ({ adminUid }) => {
  const [rows, setRows] = useState<SafetyReport[]>([]);
  const [names, setNames] = useState<Record<string, { name: string; photo: string }>>({});
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});
  const [messageState, setMessageState] = useState<Record<string, string>>({});

  useEffect(() => listenSafetyReports(setRows), []);

  useEffect(() => {
    const ids = Array.from(new Set(rows.flatMap((r) => [r.reportedUserId, r.reporterId].filter(Boolean))));
    let cancelled = false;
    void Promise.all(ids.map(async (id) => {
      try {
        const snap = await getDoc(doc(db, 'profiles', id));
        if (!snap.exists()) return [id, { name: id.slice(0, 8), photo: '' }] as const;
        const p = mapProfileDoc(id, snap.data() as Record<string, unknown>);
        return [id, { name: p.displayName || id.slice(0, 8), photo: p.photos[0] || '' }] as const;
      } catch {
        return [id, { name: id.slice(0, 8), photo: '' }] as const;
      }
    })).then((pairs) => {
      if (cancelled) return;
      const next: Record<string, { name: string; photo: string }> = {};
      pairs.forEach(([id, meta]) => { next[id] = meta; });
      setNames(next);
    });
    return () => { cancelled = true; };
  }, [rows]);

  useEffect(() => {
    let cancelled = false;
    void Promise.all(rows.filter((r) => r.reportType === 'message' && r.matchId && r.messageId).map(async (r) => {
      try {
        const snap = await getDoc(doc(db, 'matches', r.matchId as string, 'messages', r.messageId as string));
        if (!snap.exists()) return [r.id, 'Message no longer available'] as const;
        const data = snap.data() as Record<string, unknown>;
        return [r.id, String(data.content || r.messagePreview || 'Message available')] as const;
      } catch {
        return [r.id, r.messagePreview || 'Message no longer available'] as const;
      }
    })).then((pairs) => {
      if (cancelled) return;
      const next: Record<string, string> = {};
      pairs.forEach(([id, text]) => { next[id] = text; });
      setMessageState(next);
    });
    return () => { cancelled = true; };
  }, [rows]);

  const setStatus = async (row: SafetyReport, status: SafetyReportStatus) => {
    await updateSafetyReport(row.id, {
      status,
      reviewedBy: adminUid || '',
      adminNote: noteDraft[row.id] ?? row.adminNote
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs text-stone-500 px-1">
        <Flag className="w-3.5 h-3.5" />
        <span>Safety reports stay available after block or unmatch.</span>
      </div>
      {rows.length === 0 ? (
        <div className="text-center py-8 px-4 bg-white rounded-3xl border border-stone-200 text-xs text-stone-500">
          No reports in the queue.
        </div>
      ) : rows.map((row) => {
        const reported = names[row.reportedUserId] || { name: row.reportedUserId.slice(0, 8), photo: '' };
        return (
          <div key={row.id} className="bg-white rounded-3xl p-4 border border-stone-200 space-y-2">
            <div className="flex items-center gap-3">
              <img src={reported.photo || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80'} alt="" className="w-10 h-10 rounded-full object-cover border border-stone-200" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-stone-900 truncate">{reported.name}</p>
                <p className="text-[10px] text-stone-400 truncate">{row.reportType} · {row.status} · {row.createdAt ? new Date(row.createdAt).toLocaleString() : ''}</p>
              </div>
            </div>
            <p className="text-xs text-stone-700">{row.reason || 'No reason given'}</p>
            <p className="text-[10px] text-stone-400">Reported user: {row.reportedUserId}</p>
            <p className="text-[10px] text-stone-400">Reporter: {names[row.reporterId]?.name || row.reporterId}</p>
            {row.matchId ? <p className="text-[10px] text-stone-400">Match: {row.matchId}</p> : null}
            {row.reportType === 'message' ? (
              <p className="text-[11px] rounded-xl bg-stone-50 border border-stone-200 p-2 text-stone-600">
                {messageState[row.id] || row.messagePreview || 'Looking up referenced message…'}
              </p>
            ) : null}
            <textarea
              value={noteDraft[row.id] ?? row.adminNote ?? ''}
              onChange={(e) => setNoteDraft((prev) => ({ ...prev, [row.id]: e.target.value }))}
              placeholder="Admin note"
              className="w-full text-xs border border-stone-200 rounded-xl p-2 min-h-16"
            />
            <div className="flex flex-wrap gap-1.5">
              {(['under_review', 'dismissed', 'resolved', 'action_taken'] as SafetyReportStatus[]).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => void setStatus(row, status)}
                  className="px-2.5 py-1.5 rounded-full bg-stone-900 text-amber-100 text-[10px] font-semibold"
                >
                  {status.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};
