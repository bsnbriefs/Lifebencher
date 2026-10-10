import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Heart,
  SlidersHorizontal,
  ShieldCheck,
  MapPin,
  Briefcase,
  GraduationCap,
  Sparkles,
  CheckCircle2,
  X,
  Search,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Profile } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { calculateCompatibility, CompatibilityResult } from '../../lib/compatibility';
import { FilterSheet, DiscoverFilters } from '../discover/FilterSheet';
import { ProfileDetailModal } from '../discover/ProfileDetailModal';
import { sounds } from '../../lib/sound';
import { listenUserMatches, listenVisibleProfiles, fetchApprovedDiscoverProfiles } from '../../lib/matches';
import { listenOutgoingInterestIds, sendInterest } from '../../lib/interests';
import { listenBlockedIds, reportUser, blockUser } from '../../lib/safety';
import { listenEntitlements, EMPTY_ENTITLEMENTS, Entitlements } from '../../lib/billing';
import { usePWAInstall } from '../../hooks/usePWAInstall';

const FALLBACK_PHOTO =
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&auto=format&fit=crop&q=80';

function activityLabel(value?: string): string {
  if (!value) return '';
  const then = Date.parse(value);
  if (!Number.isFinite(then)) return '';
  if (Date.now() - then < 2 * 60 * 1000) return 'Active now';
  if (Date.now() - then > 14 * 24 * 60 * 60 * 1000) return '';
  return new Date(then).toDateString() === new Date().toDateString() ? 'Active today' : 'Active recently';
}

const DEFAULT_FILTERS: DiscoverFilters = {
  searchTerm: '',
  minAge: 18,
  maxAge: 99,
  location: 'All Locations',
  faith: 'All Faiths',
  relationshipIntents: []
};

function profileAge(profile: Profile): number | null {
  const age = Number(profile.age);
  return Number.isFinite(age) && age > 0 ? age : null;
}

function matchesLocation(profileLocation: string, filter: string): boolean {
  const value = (profileLocation || '').trim().toLowerCase();
  if (filter === 'International') {
    return !!value && !/\blagos\b|\babuja\b|port harcourt/.test(value);
  }
  return value.includes(filter.toLowerCase());
}

function matchesFaith(profileFaith: string, filter: string): boolean {
  const value = (profileFaith || '').trim().toLowerCase();
  if (filter === 'Christian') return value === 'christian' || value === 'christianity';
  if (filter === 'Muslim') return value === 'muslim' || value === 'islam';
  if (filter === 'Other') return value === 'other' || value === 'others';
  return value === filter.toLowerCase();
}

function DiscoverCardPhoto({ photos, name }: { photos?: string[]; name?: string }) {
  const list = (photos || []).filter(Boolean);
  const safe = list.length ? list : [FALLBACK_PHOTO];
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (safe.length < 2) return;
    const id = window.setInterval(() => setIdx((i) => (i + 1) % safe.length), 4000);
    return () => window.clearInterval(id);
  }, [safe.length]);
  return (
    <>
      <img
        src={safe[idx] || FALLBACK_PHOTO}
        alt={name || 'Profile'}
        className="w-full h-full object-cover group-hover:scale-101 transition duration-500"
        loading="lazy"
      />
      {safe.length > 1 && (
        <div className="absolute top-3 left-3 z-20 flex gap-1">
          {safe.map((_, i) => (
            <span key={i} className={`h-1 rounded-full ${i === idx ? 'w-5 bg-amber-300' : 'w-3 bg-white/40'}`} />
          ))}
        </div>
      )}
    </>
  );
}

export function DiscoverScreen() {
  const { user, currentProfile, preferences } = useAuth();
  const installState = usePWAInstall();
  const [showWelcome, setShowWelcome] = useState(false);
  const [installNote, setInstallNote] = useState<string | null>(null);
  const [notificationNote, setNotificationNote] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState<'install' | 'notify' | null>(null);

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filters, setFilters] = useState<DiscoverFilters>(DEFAULT_FILTERS);
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);

  // Selected profile for full detail modal
  const [detailProfile, setDetailProfile] = useState<Profile | null>(null);

  // Sent interests state
  const [sentInterests, setSentInterests] = useState<Record<string, boolean>>({});
  const [requestLoading, setRequestLoading] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [entitlements, setEntitlements] = useState<Entitlements>(EMPTY_ENTITLEMENTS(''));
  const [approvedIds, setApprovedIds] = useState<string[]>([]);
  const [blockedIds, setBlockedIds] = useState<string[]>([]);
  const approvedRef = useRef<Profile[]>([]);

  const dismissWelcome = () => {
    if (user?.id) localStorage.setItem(`lifebencher_welcome_${user.id}`, '1');
    setShowWelcome(false);
  };

  const handleInstall = async () => {
    if (installState.isInstalled) {
      setInstallNote('App already installed.');
      return;
    }
    if (!installState.isInstallable) {
      setInstallNote(installState.isIOS ? 'On iPhone, open Safari, tap Share, then Add to Home Screen.' : 'Installation is not available in this browser yet. Use the browser menu to add Lifebencher to your home screen.');
      return;
    }
    setActionBusy('install');
    try {
      const accepted = await installState.install();
      setInstallNote(accepted ? 'Lifebencher was installed on this device.' : 'Installation was not completed.');
    } finally {
      setActionBusy(null);
    }
  };

  const handleEnableNotifications = async () => {
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      setNotificationNote('Notifications are not supported in this browser.');
      return;
    }
    if (Notification.permission === 'denied') {
      setNotificationNote('Notifications are blocked. You can enable them in your browser or device settings.');
      return;
    }
    const vapid = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
    if (!vapid) {
      setNotificationNote('Notification setup could not be completed. Please try again.');
      return;
    }
    setActionBusy('notify');
    try {
      const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
      if (permission === 'denied') {
        setNotificationNote('Notifications are blocked. You can enable them in your browser or device settings.');
        return;
      }
      if (permission !== 'granted') {
        setNotificationNote('Notification permission was not granted.');
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const key = Uint8Array.from(atob(vapid.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
      const existing = await reg.pushManager.getSubscription();
      const sub = existing || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
      const token = await import('../../lib/firebase').then((m) => m.auth.currentUser?.getIdToken());
      const res = await fetch('/api/calls/subscribe', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub.toJSON() })
      });
      setNotificationNote(res.ok ? (existing ? 'Notifications are already enabled.' : 'Notifications enabled.') : 'Notification permission is enabled, but setup could not be completed. Please try again.');
    } catch {
      setNotificationNote('Notification permission is enabled, but setup could not be completed. Please try again.');
    } finally {
      setActionBusy(null);
    }
  };

  useEffect(() => {
    if (!user?.id) {
      setShowWelcome(false);
      return;
    }
    setShowWelcome(localStorage.getItem(`lifebencher_welcome_${user.id}`) !== '1');
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      setProfiles([]);
      setIsLoadingProfiles(false);
      return;
    }
    setIsLoadingProfiles(true);
    setLoadError(null);
    const buckets = { matches: [] as Profile[], visible: [] as Profile[], approved: [] as Profile[] };
    const publish = () => {
      const merged = new Map<string, Profile>();
      [...buckets.matches, ...buckets.visible, ...buckets.approved].forEach((p) => {
        if (!p || p.id === user.id || p.userId === user.id || p.isAdminProfile === true) return;
        merged.set(p.userId || p.id, p);
      });
      const list = Array.from(merged.values());
      approvedRef.current = list;
      setApprovedIds(list.map((p) => p.id));
      setProfiles(list);
      setIsLoadingProfiles(false);
    };
    const unsubMatches = listenUserMatches(user.id, (matches) => {
      buckets.matches = matches
        .filter((m) => m.status !== 'ended' && m.otherProfile)
        .map((m) => m.otherProfile as Profile);
      publish();
    });
    const unsubProfiles = listenVisibleProfiles(user.id, (list) => {
      buckets.visible = list;
      publish();
    });
    void fetchApprovedDiscoverProfiles().then((list) => {
      buckets.approved = list;
      publish();
    }).catch((err) => {
      setLoadError(err instanceof Error ? err.message : 'Approved profiles could not be loaded.');
      setIsLoadingProfiles(false);
    });
    const unsubEnt = listenEntitlements(user.id, setEntitlements);
    const unsubBlocks = listenBlockedIds(user.id, setBlockedIds);
    const unsubOutgoing = listenOutgoingInterestIds(user.id, (ids) => {
      const map: Record<string, boolean> = {};
      ids.forEach((id) => {
        map[id] = true;
      });
      setSentInterests(map);
    });
    return () => {
      unsubProfiles();
      unsubMatches();
      unsubOutgoing();
      unsubEnt();
      unsubBlocks();
    };
  }, [user?.id]);

  // Calculate compatibility for each candidate against active logged-in profile
  const compatibilityMap = useMemo(() => {
    const map: Record<string, CompatibilityResult> = {};
    if (!currentProfile) return map;
    profiles.forEach((p) => {
      try {
        map[p.id] = calculateCompatibility(currentProfile, p, preferences);
      } catch {
        /* skip a broken profile instead of crashing Discover */
      }
    });
    return map;
  }, [currentProfile, preferences, profiles]);

  // Filtered profiles
  const filteredProfiles = useMemo(() => {
    return profiles.filter((p) => {
      if (blockedIds.includes(p.id) || blockedIds.includes(p.userId)) return false;
      const eligible = approvedIds.includes(p.id) || approvedIds.includes(p.userId) || p.isVerified || p.isVisible;
      if (!eligible) return false;

      const myType =
        entitlements.matchType === 'local' || entitlements.matchType === 'international' || entitlements.matchType === 'both'
          ? entitlements.matchType
          : entitlements.matchmakingPackage === 'local' || entitlements.matchmakingPackage === 'international' || entitlements.matchmakingPackage === 'both'
            ? entitlements.matchmakingPackage
            : null;
      const theirType = p.matchType === 'local' || p.matchType === 'international' || p.matchType === 'both' ? p.matchType : null;
      if (myType && myType !== 'both' && theirType && theirType !== 'both' && theirType !== myType) return false;

      if (filters.searchTerm.trim()) {
        const query = filters.searchTerm.toLowerCase();
        const matchesName = (p.displayName || '').toLowerCase().includes(query);
        const matchesProf = (p.profession || '').toLowerCase().includes(query);
        if (!matchesName && !matchesProf) return false;
      }

      const age = profileAge(p);
      const minAge = Math.min(filters.minAge, filters.maxAge);
      const maxAge = Math.max(filters.minAge, filters.maxAge);
      const ageFilterActive = minAge !== DEFAULT_FILTERS.minAge || maxAge !== DEFAULT_FILTERS.maxAge;
      if (ageFilterActive && (age == null || age < minAge || age > maxAge)) return false;
      if (!ageFilterActive && age != null && (age < minAge || age > maxAge)) return false;

      if (filters.location !== 'All Locations' && !matchesLocation(p.location || '', filters.location)) return false;

      if (filters.faith !== 'All Faiths' && !matchesFaith(p.lifestyle?.faith || '', filters.faith)) return false;

      if (filters.relationshipIntents?.length) {
        const theirs = p.relationshipIntent || [];
        if (!filters.relationshipIntents.some((intent) => theirs.includes(intent))) return false;
      }

      return true;
    });
  }, [profiles, filters, blockedIds, entitlements, approvedIds]);

  // Active filter count indicator
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.searchTerm.trim()) count++;
    if (filters.minAge !== DEFAULT_FILTERS.minAge || filters.maxAge !== DEFAULT_FILTERS.maxAge) count++;
    if (filters.location !== 'All Locations') count++;
    if (filters.faith !== 'All Faiths') count++;
    if (filters.relationshipIntents?.length) count++;
    return count;
  }, [filters]);

  const handleBlock = (profileId: string) => {
    void blockUser(profileId)
      .then(() => setToastMessage('Member blocked and hidden from Discover.'))
      .catch((err) => setToastMessage(err instanceof Error ? err.message : 'Could not block.'));
  };

  const handleReport = (profileId: string) => {
    void reportUser(profileId, 'Inappropriate or unsafe')
      .then(() => setToastMessage('Report sent to Lifebencher admin.'))
      .catch((err) => setToastMessage(err instanceof Error ? err.message : 'Could not send report.'));
  };

  const handleExploreMatch = (profileId: string) => {
    const target = profiles.find((p) => p.id === profileId);
    if (!target) return;
    setRequestLoading(profileId);
    sounds.playSend();
    sendInterest(target.userId)
      .then((result) => {
        setSentInterests((prev) => ({ ...prev, [profileId]: true, [target.userId]: true }));
        setToastMessage(
          result === 'matched'
            ? `It's mutual with ${target.displayName}. A 7-day connection is now open.`
            : `Interest sent to ${target.displayName}. They'll review it in Matches.`
        );
        setTimeout(() => setToastMessage(null), 3500);
      })
      .catch((err) => {
        setToastMessage(err instanceof Error ? err.message : 'Could not open connection.');
        setTimeout(() => setToastMessage(null), 3500);
      })
      .finally(() => setRequestLoading(null));
  };

  return (
    <div className="space-y-4">
      {/* Header and Filter trigger */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold text-stone-900 tracking-tight">
            Discover
          </h1>
          <p className="text-xs text-stone-500">
            Verified, intentional profiles aligned with your criteria
          </p>
        </div>

        {/* Filter button with active count badge */}
        <button
          onClick={() => setIsFilterSheetOpen(true)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-2xl border text-xs font-semibold transition active:scale-95 cursor-pointer ${
            activeFilterCount > 0
              ? 'bg-rose-900 text-amber-100 border-rose-950 shadow-xs'
              : 'bg-white text-stone-700 border-stone-200 hover:border-stone-300'
          }`}
          aria-label="Filter profiles"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>Filter</span>
          {activeFilterCount > 0 && (
            <span className="w-4 h-4 rounded-full bg-amber-400 text-stone-950 text-[10px] font-bold flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {loadError && (
        <p className="text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-2xl p-3">{loadError}</p>
      )}
      {showWelcome && (
        <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/60 p-3" role="dialog" aria-modal="true" aria-labelledby="welcome-title" onClick={dismissWelcome}>
          <div className="w-full max-w-md max-h-[85dvh] overflow-y-auto rounded-3xl bg-white p-5 text-stone-800 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <h2 id="welcome-title" className="font-serif text-xl font-bold text-rose-950">Welcome to Lifebencher Match ❤️</h2>
              <button type="button" className="rounded-full p-1 text-stone-500" aria-label="Close welcome" onClick={dismissWelcome}><X className="w-5 h-5" /></button>
            </div>
            <p className="mt-2 text-sm">Your next meaningful connection could start here. Here's how to get started.</p>
            <ol className="mt-4 space-y-3 text-sm">
              <li><span className="font-semibold text-rose-900">1. Build your profile.</span> Complete your profile with your real details, preferences, and at least two clear photos of yourself. Accurate information and genuine photos help build trust.</li>
              <li><span className="font-semibold text-rose-900">2. Discover and connect.</span> Explore eligible profiles, use filters, and send a connection request. Once it is accepted, use Lifebencher chat to get to know each other.</li>
              <li><span className="font-semibold text-rose-900">3. Stay connected.</span> Install Lifebencher on your phone and enable notifications for messages, connection requests, and account updates. Delivery depends on your browser and device settings.</li>
            </ol>
            <div className="mt-5 grid gap-2">
              <button type="button" disabled={actionBusy !== null} className="rounded-full bg-rose-900 px-4 py-3 text-sm font-semibold text-amber-100 disabled:opacity-60" onClick={() => void handleInstall()}>{actionBusy === 'install' ? 'Opening install…' : 'Install the app'}</button>
              <button type="button" disabled={actionBusy !== null} className="rounded-full border border-stone-300 px-4 py-3 text-sm font-semibold disabled:opacity-60" onClick={() => void handleEnableNotifications()}>{actionBusy === 'notify' ? 'Setting up…' : 'Enable notifications'}</button>
              <button type="button" className="rounded-full px-4 py-3 text-sm font-semibold text-stone-600" onClick={dismissWelcome}>Explore Discover</button>
            </div>
            {installNote && <p className="mt-3 text-xs text-stone-500">{installNote}</p>}
            {notificationNote && <p className="mt-1 text-xs text-stone-500">{notificationNote}</p>}
          </div>
        </div>
      )}

      {/* Toast Notification Banner */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-3 bg-rose-900 text-amber-100 rounded-2xl text-xs flex items-center justify-between shadow-md"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-amber-300" />
              <span>{toastMessage}</span>
            </div>
            <button onClick={() => setToastMessage(null)} className="text-amber-200 text-xs">
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Profiles Feed */}
      {isLoadingProfiles ? (
        <div className="text-center py-16 bg-white rounded-3xl border border-stone-200 p-6">
          <p className="text-sm text-stone-500">Loading visible profiles…</p>
        </div>
      ) : filteredProfiles.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-3xl border border-stone-200 p-6 space-y-3">
          <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center mx-auto text-stone-400">
            <Search className="w-5 h-5" />
          </div>
          <h3 className="font-serif font-bold text-base text-stone-800">
            {profiles.length === 0 ? 'No other visible profiles yet' : 'No profiles match these filters'}
          </h3>
          <p className="text-xs text-stone-500 max-w-xs mx-auto">
            {profiles.length === 0
              ? 'When other members complete onboarding and stay visible, they will appear here.'
              : 'Try adjusting your age or location filters to see more verified members.'}
          </p>
          {profiles.length > 0 && (
          <button
            onClick={() => setFilters(DEFAULT_FILTERS)}
            className="text-xs font-semibold text-rose-900 underline cursor-pointer"
          >
            Reset All Filters
          </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredProfiles.map((p) => {
            const hasSent = !!sentInterests[p.id] || !!sentInterests[p.userId];
            const isLoading = requestLoading === p.id;
            const compatibility = compatibilityMap[p.id];

            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className="bg-white rounded-3xl overflow-hidden border border-stone-200/90 shadow-2xs hover:shadow-xs transition"
              >
                {/* Image & Card Header */}
                <div
                  className="relative aspect-4/5 w-full bg-stone-200 cursor-pointer group"
                  onClick={() => setDetailProfile(p)}
                >
                  <DiscoverCardPhoto photos={p.photos} name={p.displayName} />
                  <div className="absolute inset-0 bg-gradient-to-t from-stone-950/85 via-stone-950/20 to-transparent" />

                  {/* Compatibility score badge at top right */}
                  {compatibility && (
                    <div className="absolute top-3.5 right-3.5 bg-stone-900/85 backdrop-blur-md text-amber-300 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-sm border border-amber-300/30">
                      <Sparkles className="w-3 h-3 text-amber-300" />
                      <span>{compatibility.score}% Match</span>
                    </div>
                  )}

                  {/* Candidate Name & Info Overlay */}
                  <div className="absolute bottom-3.5 left-4 right-4 text-white">
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-serif text-2xl font-bold tracking-tight">
                        {p.displayName}, {p.age}
                      </h3>
                      {p.isVerified && (
                        <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs">
                          <ShieldCheck className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-stone-200 flex items-center gap-1 mt-0.5">
                      <Briefcase className="w-3 h-3 text-amber-300" />
                      <span>{p.profession}</span>
                    </p>
                    <p className="text-xs text-stone-300 flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3 text-amber-300" />
                      <span>{p.location}</span>
                    </p>
                    {activityLabel(p.lastActiveAt) && (
                      <p className={`text-[11px] mt-1 ${activityLabel(p.lastActiveAt) === 'Active now' ? 'text-emerald-300' : 'text-emerald-200'}`}>{activityLabel(p.lastActiveAt) === 'Active now' ? '● Active now' : activityLabel(p.lastActiveAt)}</p>
                    )}
                    {p.voiceIntroPath && (
                      <p className="text-[11px] text-stone-500 mt-1">{p.location}</p>
                    )}
                  </div>
                </div>

                {/* Card Body Details */}
                <div className="p-4 space-y-3">
                  {/* Bio snippet */}
                  <p className="text-xs text-stone-700 leading-relaxed line-clamp-2">
                    {p.bio}
                  </p>

                  {/* Compatibility highlight */}
                  {compatibility && (
                    <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200 flex items-start gap-2 text-xs text-stone-700">
                      <Sparkles className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                      <p className="text-[11px] leading-snug">
                        {compatibility.summary}
                      </p>
                    </div>
                  )}

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {p.values.slice(0, 2).map((val) => (
                      <span
                        key={val}
                        className="px-2.5 py-0.5 rounded-lg bg-[#2a2422] text-[#f3ece6] border border-white/15 text-[11px] font-medium"
                      >
                        {val}
                      </span>
                    ))}
                    {p.lifestyle?.faith && (
                      <span className="px-2.5 py-0.5 rounded-lg bg-[#2a2422] text-[#f3ece6] border border-white/15 text-[11px] font-medium">
                        {p.lifestyle.faith}
                      </span>
                    )}
                  </div>

                  {/* Actions Bar */}
                  <div className="pt-2 flex items-center gap-2 border-t border-stone-100">
                    <button
                      onClick={() => setDetailProfile(p)}
                      className="py-2.5 px-3 rounded-2xl border border-stone-200 text-stone-700 font-semibold text-xs hover:bg-stone-50 transition flex items-center gap-1 cursor-pointer"
                    >
                      <span>View Profile</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleExploreMatch(p.id)}
                      disabled={hasSent || isLoading}
                      className={`flex-1 py-2.5 px-4 rounded-2xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition active:scale-98 cursor-pointer ${
                        hasSent
                          ? 'bg-emerald-600 text-white cursor-default'
                          : 'bg-gradient-to-r from-rose-900 via-rose-800 to-amber-700 text-white hover:opacity-95'
                      }`}
                    >
                      {isLoading ? (
                        <span>Sending...</span>
                      ) : hasSent ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-200" />
                          <span>Interest Sent</span>
                        </>
                      ) : (
                        <>
                          <Heart className="w-3.5 h-3.5 fill-white/20" />
                          <span>Connect</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="flex gap-3 pt-1">
                    <button type="button" className="text-[10px] text-stone-400" onClick={() => handleReport(p.userId || p.id)}>
                      Report
                    </button>
                    <button type="button" className="text-[10px] text-stone-400" onClick={() => handleBlock(p.userId || p.id)}>
                      Block
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Filter Bottom Sheet Modal */}
      <FilterSheet
        isOpen={isFilterSheetOpen}
        filters={filters}
        onClose={() => setIsFilterSheetOpen(false)}
        onApply={(newFilters) => setFilters(newFilters)}
        onReset={() => setFilters(DEFAULT_FILTERS)}
      />

      {/* Profile Detail Modal */}
      {detailProfile && (
        <ProfileDetailModal
          profile={detailProfile}
          compatibility={compatibilityMap[detailProfile.id]}
          hasSentInterest={!!sentInterests[detailProfile.id]}
          isLoading={requestLoading === detailProfile.id}
          onClose={() => setDetailProfile(null)}
          onExploreMatch={(pid) => handleExploreMatch(pid)}
        />
      )}
    </div>
  );
};
