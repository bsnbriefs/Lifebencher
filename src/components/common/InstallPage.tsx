import { useState } from 'react';
import { AppLogo } from './AppLogo';
import { usePWAInstall } from '../../hooks/usePWAInstall';

export function InstallPage() {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const start = async () => {
    setBusy(true);
    try {
      const accepted = await install();
      setNote(accepted ? 'Lifebencher was added to this device.' : 'Use the browser menu if the install prompt did not open.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-stone-900 p-4">
      <div className="max-w-md mx-auto pt-8 space-y-4">
        <div className="flex items-center gap-2">
          <AppLogo size={36} className="rounded-xl" />
          <div>
            <p className="font-serif font-bold text-lg text-rose-950">Lifebencher</p>
            <p className="text-[10px] uppercase tracking-[0.18em] text-amber-800 font-semibold">Match</p>
          </div>
        </div>
        <h1 className="font-serif text-2xl font-bold">Install the web app</h1>
        <p className="text-sm text-stone-600">Add Lifebencher to your home screen for faster access. No app store is required.</p>
        {isInstalled ? (
          <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-2xl p-3">Lifebencher is already installed on this device.</p>
        ) : (
          <button type="button" disabled={busy} onClick={() => void start()} className="w-full py-3 rounded-full bg-rose-900 text-amber-100 font-semibold disabled:opacity-60">
            {busy ? 'Opening install…' : 'Install Lifebencher'}
          </button>
        )}
        {!isInstallable && !isInstalled && (
          <div className="text-xs text-stone-600 bg-white border border-stone-200 rounded-2xl p-3 space-y-2">
            <p className="font-semibold text-stone-800">If the button does not open a prompt:</p>
            {isIOS ? (
              <p>In Safari, tap Share, then Add to Home Screen.</p>
            ) : (
              <p>Open the browser menu and choose Install app or Add to Home screen.</p>
            )}
          </div>
        )}
        {note && <p className="text-xs text-stone-600">{note}</p>}
        <a href="#discover" className="block text-center text-xs font-semibold text-rose-900">Continue to Lifebencher</a>
      </div>
    </div>
  );
}
