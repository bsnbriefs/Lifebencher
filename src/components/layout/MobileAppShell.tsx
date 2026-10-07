import React, { useEffect, useState } from 'react';
import { Bell, X, Sun, Moon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { NavigationTab } from '../../types';
import { BottomNav } from './BottomNav';
import { PWAInstallPrompt } from '../common/PWAInstallPrompt';
import { AppLogo } from '../common/AppLogo';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { AppNotification, listenNotifications, markNotificationRead } from '../../lib/notifications';
import { CallOverlay } from '../chat/CallOverlay';
import { listenUserMatches } from '../../lib/matches';

interface MobileAppShellProps {
  activeTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  children: React.ReactNode;
}

function ago(value: string): string {
  const then = Date.parse(value);
  if (!Number.isFinite(then)) return '';
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.round(hours / 24)} d ago`;
}

export const MobileAppShell: React.FC<MobileAppShellProps> = ({
  activeTab,
  onSelectTab,
  children
}) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();
  const [askPush, setAskPush] = useState(false);
  const unread = items.filter((item) => !item.read).length;
  useEffect(() => {
    if (!user?.id || !('Notification' in window)) return;
    if (Notification.permission === 'default' && localStorage.getItem('lb-push-asked') !== '1') setAskPush(true);
  }, [user?.id]);
  const [incomingMatches, setIncomingMatches] = useState<{ id: string; peerId: string; peerName: string }[]>([]);

  useEffect(() => {
    if (!user?.id) return;
    return listenUserMatches(user.id, (matches) => {
      setIncomingMatches(matches.filter((m) => m.status !== 'ended').map((m) => ({
        id: m.id,
        peerId: m.user1Id === user.id ? m.user2Id : m.user1Id,
        peerName: m.otherProfile?.displayName || 'Member'
      })));
    });
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      setItems([]);
      return;
    }
    return listenNotifications(user.id, setItems);
  }, [user?.id]);

  return (
    <div className="h-[100dvh] max-h-[100dvh] bg-[#FAF8F5] text-stone-900 flex flex-col font-sans selection:bg-rose-100 selection:text-rose-900 overflow-hidden">
      {/* PWA Install Notification Bar */}
      <PWAInstallPrompt />

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
              {unread > 0 && <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-rose-800 text-white text-[9px] flex items-center justify-center">{unread > 99 ? '99+' : unread}</span>}
            </button>
          </div>
        </div>
      </header>

      {/* Main Screen Container - Scrollable with safe bottom margin for BottomNav */}
      <main
        className="flex-1 min-h-0 max-w-md w-full mx-auto px-4 pt-3 overflow-y-auto overscroll-y-contain"
        style={{ paddingBottom: 'calc(6.5rem + env(safe-area-inset-bottom, 0px))', WebkitOverflowScrolling: 'touch' }}
      >
        {children}
      </main>

      {/* Persistent Bottom Mobile Navigation Bar */}
      {askPush && (
        <div className="mx-4 mt-2 rounded-2xl border border-stone-200 bg-white p-3 text-xs text-stone-700">
          <p>Allow notifications so Lifebencher can alert you when someone calls you, even when the app isn't open.</p>
          <div className="mt-2 flex gap-2">
            <button type="button" className="px-3 py-1.5 rounded-full bg-rose-900 text-white" onClick={() => { localStorage.setItem('lb-push-asked', '1'); setAskPush(false); void Notification.requestPermission(); }}>Allow</button>
            <button type="button" className="px-3 py-1.5 rounded-full border" onClick={() => { localStorage.setItem('lb-push-asked', '1'); setAskPush(false); }}>Not now</button>
          </div>
        </div>
      )}
      <BottomNav activeTab={activeTab} onSelectTab={onSelectTab} />
      {user?.id && incomingMatches.map((m) => (
        <CallOverlay key={m.id} headless matchId={m.id} myId={user.id} peerId={m.peerId} peerName={m.peerName} />
      ))}

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

              <div className="space-y-2 text-xs max-h-80 overflow-y-auto">
                {items.length === 0 && <p className="p-4 text-center text-stone-500">No activity yet. Matches, messages, and verification updates will appear here.</p>}
                {items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="w-full text-left p-3 rounded-2xl bg-stone-50 border border-stone-100"
                    onClick={() => {
                      void markNotificationRead(item.id);
                      setShowNotifications(false);
                      onSelectTab(item.href);
                    }}
                  >
                    <span className={`block font-semibold ${item.read ? 'text-stone-500' : 'text-stone-900'}`}>{item.title}</span>
                    <span className="block text-stone-500">{item.body}</span>
                    <span className="block text-[10px] text-stone-400">{ago(item.createdAt)}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
