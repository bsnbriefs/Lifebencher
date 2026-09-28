import React, { useState, useMemo } from 'react';
import {
  Heart,
  SlidersHorizontal,
  ShieldCheck,
  MapPin,
  Briefcase,
  Sparkles,
  CheckCircle2,
  X,
  Search,
  ChevronRight,
  UserCheck,
  MessageCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Profile } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { calculateCompatibility, CompatibilityResult } from '../../lib/compatibility';
import { FilterSheet, DiscoverFilters } from '../discover/FilterSheet';
import { ProfileDetailModal } from '../discover/ProfileDetailModal';
import { sounds } from '../../lib/sound';
import { resolveDisplayName } from '../../lib/userNames';

const DEFAULT_FILTERS: DiscoverFilters = {
  searchTerm: '',
  minAge: 21,
  maxAge: 45,
  location: 'All Locations',
  faith: 'All Faiths'
};

interface DiscoverScreenProps {
  onOpenChat?: (matchId: string) => void;
  onOpenProfileSwitcher?: () => void;
}

export const DiscoverScreen: React.FC<DiscoverScreenProps> = ({ onOpenChat, onOpenProfileSwitcher }) => {
  const {
    allProfiles,
    currentProfile,
    preferences,
    sentInterests,
    sendInterest,
    activeMatches
  } = useAuth();

  const [filters, setFilters] = useState<DiscoverFilters>(DEFAULT_FILTERS);
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);

  // Selected profile for full detail modal
  const [detailProfile, setDetailProfile] = useState<Profile | null>(null);

  // Request in flight
  const [requestLoading, setRequestLoading] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Match celebration state
  const [celebrationMatch, setCelebrationMatch] = useState<{
    displayName: string;
    photo: string;
    matchId: string;
  } | null>(null);

  // Candidate pool: Exclude own profile and exclude active matches
  const candidateProfiles = useMemo(() => {
    if (!currentProfile) return allProfiles;

    const matchedUserIds = new Set<string>();
    activeMatches.forEach((m) => {
      if (m.user1Id === currentProfile.userId) matchedUserIds.add(m.user2Id);
      if (m.user2Id === currentProfile.userId) matchedUserIds.add(m.user1Id);
    });

    return allProfiles.filter(
      (p) => p.id !== currentProfile.id && p.userId !== currentProfile.userId && !matchedUserIds.has(p.userId)
    );
  }, [allProfiles, currentProfile, activeMatches]);

  // Calculate compatibility for each candidate against active logged-in profile
  const compatibilityMap = useMemo(() => {
    const map: Record<string, CompatibilityResult> = {};
    if (!currentProfile) return map;
    candidateProfiles.forEach((p) => {
      map[p.id] = calculateCompatibility(currentProfile, p, preferences);
    });
    return map;
  }, [currentProfile, preferences, candidateProfiles]);

  // Filtered profiles
  const filteredProfiles = useMemo(() => {
    return candidateProfiles.filter((p) => {
      // Keyword search in name or profession
      if (filters.searchTerm.trim()) {
        const query = filters.searchTerm.toLowerCase();
        const matchesName = resolveDisplayName(p).toLowerCase().includes(query);
        const matchesProf = p.profession.toLowerCase().includes(query);
        if (!matchesName && !matchesProf) return false;
      }

      // Age range
      if (p.age < filters.minAge || p.age > filters.maxAge) {
        return false;
      }

      // Location filter
      if (filters.location !== 'All Locations') {
        if (!p.location.toLowerCase().includes(filters.location.toLowerCase())) {
          return false;
        }
      }

      // Faith filter
      if (filters.faith !== 'All Faiths') {
        if (p.lifestyle?.faith?.toLowerCase() !== filters.faith.toLowerCase()) {
          return false;
        }
      }

      return true;
    });
  }, [candidateProfiles, filters]);

  // Active filter count indicator
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.searchTerm.trim()) count++;
    if (filters.minAge > 21 || filters.maxAge < 45) count++;
    if (filters.location !== 'All Locations') count++;
    if (filters.faith !== 'All Faiths') count++;
    return count;
  }, [filters]);

  const handleExploreMatch = (candidate: Profile) => {
    if (!currentProfile) return;
    setRequestLoading(candidate.id);
    sounds.playSend();

    setTimeout(() => {
      setRequestLoading(null);
      const result = sendInterest(candidate.id);

      if (result.isMatch && result.matchId) {
        sounds.playMatchCelebration();
        setCelebrationMatch({
          displayName: resolveDisplayName(candidate),
          photo: candidate.photos[0],
          matchId: result.matchId
        });
      } else {
        const candidateName = resolveDisplayName(candidate);
        setToastMessage(
          `Interest sent to ${candidateName}! You can switch profile to ${candidateName} to accept and test the mutual match.`
        );
        setTimeout(() => setToastMessage(null), 4500);
      }
    }, 450);
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
        <div className="flex items-center gap-1.5">
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
      </div>

      {/* Toast Notification Banner */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-3 bg-stone-900 text-amber-100 rounded-2xl text-xs flex items-center justify-between shadow-md border border-amber-400/40"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{toastMessage}</span>
            </div>
            <button onClick={() => setToastMessage(null)} className="text-stone-400 hover:text-white text-xs ml-2 cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Profiles Feed */}
      {filteredProfiles.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-3xl border border-stone-200 p-6 space-y-3">
          <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center mx-auto text-rose-800">
            <UserCheck className="w-5 h-5" />
          </div>
          <h3 className="font-serif font-bold text-base text-stone-800">
            All Current Candidates Reviewed!
          </h3>
          <p className="text-xs text-stone-500 max-w-xs mx-auto">
            You've explored the available cohort or filtered all profiles. Create a new real profile or adjust your filters!
          </p>
          <div className="flex justify-center gap-2 pt-1">
            <button
              onClick={() => setFilters(DEFAULT_FILTERS)}
              className="px-3.5 py-2 rounded-xl border border-stone-300 text-xs font-semibold text-stone-700 hover:bg-stone-50 cursor-pointer"
            >
              Reset Filters
            </button>
            {onOpenProfileSwitcher && (
              <button
                onClick={onOpenProfileSwitcher}
                className="px-3.5 py-2 rounded-xl bg-rose-900 text-amber-100 text-xs font-bold shadow-xs hover:bg-rose-950 cursor-pointer"
              >
                + Add Real Profile
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredProfiles.map((p) => {
            const hasSent = currentProfile && !!sentInterests[`${currentProfile.userId}_${p.userId}`];
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
                  <img
                    src={p.photos[0]}
                    alt={resolveDisplayName(p)}
                    className="w-full h-full object-cover group-hover:scale-101 transition duration-300"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-stone-950/85 via-stone-950/20 to-transparent" />

                  {/* Compatibility score badge at top right */}
                  {compatibility && (
                    <div className="absolute top-3.5 right-3.5 bg-black/50 backdrop-blur-md text-amber-200/95 px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 shadow-2xs border border-white/15">
                      <Sparkles className="w-3 h-3 text-amber-300" />
                      <span>{compatibility.score}% Match</span>
                    </div>
                  )}

                  {/* Candidate Name & Info Overlay */}
                  <div className="absolute bottom-3.5 left-4 right-4 text-white">
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-serif text-2xl font-bold tracking-tight">
                        {resolveDisplayName(p)}, {p.age}
                      </h3>
                      {p.isVerified && (
                        <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs">
                          <ShieldCheck className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-stone-200/90 flex items-center gap-1 mt-0.5">
                      <span>{p.profession}</span>
                      <span aria-hidden="true" className="text-stone-400">·</span>
                      <span>{p.location}</span>
                    </p>
                  </div>
                </div>

                {/* Card Body Details */}
                <div className="p-4 space-y-2.5">
                  {/* Bio snippet */}
                  <p className="text-xs text-stone-700 leading-relaxed line-clamp-2">
                    {p.bio}
                  </p>

                  {/* Compatibility highlight */}
                  {compatibility && (
                    <div className="py-1.5 px-2.5 rounded-xl bg-amber-50/60 border border-amber-200/40 flex items-start gap-1.5 text-xs text-stone-800">
                      <Sparkles className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                      <p className="text-[11px] leading-snug text-stone-700">
                        {compatibility.summary}
                      </p>
                    </div>
                  )}

                  {/* Unboxed Metadata / Values */}
                  <div className="flex items-center gap-2 text-[11px] text-stone-500 font-medium flex-wrap pt-0.5">
                    {p.values.slice(0, 2).map((val, idx) => (
                      <React.Fragment key={val}>
                        {idx > 0 && <span aria-hidden="true" className="text-stone-300">·</span>}
                        <span>{val}</span>
                      </React.Fragment>
                    ))}
                    {p.lifestyle?.faith && (
                      <>
                        <span aria-hidden="true" className="text-stone-300">·</span>
                        <span className="text-stone-600">{p.lifestyle.faith}</span>
                      </>
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
                      onClick={() => handleExploreMatch(p)}
                      disabled={hasSent || isLoading}
                      className={`flex-1 py-2.5 px-4 rounded-2xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition active:scale-98 cursor-pointer ${
                        hasSent
                          ? 'bg-emerald-700 text-white cursor-default'
                          : 'bg-rose-900 hover:bg-rose-950 text-amber-100'
                      }`}
                    >
                      {isLoading ? (
                        <span>Delivering...</span>
                      ) : hasSent ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-200" />
                          <span>Interest Sent</span>
                        </>
                      ) : (
                        <>
                          <Heart className="w-3.5 h-3.5 fill-white/20" />
                          <span>Explore Match</span>
                        </>
                      )}
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
          hasSentInterest={
            currentProfile ? !!sentInterests[`${currentProfile.userId}_${detailProfile.userId}`] : false
          }
          isLoading={requestLoading === detailProfile.id}
          onClose={() => setDetailProfile(null)}
          onExploreMatch={() => handleExploreMatch(detailProfile)}
        />
      )}

      {/* MUTUAL MATCH CELEBRATION MODAL */}
      <AnimatePresence>
        {celebrationMatch && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
            <motion.div
              initial={{ scale: 0.85, opacity: 0, y: 25 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full max-w-sm bg-gradient-to-b from-stone-950 via-rose-950 to-stone-950 text-white rounded-3xl p-6 text-center shadow-2xl border border-amber-400/40 relative overflow-hidden"
            >
              {/* Overlapping profile avatars */}
              <div className="flex items-center justify-center -space-x-4 my-3">
                <img
                  src={
                    currentProfile?.photos[0] ||
                    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800'
                  }
                  alt="You"
                  className="w-20 h-20 rounded-full object-cover border-4 border-rose-900 shadow-lg ring-2 ring-amber-300/60"
                />
                <img
                  src={celebrationMatch.photo}
                  alt={celebrationMatch.displayName}
                  className="w-20 h-20 rounded-full object-cover border-4 border-stone-900 shadow-lg ring-2 ring-amber-300/60"
                />
              </div>

              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 text-[11px] font-bold tracking-widest uppercase mb-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Mutual Alignment</span>
              </div>

              <h3 className="font-serif text-3xl font-bold text-amber-100">
                It's a Match!
              </h3>

              <p className="text-xs text-stone-200 mt-2 max-w-xs mx-auto leading-relaxed">
                You and {celebrationMatch.displayName} have mutually connected! You now have an intentional 7-day window to converse and align on life vision.
              </p>

              <div className="mt-6 space-y-2.5">
                <button
                  onClick={() => {
                    const mId = celebrationMatch.matchId;
                    setCelebrationMatch(null);
                    if (onOpenChat) onOpenChat(mId);
                  }}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 text-stone-950 font-bold text-xs shadow-lg hover:from-amber-300 hover:to-amber-400 active:scale-98 transition cursor-pointer flex items-center justify-center gap-2"
                >
                  <MessageCircle className="w-4 h-4 fill-stone-950" />
                  <span>Start Private Conversation</span>
                </button>

                <button
                  onClick={() => setCelebrationMatch(null)}
                  className="w-full py-2.5 text-stone-400 hover:text-white text-xs transition cursor-pointer"
                >
                  Keep Exploring
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
