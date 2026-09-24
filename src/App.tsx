import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { NavigationTab } from './types';
import { AuthProvider, useAuth } from './context/AuthContext';
import { MobileAppShell } from './components/layout/MobileAppShell';
import { DiscoverScreen } from './components/screens/DiscoverScreen';
import { MatchesScreen } from './components/screens/MatchesScreen';
import { MessagesScreen } from './components/screens/MessagesScreen';
import { ProfileScreen } from './components/screens/ProfileScreen';
import { OnboardingFlow } from './components/onboarding/OnboardingFlow';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { WifiOff } from 'lucide-react';

function AppContent() {
  const { isAuthenticated, isOnboarded } = useAuth();
  const [activeTab, setActiveTab] = useState<NavigationTab>('discover');
  const [targetChatMatchId, setTargetChatMatchId] = useState<string | null>(null);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleOpenChat = (matchId: string) => {
    setTargetChatMatchId(matchId);
    setActiveTab('messages');
  };

  // If user is in Admin Concierge mode, render full Admin Portal
  if (isAdminMode) {
    return <AdminDashboard onBackToApp={() => setIsAdminMode(false)} />;
  }

  // If user is not authenticated or hasn't finished the onboarding steps, show OnboardingFlow
  if (!isAuthenticated || !isOnboarded) {
    return <OnboardingFlow />;
  }

  return (
    <div className="relative min-h-screen bg-[#FAF8F5]">
      {/* Offline notification banner */}
      {!isOnline && (
        <div className="bg-amber-600 text-white px-4 py-1.5 text-xs flex items-center justify-center gap-2 sticky top-0 z-50">
          <WifiOff className="w-3.5 h-3.5" />
          <span>Offline Mode — Cached data is being used.</span>
        </div>
      )}

      <MobileAppShell activeTab={activeTab} onSelectTab={setActiveTab}>
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
            {activeTab === 'messages' && <MessagesScreen initialConversationId={targetChatMatchId} />}
            {activeTab === 'profile' && <ProfileScreen onOpenAdmin={() => setIsAdminMode(true)} />}
          </motion.div>
        </AnimatePresence>
      </MobileAppShell>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
