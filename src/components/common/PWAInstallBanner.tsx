import React, { useState } from 'react';
import { Download, Share2, X, PlusSquare } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';

export const PWAInstallBanner: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [dismissed, setDismissed] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);

  // Do not show if installed or dismissed
  if (isInstalled || dismissed) {
    return null;
  }

  // Only show if browser supports direct install or is iOS
  if (!isInstallable && !isIOS) {
    return null;
  }

  return (
    <>
      <aside aria-label="Install App" className="bg-gradient-to-r from-rose-950 via-rose-900 to-amber-950 text-white px-4 py-2.5 text-xs flex items-center justify-between shadow-md relative z-30">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-amber-400/20 border border-amber-300/30 flex items-center justify-center text-amber-200 shrink-0">
            <Download className="w-3.5 h-3.5" />
          </div>
          <div>
            <p className="font-semibold tracking-wide text-amber-100">Install Lifebencher Match</p>
            <p className="text-stone-300 text-[11px]">Install on your phone for full app experience</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isInstallable && (
            <button
              onClick={install}
              className="bg-amber-400 hover:bg-amber-300 text-stone-950 font-semibold px-3 py-1.5 rounded-full text-xs shadow-sm transition active:scale-95 cursor-pointer"
            >
              Install
            </button>
          )}

          {isIOS && (
            <button
              onClick={() => setShowIOSModal(true)}
              className="bg-amber-400/90 hover:bg-amber-300 text-stone-950 font-semibold px-3 py-1.5 rounded-full text-xs shadow-sm transition active:scale-95 cursor-pointer flex items-center gap-1"
            >
              <Share2 className="w-3 h-3" />
              Add to Phone
            </button>
          )}

          <button
            onClick={() => setDismissed(true)}
            className="text-stone-300 hover:text-white p-1 rounded transition"
            aria-label="Dismiss banner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* iOS Safari Installation Guide Modal */}
      {showIOSModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-[#FAF8F5] text-stone-900 rounded-3xl p-6 shadow-2xl border border-stone-200 animate-in slide-in-from-bottom-6 duration-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-900 flex items-center justify-center text-amber-300 font-bold text-lg shadow-sm">
                  L
                </div>
                <div>
                  <h3 className="font-semibold text-stone-900 text-base">Install on iPhone</h3>
                  <p className="text-xs text-stone-500">Fast access right from your Home Screen</p>
                </div>
              </div>
              <button
                onClick={() => setShowIOSModal(false)}
                className="w-8 h-8 rounded-full bg-stone-200 flex items-center justify-center text-stone-600 hover:text-stone-900"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5 my-5 text-xs text-stone-700">
              <div className="flex items-start gap-3 p-3 rounded-2xl bg-white border border-stone-200/80 shadow-xs">
                <span className="w-6 h-6 rounded-full bg-rose-100 text-rose-900 font-semibold flex items-center justify-center shrink-0 text-xs">
                  1
                </span>
                <p className="pt-0.5">
                  Tap the <strong className="text-stone-900">Share</strong> button in Safari's bottom toolbar (<Share2 className="w-3.5 h-3.5 inline mx-0.5 text-stone-700" />).
                </p>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-2xl bg-white border border-stone-200/80 shadow-xs">
                <span className="w-6 h-6 rounded-full bg-rose-100 text-rose-900 font-semibold flex items-center justify-center shrink-0 text-xs">
                  2
                </span>
                <p className="pt-0.5">
                  Scroll down the share sheet and tap <strong className="text-stone-900">Add to Home Screen</strong> (<PlusSquare className="w-3.5 h-3.5 inline mx-0.5 text-stone-700" />).
                </p>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-2xl bg-white border border-stone-200/80 shadow-xs">
                <span className="w-6 h-6 rounded-full bg-rose-100 text-rose-900 font-semibold flex items-center justify-center shrink-0 text-xs">
                  3
                </span>
                <p className="pt-0.5">
                  Tap <strong className="text-stone-900">Add</strong> at top-right to launch Lifebencher Match as a native app.
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowIOSModal(false)}
              className="w-full py-3 rounded-2xl bg-rose-900 text-amber-100 font-semibold text-sm shadow-md hover:bg-rose-950 active:scale-98 transition"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
};
