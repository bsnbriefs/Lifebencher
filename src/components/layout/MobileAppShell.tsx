import React, { useState } from 'react';
import { Bell, X, Sun, Moon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { NavigationTab } from '../../types';
import { BottomNav } from './BottomNav';
import { PWAInstallBanner } from '../common/PWAInstallBanner';
import { AppLogo } from '../common/AppLogo';
import { useTheme } from '../../context/ThemeContext';

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
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-stone-900 flex flex-col font-sans selection:bg-rose-100 selection:text-rose-900">
      {/* PWA Install Notification Bar */}
      <PWAInstallBanner />

      {/* Top Mobile App Header */}
      <header className="sticky top-0 z-30 bg-[#FAF8F5]/90 backdrop-blur-md border-b border-stone-200/70 safe-area-top">
        <div className="max-w-md mx-auto px-4 h-14 flex items-center justify-between">
          <button
            type="button"
            onClick={() => onSelectTab('discover')}
            className="flex items-center gap-2.5 text-left cursor-pointer"
            aria-label="Go to Discover"
          >
            <AppLogo size={32} className="rounded-xl shadow-sm" />
            <div>
              <span className="font-serif font-bold text-lg tracking-tight text-rose-950 block leading-tight">
                Lifebencher
              </span>
              <span className="text-[10px] tracking-widest text-amber-800 font-semibold uppercase block leading-none">
                Match
              </span>
            </div>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="w-9 h-9 rounded-full bg-stone-100 hover:bg-stone-200 border border-stone-200/80 flex items-center justify-center text-stone-600 transition active:scale-95 cursor-pointer"
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setShowNotifications(true)}
              className="w-9 h-9 rounded-full bg-stone-100 hover:bg-stone-200 border border-stone-200/80 flex items-center justify-center text-stone-600 transition active:scale-95 cursor-pointer relative"
              aria-label="View notifications"
            >
              <Bell className="w-4 h-4 text-stone-700" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Screen Container - Scrollable with safe bottom margin for BottomNav */}
      <main className="flex-1 max-w-md w-full mx-auto pb-24 px-4 pt-3">
        {children}
      </main>

      {/* Persistent Bottom Mobile Navigation Bar */}
      <BottomNav activeTab={activeTab} onSelectTab={onSelectTab} />

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
                <p className="p-4 text-center text-stone-500">
                  No activity yet. Matches, expirations, and verification updates will appear here.
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
