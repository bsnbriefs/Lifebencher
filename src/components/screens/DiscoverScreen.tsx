import React, { useState, useMemo, useEffect } from 'react';
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
import { listenVisibleProfiles } from '../../lib/matches';
import { listenOutgoingInterestIds, sendInterest } from '../../lib/interests';

const FALLBACK_PHOTO =
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&auto=format&fit=crop&q=80';

const DEFAULT_FILTERS: DiscoverFilters = {
  searchTerm: '',
  minAge: 21,
  maxAge: 45,
  location: 'All Locations',
  faith: 'All Faiths'
};

export const DiscoverScreen: React.FC = () => {
  const { user, currentProfile, preferences } = useAuth();

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(true);
  const [filters, setFilters] = useState<DiscoverFilters>(DEFAULT_FILTERS);
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);

  // Selected profile for full detail modal
  const [detailProfile, setDetailProfile] = useState<Profile | null>(null);

  // Sent interests state
  const [sentInterests, setSentInterests] = useState<Record<string, boolean>>({});
  const [requestLoading, setRequestLoading] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) {
      setProfiles([]);
      setIsLoadingProfiles(false);
      return;
    }
    setIsLoadingProfiles(true);
    const unsubProfiles = listenVisibleProfiles(user.id, (list) => {
      setProfiles(list);
      setIsLoadingProfiles(false);
    });
    const unsubOutgoing = listenOutgoingInterestIds(user.id, (ids) => {
      const map: Record<string, boolean> = {};
      ids.forEach((id) => {
        map[id] = true;
      });
      setSentInterests(map);
    });
    return () => {
      unsubProfiles();
      unsubOutgoing();
    };
  }, [user?.id]);

  // Calculate compatibility for each candidate against active logged-in profile
  const compatibilityMap = useMemo(() => {
    const map: Record<string, CompatibilityResult> = {};
    if (!currentProfile) return map;
    profiles.forEach((p) => {
      map[p.id] = calculateCompatibility(currentProfile, p, preferences);
    });
    return map;
  }, [currentProfile, preferences, profiles]);

  // Filtered profiles
  const filteredProfiles = useMemo(() => {
    return profiles.filter((p) => {
      // Keyword search in name or profession
      if (filters.searchTerm.trim()) {
        const query = filters.searchTerm.toLowerCase();
        const matchesName = p.displayName.toLowerCase().includes(query);
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
  }, [profiles, filters]);

  // Active filter count indicator
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.searchTerm.trim()) count++;
    if (filters.minAge > 21 || filters.maxAge < 45) count++;
    if (filters.location !== 'All Locations') count++;
    if (filters.faith !== 'All Faiths') count++;
    return count;
  }, [filters]);

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
                  <img
                    src={p.photos[0] || FALLBACK_PHOTO}
                    alt={p.displayName}
                    className="w-full h-full object-cover group-hover:scale-101 transition duration-300"
                    loading="lazy"
                  />
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
                    <div className="p-2.5 rounded-xl bg-rose-50/80 border border-rose-100 flex items-start gap-2 text-xs text-rose-950">
                      <Sparkles className="w-3.5 h-3.5 text-rose-800 shrink-0 mt-0.5" />
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
                        className="px-2.5 py-0.5 rounded-lg bg-stone-100 text-stone-700 text-[11px] font-medium"
                      >
                        {val}
                      </span>
                    ))}
                    {p.lifestyle?.faith && (
                      <span className="px-2.5 py-0.5 rounded-lg bg-amber-50 text-amber-900 border border-amber-200/50 text-[11px] font-medium">
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
          hasSentInterest={!!sentInterests[detailProfile.id]}
          isLoading={requestLoading === detailProfile.id}
          onClose={() => setDetailProfile(null)}
          onExploreMatch={(pid) => handleExploreMatch(pid)}
        />
      )}
    </div>
  );
};
