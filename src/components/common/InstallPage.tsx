import { useMemo, useState } from 'react';
import { AppLogo } from './AppLogo';
import { usePWAInstall } from '../../hooks/usePWAInstall';

function browserKind() {
  const ua = navigator.userAgent || '';
  const inApp = /Instagram|FBAN|FBAV|FB_IAB|Line\/|Twitter|TikTok|Snapchat/i.test(ua);
  const ios = /iPhone|iPad|iPod/i.test(ua);
  return { inApp, ios, name: /Instagram/i.test(ua) ? 'Instagram' : inApp ? 'this app' : '' };
}

export function InstallPage() {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const browser = useMemo(browserKind, []);
  const installUrl = `${window.location.origin}/#install`;

  const openInBrowser = () => {
    if (browser.ios) {
      setNote('Tap the menu in the top corner, then Open in Safari. Install only works in Safari.');
      return;
    }
    window.location.href = `intent://${window.location.host}/#install#Intent;scheme=https;package=com.android.chrome;end`;
  };

  const start = async () => {
    if (browser.inApp) {
      openInBrowser();
      return;
    }
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
        {browser.inApp && (
          <div className="text-sm text-rose-950 bg-rose-50 border border-rose-200 rounded-2xl p-3 space-y-2">
            <p className="font-semibold">{browser.name} cannot install apps.</p>
            <p>{browser.ios ? 'Open this page in Safari, then tap Share and Add to Home Screen.' : 'Open this page in Chrome, then tap Install Lifebencher.'}</p>
            <button type="button" onClick={openInBrowser} className="w-full py-2.5 rounded-full bg-rose-900 text-amber-100 text-sm font-semibold">
              {browser.ios ? 'How to open in Safari' : 'Open in Chrome'}
            </button>
          </div>
        )}
        {isInstalled ? (
          <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-2xl p-3">Lifebencher is already installed on this device.</p>
        ) : (
          <button type="button" disabled={busy} onClick={() => void start()} className="w-full py-3 rounded-full bg-rose-900 text-amber-100 font-semibold disabled:opacity-60">
            {busy ? 'Opening install…' : browser.inApp ? 'Open in your browser' : 'Install Lifebencher'}
          </button>
        )}
        {!isInstallable && !isInstalled && !browser.inApp && (
          <div className="text-xs text-stone-600 bg-white border border-stone-200 rounded-2xl p-3 space-y-2">
            <p className="font-semibold text-stone-800">If the button does not open a prompt:</p>
            {isIOS ? <p>In Safari, tap Share, then Add to Home Screen.</p> : <p>Open the browser menu and choose Install app or Add to Home screen.</p>}
          </div>
        )}
        {note && <p className="text-xs text-stone-600">{note}</p>}
        <p className="text-[11px] text-stone-400 break-all">Share this link: {installUrl}</p>
        <a href="#discover" className="block text-center text-xs font-semibold text-rose-900">Continue to Lifebencher</a>
      </div>
    </div>
  );
}
