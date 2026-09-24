import React, { useState, useMemo } from 'react';
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

const INITIAL_PROFILES: Profile[] = [
  {
    id: 'prof_amaka',
    userId: 'usr_amaka',
    displayName: 'Amaka',
    age: 28,
    gender: 'female',
    location: 'Victoria Island, Lagos',
    profession: 'Senior Financial Analyst',
    education: 'B.Sc. Economics (Unilag)',
    bio: 'Rooted in faith, purposeful conversations, and classical architecture. I value intellectual honesty and shared family vision above all.',
    photos: [
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&auto=format&fit=crop&q=80'
    ],
    interests: ['Fine Art', 'Literature', 'Classical Jazz', 'Architecture'],
    values: ['Faith & Family', 'Emotional Intelligence', 'Honesty', 'Continuous Growth'],
    relationshipGoal: 'Intentional courtship leading to marriage',
    lifestyle: {
      faith: 'Christian',
      drinking: 'socially',
      smoking: 'no',
      exercise: 'active',
      kids: 'wants kids'
    },
    isVerified: true,
    isVisible: true,
    createdAt: '2025-01-10T00:00:00.000Z',
    updatedAt: '2025-01-10T00:00:00.000Z'
  },
  {
    id: 'prof_kemi',
    userId: 'usr_kemi',
    displayName: 'Kemi',
    age: 29,
    gender: 'female',
    location: 'Ikoyi, Lagos',
    profession: 'Pediatric Specialist',
    education: 'MBBS (King’s College London)',
    bio: 'Dedicated physician passionate about maternal health and quiet beach retreats. I appreciate people who lead with kindness and integrity.',
    photos: [
      'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=800&auto=format&fit=crop&q=80'
    ],
    interests: ['Medicine & Wellness', 'Travel & Exploration', 'Culinary Arts', 'Jazz'],
    values: ['Integrity & Honesty', 'Family-Centered', 'Mutual Respect', 'Generosity & Kindness'],
    relationshipGoal: 'Long-term marriage with deep companionship',
    lifestyle: {
      faith: 'Christian',
      drinking: 'no',
      smoking: 'no',
      exercise: 'sometimes',
      kids: 'wants kids'
    },
    isVerified: true,
    isVisible: true,
    createdAt: '2025-01-12T00:00:00.000Z',
    updatedAt: '2025-01-12T00:00:00.000Z'
  },
  {
    id: 'prof_fatima',
    userId: 'usr_fatima',
    displayName: 'Fatima',
    age: 27,
    gender: 'female',
    location: 'Maitama, Abuja',
    profession: 'Renewable Energy Consultant',
    education: 'M.Sc. Sustainable Energy (Imperial)',
    bio: 'Building green infrastructure across West Africa. In my free time, I love hiking, thoughtful discussions, and reading history.',
    photos: [
      'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=800&auto=format&fit=crop&q=80'
    ],
    interests: ['Nature & Hiking', 'Literature & Books', 'Travel & Exploration', 'Business & Tech'],
    values: ['Continuous Growth', 'Faith & Spirituality', 'Integrity & Honesty'],
    relationshipGoal: 'Intentional marriage',
    lifestyle: {
      faith: 'Muslim',
      drinking: 'no',
      smoking: 'no',
      exercise: 'active',
      kids: 'open to kids'
    },
    isVerified: true,
    isVisible: true,
    createdAt: '2025-01-15T00:00:00.000Z',
    updatedAt: '2025-01-15T00:00:00.000Z'
  },
  {
    id: 'prof_zainab',
    userId: 'usr_zainab',
    displayName: 'Zainab',
    age: 30,
    gender: 'female',
    location: 'Victoria Island, Lagos',
    profession: 'Corporate Legal Counsel',
    education: 'LL.M. Commercial Law',
    bio: 'Passionate about intellectual property and arts advocacy. Seeking a partner grounded in mutual respect, clear communication, and shared faith.',
    photos: [
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800&auto=format&fit=crop&q=80'
    ],
    interests: ['Fine Art & Galleries', 'Literature & Books', 'Classical & Jazz Music'],
    values: ['Mutual Respect', 'Family-Centered', 'Integrity & Honesty', 'Faith & Spirituality'],
    relationshipGoal: 'Intentional courtship leading to marriage',
    lifestyle: {
      faith: 'Christian',
      drinking: 'socially',
      smoking: 'no',
      exercise: 'active',
      kids: 'wants kids'
    },
    isVerified: true,
    isVisible: true,
    createdAt: '2025-01-18T00:00:00.000Z',
    updatedAt: '2025-01-18T00:00:00.000Z'
  }
];

const DEFAULT_FILTERS: DiscoverFilters = {
  searchTerm: '',
  minAge: 21,
  maxAge: 45,
  location: 'All Locations',
  faith: 'All Faiths'
};

export const DiscoverScreen: React.FC = () => {
  const { currentProfile, preferences } = useAuth();

  const [profiles] = useState<Profile[]>(INITIAL_PROFILES);
  const [filters, setFilters] = useState<DiscoverFilters>(DEFAULT_FILTERS);
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);

  // Selected profile for full detail modal
  const [detailProfile, setDetailProfile] = useState<Profile | null>(null);

  // Sent interests state
  const [sentInterests, setSentInterests] = useState<Record<string, boolean>>({});
  const [requestLoading, setRequestLoading] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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
    setRequestLoading(profileId);
    sounds.playSend();
    setTimeout(() => {
      setRequestLoading(null);
      setSentInterests((prev) => ({ ...prev, [profileId]: true }));
      const target = profiles.find((p) => p.id === profileId);
      setToastMessage(`Connection request delivered to ${target?.displayName || 'candidate'}.`);
      setTimeout(() => setToastMessage(null), 3500);
    }, 600);
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
      {filteredProfiles.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-3xl border border-stone-200 p-6 space-y-3">
          <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center mx-auto text-stone-400">
            <Search className="w-5 h-5" />
          </div>
          <h3 className="font-serif font-bold text-base text-stone-800">
            No profiles match these filters
          </h3>
          <p className="text-xs text-stone-500 max-w-xs mx-auto">
            Try adjusting your age or location filters to see more verified members.
          </p>
          <button
            onClick={() => setFilters(DEFAULT_FILTERS)}
            className="text-xs font-semibold text-rose-900 underline cursor-pointer"
          >
            Reset All Filters
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredProfiles.map((p) => {
            const hasSent = !!sentInterests[p.id];
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
