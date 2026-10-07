import React, { lazy, Suspense, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { NavigationTab } from './types';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { MobileAppShell } from './components/layout/MobileAppShell';
import { DiscoverScreen } from './components/screens/DiscoverScreen';
import { MatchesScreen } from './components/screens/MatchesScreen';
import { MessagesScreen } from './components/screens/MessagesScreen';
import { ProfileScreen } from './components/screens/ProfileScreen';
import { OnboardingFlow } from './components/onboarding/OnboardingFlow';
import { MatchmakingPaywall } from './components/onboarding/MatchmakingPaywall';

const AdminDashboard = lazy(() =>
  import('./components/admin/AdminDashboard').then((m) => ({ default: m.AdminDashboard }))
);
import { WifiOff } from 'lucide-react';
import { EMPTY_ENTITLEMENTS, listenEntitlements } from './lib/billing';
import { db } from './lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { AuthActionPage, firebaseActionFromLocation } from './components/auth/AuthActionPage';

const TABS: NavigationTab[] = ['discover', 'matches', 'messages', 'profile'];

function tabFromHash(): NavigationTab {
  const raw = window.location.hash.replace('#', '');
  return TABS.includes(raw as NavigationTab) ? (raw as NavigationTab) : 'discover';
}

function AppContent() {
  const firebaseAction = firebaseActionFromLocation();
  const { isAuthenticated, isOnboarded, isLoading, isAdmin, user } = useAuth();
  const [entitlements, setEntitlements] = useState(EMPTY_ENTITLEMENTS(''));
  const [entReady, setEntReady] = useState(false);
  const [activeTab, setActiveTab] = useState<NavigationTab>(tabFromHash);
  const [targetChatMatchId, setTargetChatMatchId] = useState<string | null>(null);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const selectTab = (tab: NavigationTab) => {
    setActiveTab(tab);
    const next = `#${tab}`;
    if (window.location.hash !== next) {
      window.history.pushState({ tab }, '', next);
    }
  };

  useEffect(() => {
    if (!user?.id) return;
    const day = new Date().toISOString().slice(0, 10);
    const key = `lb-active-${user.id}`;
    if (sessionStorage.getItem(key) === day) return;
    sessionStorage.setItem(key, day);
    void updateDoc(doc(db, 'profiles', user.id), { lastActiveAt: new Date().toISOString() }).catch(() => undefined);
    const timer = window.setInterval(() => {
      void updateDoc(doc(db, 'profiles', user.id), { lastActiveAt: new Date().toISOString() }).catch(() => undefined);
    }, 120000);
    const vapid = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
    if (vapid && 'serviceWorker' in navigator && 'PushManager' in window && Notification.permission === 'granted') {
      void navigator.serviceWorker.ready.then(async (reg) => {
        const pad = (value: string) => Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
        const existing = await reg.pushManager.getSubscription();
        const sub = existing || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: pad(vapid) });
        const token = await import('./lib/firebase').then((m) => m.auth.currentUser?.getIdToken());
        await fetch('/api/calls/subscribe', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription: sub.toJSON() }) });
      }).catch(() => undefined);
    }
    return () => window.clearInterval(timer);
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      setEntitlements(EMPTY_ENTITLEMENTS(''));
      setEntReady(true);
      return;
    }
    setEntReady(false);
    const unsub = listenEntitlements(user.id, (ent) => {
      setEntitlements(ent);
      setEntReady(true);
    });
    return () => unsub();
  }, [user?.id]);

  useEffect(() => {
    const titles: Record<NavigationTab, string> = {
      discover: 'Lifebencher Match | Discover',
      matches: 'Lifebencher Match | Matches',
      messages: 'Lifebencher Match | Messages',
      profile: 'Lifebencher Match | Profile'
    };
    document.title = titles[activeTab] || 'Lifebencher Match | Find Your Match';
  }, [activeTab]);

  useEffect(() => {
    if (!window.location.hash) {
      window.history.replaceState({ tab: activeTab }, '', `#${activeTab}`);
    }
    const onPop = () => setActiveTab(tabFromHash());
    window.addEventListener('popstate', onPop);
    window.addEventListener('hashchange', onPop);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('hashchange', onPop);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleOpenChat = (matchId: string) => {
    setTargetChatMatchId(matchId);
    selectTab('messages');
  };

  if (firebaseAction) {
    return <AuthActionPage mode={firebaseAction.mode} oobCode={firebaseAction.oobCode} />;
  }

  const payReturn =
    typeof window !== 'undefined' &&
    (new URLSearchParams(window.location.search).get('flw') === '1' ||
      Boolean(new URLSearchParams(window.location.search).get('transaction_id')) ||
      sessionStorage.getItem('lifebencher_flw_return') === '1');

  if (isLoading || (payReturn && isAuthenticated && !entReady)) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center">
        <p className="text-sm text-stone-500">
          {payReturn ? 'Confirming your payment…' : 'Connecting to Lifebencher…'}
        </p>
      </div>
    );
  }

  if (isAdminMode && isAdmin) {
    return (
      <Suspense fallback={<div className="min-h-screen bg-[#FAF8F5]" />}>
        <AdminDashboard onBackToApp={() => setIsAdminMode(false)} />
      </Suspense>
    );
  }

  if (!isAuthenticated) {
    return <OnboardingFlow />;
  }

  if (!entReady && !payReturn) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center">
        <p className="text-sm text-stone-500">Loading your account…</p>
      </div>
    );
  }

  if (isAdmin || entitlements.matchmakingPackage !== 'none') {
    /* existing paid/admin account — never force new registration */
  } else if (!isOnboarded && !payReturn) {
    return <OnboardingFlow />;
  } else if (entitlements.matchmakingPackage === 'none') {
    return <MatchmakingPaywall />;
  }

  return (
    <div className="relative h-[100dvh] max-h-[100dvh] overflow-hidden bg-[#FAF8F5]">
      {/* Offline notification banner */}
      {!isOnline && (
        <div className="bg-amber-600 text-white px-4 py-1.5 text-xs flex items-center justify-center gap-2 sticky top-0 z-50">
          <WifiOff className="w-3.5 h-3.5" />
          <span>Offline Mode — Cached data is being used.</span>
        </div>
      )}

      <MobileAppShell activeTab={activeTab} onSelectTab={selectTab}>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
            {activeTab === 'discover' && <DiscoverScreen />}
            {activeTab === 'matches' && <MatchesScreen onOpenChat={handleOpenChat} />}
            {activeTab === 'messages' && (
              <MessagesErrorBoundary>
                <MessagesScreen initialConversationId={targetChatMatchId} />
              </MessagesErrorBoundary>
            )}
            {activeTab === 'profile' && (
              <ProfileScreen onOpenAdmin={isAdmin ? () => setIsAdminMode(true) : undefined} />
            )}
          </motion.div>
        </AnimatePresence>
      </MobileAppShell>
    </div>
  );
}

class MessagesErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(error: Error) {
    return { error: error.message || 'Messages failed to load' };
  }
  componentDidCatch(error: Error) {
    console.error('Messages screen failed', error);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="p-6 text-center space-y-3">
          <p className="text-sm font-semibold text-stone-800">Something went wrong loading this conversation.</p>
          <p className="text-xs text-stone-500">{this.state.error}</p>
          <button type="button" className="px-4 py-2 rounded-full bg-rose-900 text-amber-100 text-xs font-semibold" onClick={() => this.setState({ error: null })}>Try again</button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}
