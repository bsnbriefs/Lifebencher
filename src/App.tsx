import { lazy, Suspense, useState, useEffect } from 'react';
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
