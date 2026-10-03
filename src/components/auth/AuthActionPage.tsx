import React, { useEffect, useState } from 'react';
import { applyActionCode, confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { AppLogo } from '../common/AppLogo';

export function firebaseActionFromLocation(): { mode: string; oobCode: string } | null {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get('mode') || '';
  const oobCode = params.get('oobCode') || '';
  if (!oobCode) return null;
  if (mode === 'resetPassword' || mode === 'verifyEmail' || mode === 'recoverEmail') {
    return { mode, oobCode };
  }
  return null;
}

function goHome() {
  window.history.replaceState({}, '', '/');
  window.location.assign('/');
}

export const AuthActionPage: React.FC<{ mode: string; oobCode: string }> = ({ mode, oobCode }) => {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (mode !== 'verifyEmail' && mode !== 'recoverEmail') return;
    let cancelled = false;
    setBusy(true);
    applyActionCode(auth, oobCode)
      .then(async () => {
        await auth.currentUser?.reload();
        if (!cancelled) {
          setNote(
            mode === 'verifyEmail'
              ? 'Email verified. Your account is unchanged — tap below to continue.'
              : 'Email change confirmed.'
          );
        }
      })
      .catch((err) => {
        const raw = err instanceof Error ? err.message.toLowerCase() : '';
        if (raw.includes('invalid-action-code') && auth.currentUser?.emailVerified) {
          if (!cancelled) setNote('Email is already verified. Continue to Lifebencher.');
          return;
        }
        if (!cancelled) setError('This link is invalid or has expired. Request a new email.');
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mode, oobCode]);

  useEffect(() => {
    if (mode !== 'resetPassword') return;
    verifyPasswordResetCode(auth, oobCode).catch(() => {
      setError('This reset link is invalid or has expired. Request a new one from Sign in.');
    });
  }, [mode, oobCode]);

  const submitReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      setError('Use at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await confirmPasswordReset(auth, oobCode, password);
      setNote('Password updated. Sign in with your new password.');
    } catch {
      setError('Could not update password. Request a new reset email.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-stone-900 p-4 flex flex-col items-center justify-center">
      <div className="w-full max-w-md bg-white rounded-3xl border border-stone-200 p-6 space-y-4">
        <div className="flex items-center gap-2">
          <AppLogo size={32} className="rounded-xl" />
          <p className="font-serif font-bold text-rose-950">Lifebencher Match</p>
        </div>
        <h1 className="font-serif text-xl font-bold">
          {mode === 'resetPassword' ? 'Choose a new password' : 'Email confirmation'}
        </h1>
        {busy && !note && !error && <p className="text-xs text-stone-500">Working…</p>}
        {error && <p className="text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-2xl p-3">{error}</p>}
        {note && <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-2xl p-3">{note}</p>}
        {mode === 'resetPassword' && !note && (
          <form onSubmit={(e) => void submitReset(e)} className="space-y-3">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="New password"
              className="w-full text-xs px-3 py-2.5 rounded-2xl border border-stone-300"
            />
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Confirm new password"
              className="w-full text-xs px-3 py-2.5 rounded-2xl border border-stone-300"
            />
            <button
              type="submit"
              disabled={busy}
              className="w-full py-3 rounded-2xl bg-rose-900 text-amber-100 text-xs font-semibold"
            >
              {busy ? 'Saving…' : 'Save password'}
            </button>
          </form>
        )}
        <button type="button" onClick={goHome} className="text-[11px] font-semibold text-stone-500">
          Continue to Lifebencher
        </button>
      </div>
    </div>
  );
};
