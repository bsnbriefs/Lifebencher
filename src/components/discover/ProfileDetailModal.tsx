import React, { useEffect, useState } from 'react';
import {
  X,
  Heart,
  ShieldCheck,
  MapPin,
  Briefcase,
  GraduationCap,
  Sparkles,
  CheckCircle2,
  Share2,
  Calendar
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Profile } from '../../types';
import { CompatibilityResult } from '../../lib/compatibility';

interface ProfileDetailModalProps {
  profile: Profile | null;
  compatibility?: CompatibilityResult | null;
  hasSentInterest?: boolean;
  isLoading?: boolean;
  onClose: () => void;
  onExploreMatch: (profileId: string) => void;
}

export const ProfileDetailModal: React.FC<ProfileDetailModalProps> = ({
  profile,
  compatibility,
  hasSentInterest,
  isLoading,
  onClose,
  onExploreMatch
}) => {
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);
  const [aiExplain, setAiExplain] = useState<{ explanation: string; starters: string[] } | null>(null);

  useEffect(() => {
    setActivePhotoIdx(0);
    setAiExplain(null);
  }, [profile?.id]);

  useEffect(() => {
    if (!profile || !compatibility) return;
    void import('../../lib/aiClient').then(({ explainMatch }) =>
      explainMatch({
        score: compatibility.score,
        summary: compatibility.summary,
        me: { relationshipGoal: 'as on your profile' },
        them: {
          displayName: profile.displayName,
          profession: profile.profession,
          location: profile.location,
          values: profile.values,
          interests: profile.interests,
          relationshipGoal: profile.relationshipGoal,
          lifestyle: profile.lifestyle
        }
      })
        .then(setAiExplain)
        .catch(() => undefined)
    );
  }, [profile, compatibility]);

  useEffect(() => {
    if (!profile || profile.photos.length < 2) return;
    const id = window.setInterval(() => {
      setActivePhotoIdx((i) => (i + 1) % profile.photos.length);
    }, 3500);
    return () => window.clearInterval(id);
  }, [profile]);

  if (!profile) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-3 sm:p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: 'spring', damping: 26, stiffness: 300 }}
          className="w-full max-w-md max-h-[92vh] overflow-y-auto bg-[#FAF8F5] text-stone-900 rounded-3xl shadow-2xl border border-stone-200 relative flex flex-col"
        >
          {/* Close Button Top Right */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-30 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 backdrop-blur-xs transition cursor-pointer"
            aria-label="Close details"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Photo Gallery Header */}
          <div className="relative aspect-4/5 w-full bg-stone-200 overflow-hidden shrink-0">
            <img
              src={profile.photos[activePhotoIdx] || profile.photos[0]}
              alt={profile.displayName}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-stone-950/85 via-stone-950/20 to-transparent pointer-events-none" />

            {/* Photo indicators if multiple */}
            {profile.photos.length > 1 && (
              <div className="absolute top-4 left-4 z-20 flex gap-1">
                {profile.photos.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setActivePhotoIdx(i)}
                    className={`w-6 h-1.5 rounded-full transition-all cursor-pointer ${
                      i === activePhotoIdx ? 'bg-amber-300' : 'bg-white/40'
                    }`}
                  />
                ))}
              </div>
            )}

            {/* Header Details Overlay */}
            <div className="absolute bottom-4 left-4 right-4 text-white z-20">
              <div className="flex items-center gap-2">
                <h2 className="font-serif text-2xl font-bold tracking-tight">
                  {profile.displayName}, {profile.age}
                </h2>
                {profile.isVerified && (
                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs shadow-xs">
                    <ShieldCheck className="w-3.5 h-3.5" />
                  </span>
                )}
              </div>

              <p className="text-xs text-stone-200 flex items-center gap-1.5 mt-1">
                <Briefcase className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                <span>{profile.profession}</span>
              </p>
              <p className="text-xs text-stone-300 flex items-center gap-1.5 mt-0.5">
                <MapPin className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                <span>{profile.location}</span>
              </p>
            </div>
          </div>

          {/* Body Content */}
          <div className="p-5 space-y-4">
            {/* Compatibility Insight Card */}
            {compatibility && (
              <div className="p-4 rounded-2xl bg-gradient-to-br from-rose-900 to-rose-950 text-white shadow-sm space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-amber-300 font-bold text-xs">
                    <Sparkles className="w-4 h-4" />
                    <span>Compatibility Index</span>
                  </div>
                  <span className="font-serif text-xl font-bold text-amber-300">
                    {compatibility.score}%
                  </span>
                </div>
                <p className="text-xs text-rose-100 leading-relaxed">
                  {aiExplain?.explanation || compatibility.summary}
                </p>
                {aiExplain?.starters?.length ? (
                  <ul className="text-[11px] text-amber-100/90 space-y-1 pt-1">
                    {aiExplain.starters.map((s) => (
                      <li key={s}>“{s}”</li>
                    ))}
                  </ul>
                ) : null}

                {/* Compatibility Breakdown Indicators */}
                <div className="pt-2 border-t border-rose-800/80 grid grid-cols-2 gap-2 text-[11px] text-rose-200">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Goal: Compatible</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{compatibility.breakdown.valuesSharedCount} Shared Values</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Lifestyle: Balanced</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Location: Matched</span>
                  </div>
                </div>
              </div>
            )}

            {/* About / Bio */}
            <div className="bg-white p-4 rounded-2xl border border-stone-200 space-y-1.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400">
                Personal Background & Ethos
              </h3>
              <p className="text-xs text-stone-800 leading-relaxed italic">
                "{profile.bio}"
              </p>
            </div>

            {/* Seeking Relationship Goal */}
            <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200/80 flex items-start gap-2.5">
              <Heart className="w-4 h-4 text-rose-800 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-xs text-stone-900 block">
                  Relationship Goal:
                </span>
                <span className="text-xs text-stone-700">
                  {profile.relationshipGoal}
                </span>
              </div>
            </div>

            {/* Lifestyle Grid */}
            <div className="bg-white p-4 rounded-2xl border border-stone-200 space-y-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400">
                Lifestyle & Habits
              </h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {profile.lifestyle?.faith && (
                  <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-150">
                    <span className="text-stone-400 text-[10px] uppercase font-bold block">Faith</span>
                    <span className="font-semibold text-stone-800">{profile.lifestyle.faith}</span>
                  </div>
                )}
                {profile.lifestyle?.kids && (
                  <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-150">
                    <span className="text-stone-400 text-[10px] uppercase font-bold block">Family</span>
                    <span className="font-semibold text-stone-800 capitalize">{profile.lifestyle.kids}</span>
                  </div>
                )}
                {profile.lifestyle?.drinking && (
                  <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-150">
                    <span className="text-stone-400 text-[10px] uppercase font-bold block">Drinking</span>
                    <span className="font-semibold text-stone-800 capitalize">{profile.lifestyle.drinking}</span>
                  </div>
                )}
                {profile.lifestyle?.exercise && (
                  <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-150">
                    <span className="text-stone-400 text-[10px] uppercase font-bold block">Exercise</span>
                    <span className="font-semibold text-stone-800 capitalize">{profile.lifestyle.exercise}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Values */}
            {profile.values && profile.values.length > 0 && (
              <div className="space-y-1.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400">
                  Core Values
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {profile.values.map((v) => (
                    <span
                      key={v}
                      className="px-3 py-1 rounded-xl bg-rose-50 text-rose-950 border border-rose-200 text-xs font-medium"
                    >
                      {v}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Interests */}
            {profile.interests && profile.interests.length > 0 && (
              <div className="space-y-1.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400">
                  Interests & Passions
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {profile.interests.map((i) => (
                    <span
                      key={i}
                      className="px-3 py-1 rounded-xl bg-amber-50 text-amber-900 border border-amber-200 text-xs font-medium"
                    >
                      {i}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sticky Bottom Action Bar */}
          <div className="p-4 bg-white border-t border-stone-200 sticky bottom-0 z-30 flex items-center gap-3">
            <button
              onClick={onClose}
              className="py-3 px-4 rounded-2xl border border-stone-300 text-stone-700 font-semibold text-xs hover:bg-stone-50 transition cursor-pointer"
            >
              Back
            </button>

            <button
              onClick={() => onExploreMatch(profile.id)}
              disabled={hasSentInterest || isLoading}
              className={`flex-1 py-3 px-4 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 shadow-md transition active:scale-98 cursor-pointer ${
                hasSentInterest
                  ? 'bg-emerald-600 text-white cursor-default'
                  : 'bg-gradient-to-r from-rose-900 via-rose-800 to-amber-700 text-white hover:opacity-95'
              }`}
            >
              {isLoading ? (
                <span>Sending Connection...</span>
              ) : hasSentInterest ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                  <span>Interest Sent · Awaiting Response</span>
                </>
              ) : (
                <>
                  <Heart className="w-4 h-4 fill-white/30" />
                  <span>❤️ Explore Match with {profile.displayName}</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
