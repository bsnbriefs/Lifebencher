import React from 'react';
import { Share2 } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { AppLogo } from './AppLogo';

export const PWAInstallPrompt: React.FC = () => {
  const { isInstallable, isIOS, showPrompt, install, dismiss } = usePWAInstall();

  if (!showPrompt) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 pointer-events-none px-3 pb-[calc(12px+env(safe-area-inset-bottom,0px))]">
      <div className="pointer-events-auto max-w-md mx-auto bg-[#2a2422] text-[#f3ece6] rounded-2xl border border-white/10 shadow-lg p-3.5">
        <div className="flex items-start gap-3">
          <AppLogo size={36} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-100">Install Lifebencher</p>
            {isIOS && !isInstallable ? (
              <p className="text-[11px] text-stone-300 mt-0.5 leading-relaxed">
                Tap Share <Share2 className="w-3 h-3 inline" /> then Add to Home Screen.
              </p>
            ) : (
              <p className="text-[11px] text-stone-300 mt-0.5 leading-relaxed">
                Add Lifebencher to your home screen for faster access.
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          {isInstallable && (
            <button
              type="button"
              onClick={() => void install()}
              className="flex-1 py-2 rounded-xl bg-amber-400 text-stone-950 text-xs font-semibold"
            >
              Install
            </button>
          )}
          <button
            type="button"
            onClick={dismiss}
            className="flex-1 py-2 rounded-xl border border-white/15 text-[#f3ece6] text-xs font-semibold"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
};
