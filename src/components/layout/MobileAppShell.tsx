import React, { useState } from 'react';
import { Sparkles, Bell, X, CheckCircle2, Heart, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { NavigationTab } from '../../types';
import { BottomNav } from './BottomNav';
import { PWAInstallBanner } from '../common/PWAInstallBanner';

interface MobileAppShellProps {
  activeTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  children: React.ReactNode;
}

export const MobileAppShell: React.FC<MobileAppShellProps> = ({
  activeTab,
  onSelectTab,
  children
}) => {
  const [showNotifications, setShowNotifications] = useState(false);

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-stone-900 flex flex-col font-sans selection:bg-rose-100 selection:text-rose-900">
      {/* PWA Install Notification Bar */}
      <PWAInstallBanner />

      {/* Top Mobile App Header */}
      <header className="sticky top-0 z-30 bg-[#FAF8F5]/90 backdrop-blur-md border-b border-stone-200/70 safe-area-top">
        <div className="max-w-md mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-rose-900 via-rose-800 to-rose-700 flex items-center justify-center text-amber-300 shadow-sm border border-rose-950/20">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <span className="font-serif font-bold text-lg tracking-tight text-rose-950 block leading-tight">
                Lifebencher
              </span>
              <span className="text-[10px] tracking-widest text-amber-800 font-semibold uppercase block leading-none">
                Match
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowNotifications(true)}
              className="w-9 h-9 rounded-full bg-stone-100 hover:bg-stone-200 border border-stone-200/80 flex items-center justify-center text-stone-600 transition active:scale-95 cursor-pointer relative"
              aria-label="View notifications"
            >
              <Bell className="w-4 h-4 text-stone-700" />
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-rose-600 ring-2 ring-white"></span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Screen Container - Scrollable with safe bottom margin for BottomNav */}
      <main className="flex-1 max-w-md w-full mx-auto pb-24 px-4 pt-3">
        {children}
      </main>

      {/* Persistent Bottom Mobile Navigation Bar */}
      <BottomNav
        activeTab={activeTab}
        onSelectTab={onSelectTab}
        unreadCount={1}
        newMatchesCount={2}
      />

      {/* In-App Notifications Bottom Sheet */}
      <AnimatePresence>
        {showNotifications && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-xs p-4">
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="w-full max-w-sm bg-white text-stone-900 rounded-3xl p-5 shadow-2xl border border-stone-200 space-y-3 safe-area-bottom"
            >
              <div className="flex items-center justify-between pb-2 border-b border-stone-100">
                <div className="flex items-center gap-1.5 font-serif font-bold text-base text-stone-900">
                  <Bell className="w-4 h-4 text-rose-800" />
                  <span>Activity & Updates</span>
                </div>
                <button
                  onClick={() => setShowNotifications(false)}
                  className="w-7 h-7 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-500 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-2 text-xs">
                <div className="p-3 bg-stone-50 rounded-2xl border border-stone-150 flex items-start gap-2.5">
                  <Heart className="w-4 h-4 text-rose-800 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-stone-900 block">
                      New Intentional Connection
                    </span>
                    <span className="text-stone-500 text-[11px] block mt-0.5">
                      You and Amaka have an active 7-day connection window.
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200/60 flex items-start gap-2.5">
                  <Clock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-amber-950 block">
                      Connection Window Notice
                    </span>
                    <span className="text-amber-800 text-[11px] block mt-0.5">
                      Your connection with Kemi has ~19 hours remaining. You can extend anytime.
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200/60 flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-emerald-950 block">
                      Verified Shield Active
                    </span>
                    <span className="text-emerald-800 text-[11px] block mt-0.5">
                      Your identity and values review has been certified by Concierge.
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
