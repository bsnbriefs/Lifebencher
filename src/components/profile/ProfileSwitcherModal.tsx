import React, { useState } from 'react';
import {
  X,
  UserPlus,
  ShieldCheck,
  Check,
  Sparkles,
  ArrowRight,
  Upload,
  RefreshCw,
  Heart
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Profile, Gender } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { resolveDisplayName, sanitizeDisplayName } from '../../lib/userNames';

interface ProfileSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PRESET_AVATARS = [
  {
    url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&auto=format&fit=crop&q=80',
    label: 'Man 1'
  },
  {
    url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800&auto=format&fit=crop&q=80',
    label: 'Man 2'
  },
  {
    url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop&q=80',
    label: 'Woman 1'
  },
  {
    url: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=800&auto=format&fit=crop&q=80',
    label: 'Woman 2'
  },
  {
    url: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=800&auto=format&fit=crop&q=80',
    label: 'Woman 3'
  },
  {
    url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&auto=format&fit=crop&q=80',
    label: 'Woman 4'
  }
];

export const ProfileSwitcherModal: React.FC<ProfileSwitcherModalProps> = ({ isOpen, onClose }) => {
  const {
    allProfiles,
    currentProfile,
    switchProfile,
    createProfile,
    resetCohort,
    incomingRequestsCount
  } = useAuth();

  const [isCreatingNew, setIsCreatingNew] = useState(false);

  // Form fields for creating a new real profile
  const [displayName, setDisplayName] = useState('');
  const [age, setAge] = useState(29);
  const [gender, setGender] = useState<Gender>('female');
  const [location, setLocation] = useState('Lagos, Nigeria');
  const [profession, setProfession] = useState('');
  const [education, setEducation] = useState('');
  const [bio, setBio] = useState('');
  const [relationshipGoal, setRelationshipGoal] = useState('Intentional courtship leading to marriage');
  const [faith, setFaith] = useState('Christian');
  const [selectedPhoto, setSelectedPhoto] = useState(PRESET_AVATARS[2].url);
  const [customPhotoUrl, setCustomPhotoUrl] = useState('');
  const [interestsText, setInterestsText] = useState('Reading, Architecture, Travel, Fine Art');
  const [valuesText, setValuesText] = useState('Faith & Family, Integrity, Mutual Growth');

  if (!isOpen) return null;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim() || !profession.trim()) return;

    const photoToUse = customPhotoUrl.trim() || selectedPhoto;

    createProfile({
      displayName: sanitizeDisplayName(displayName.trim()),
      age: Number(age),
      gender,
      location: location.trim(),
      profession: profession.trim(),
      education: education.trim() || 'B.Sc. Degree',
      bio: bio.trim() || 'Intentional professional seeking a meaningful, values-aligned life partner.',
      photos: [photoToUse],
      interests: interestsText.split(',').map((s) => s.trim()).filter(Boolean),
      values: valuesText.split(',').map((s) => s.trim()).filter(Boolean),
      relationshipGoal: relationshipGoal.trim(),
      lifestyle: { faith },
      isVerified: true,
      isVisible: true
    });

    setIsCreatingNew(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/65 backdrop-blur-xs p-4">
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
        className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-[#FAF8F5] text-stone-900 rounded-3xl p-5 shadow-2xl border border-stone-200 space-y-4"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-200">
          <div>
            <div className="flex items-center gap-1.5 text-xs text-rose-900 font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>Real Profile Switcher & Creator</span>
            </div>
            <h2 className="font-serif font-bold text-xl text-stone-900">
              {isCreatingNew ? 'Create New Real Profile' : 'Switch Active Profile'}
            </h2>
          </div>
          <button
            onClick={() => {
              setIsCreatingNew(false);
              onClose();
            }}
            className="w-8 h-8 rounded-full bg-stone-200/80 hover:bg-stone-300 flex items-center justify-center text-stone-600 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {!isCreatingNew ? (
          /* LIST OF REAL PROFILES */
          <div className="space-y-3">
            <p className="text-xs text-stone-600 leading-relaxed">
              Test both sides of any match! Switch personas below to experience discovering, sending interest, receiving requests, and chatting in real time:
            </p>

            <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
              {allProfiles.map((p) => {
                const isCurrent = p.id === currentProfile?.id;
                const pendingCount = incomingRequestsCount(p.userId);

                return (
                  <div
                    key={p.id}
                    onClick={() => {
                      switchProfile(p.id);
                      onClose();
                    }}
                    className={`p-3 rounded-2xl border transition cursor-pointer flex items-center justify-between ${
                      isCurrent
                        ? 'bg-rose-50 border-rose-900 ring-1 ring-rose-900 shadow-2xs'
                        : 'bg-white border-stone-200 hover:border-stone-300'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative">
                        <img
                          src={p.photos[0]}
                          alt={resolveDisplayName(p)}
                          className="w-12 h-12 rounded-xl object-cover border border-stone-200 shrink-0"
                        />
                        {p.isVerified && (
                          <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">
                            <ShieldCheck className="w-3 h-3" />
                          </span>
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-serif font-bold text-sm text-stone-900 truncate">
                            {resolveDisplayName(p)}, {p.age}
                          </span>
                          <span className="text-[10px] text-stone-400 capitalize">
                            ({p.gender})
                          </span>
                        </div>
                        <p className="text-[11px] text-stone-600 truncate">
                          {p.profession} · {p.location.split(',')[0]}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {pendingCount > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-bold animate-pulse flex items-center gap-1">
                          <Heart className="w-2.5 h-2.5 fill-white" />
                          <span>{pendingCount} req</span>
                        </span>
                      )}

                      {isCurrent ? (
                        <span className="px-2.5 py-1 rounded-full bg-rose-900 text-amber-200 text-[10px] font-bold flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          <span>Active</span>
                        </span>
                      ) : (
                        <span className="text-[11px] font-semibold text-rose-900 flex items-center gap-0.5">
                          <span>Switch</span>
                          <ArrowRight className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Actions: Add New Profile or Reset Cohort */}
            <div className="pt-2 flex items-center gap-2">
              <button
                onClick={() => setIsCreatingNew(true)}
                className="flex-1 py-3 px-4 rounded-2xl bg-rose-900 text-amber-100 font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs hover:bg-rose-950 transition cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>+ Create Real Profile</span>
              </button>

              <button
                onClick={() => {
                  resetCohort();
                  onClose();
                }}
                title="Reset to default verified cohort"
                className="p-3 rounded-2xl border border-stone-300 text-stone-600 hover:text-stone-900 hover:bg-stone-100 transition cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          /* FORM TO CREATE NEW REAL PROFILE */
          <form onSubmit={handleCreate} className="space-y-3.5 text-xs">
            <p className="text-stone-500 text-[11px]">
              Add your real personal information or a prospective candidate to test the entire matchmaking flow:
            </p>

            {/* Photo Selection */}
            <div>
              <label className="font-semibold text-stone-700 block mb-1.5">
                Choose Profile Photo
              </label>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {PRESET_AVATARS.map((avatar, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setSelectedPhoto(avatar.url);
                      setCustomPhotoUrl('');
                    }}
                    className={`relative shrink-0 w-12 h-12 rounded-xl overflow-hidden border-2 transition cursor-pointer ${
                      selectedPhoto === avatar.url && !customPhotoUrl
                        ? 'border-rose-900 ring-2 ring-rose-900/30'
                        : 'border-stone-200'
                    }`}
                  >
                    <img src={avatar.url} alt={avatar.label} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
              <div className="mt-2">
                <input
                  type="url"
                  value={customPhotoUrl}
                  onChange={(e) => setCustomPhotoUrl(e.target.value)}
                  placeholder="Or paste an image URL (Unsplash, LinkedIn, etc.)"
                  className="w-full p-2 rounded-xl bg-white border border-stone-300 text-stone-800 text-[11px]"
                />
              </div>
            </div>

            {/* Full Name & Gender */}
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className="font-semibold text-stone-700 block mb-1">Full / Display Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Tolulope, Ifeoma, Emeka"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-white border border-stone-300"
                />
              </div>
              <div>
                <label className="font-semibold text-stone-700 block mb-1">Gender</label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value as Gender)}
                  className="w-full p-2.5 rounded-xl bg-white border border-stone-300"
                >
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                  <option value="non-binary">Non-binary</option>
                </select>
              </div>
            </div>

            {/* Age & Location */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-semibold text-stone-700 block mb-1">Age</label>
                <input
                  type="number"
                  min={18}
                  max={99}
                  value={age}
                  onChange={(e) => setAge(Number(e.target.value))}
                  className="w-full p-2.5 rounded-xl bg-white border border-stone-300"
                />
              </div>
              <div>
                <label className="font-semibold text-stone-700 block mb-1">Location</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="City, Country"
                  className="w-full p-2.5 rounded-xl bg-white border border-stone-300"
                />
              </div>
            </div>

            {/* Profession & Education */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-semibold text-stone-700 block mb-1">Profession</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Corporate Lawyer"
                  value={profession}
                  onChange={(e) => setProfession(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-white border border-stone-300"
                />
              </div>
              <div>
                <label className="font-semibold text-stone-700 block mb-1">Education</label>
                <input
                  type="text"
                  placeholder="e.g. LL.M. Commercial Law"
                  value={education}
                  onChange={(e) => setEducation(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-white border border-stone-300"
                />
              </div>
            </div>

            {/* Relationship Goal & Faith */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-semibold text-stone-700 block mb-1">Relationship Goal</label>
                <input
                  type="text"
                  value={relationshipGoal}
                  onChange={(e) => setRelationshipGoal(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-white border border-stone-300 text-[11px]"
                />
              </div>
              <div>
                <label className="font-semibold text-stone-700 block mb-1">Faith / Values</label>
                <input
                  type="text"
                  value={faith}
                  onChange={(e) => setFaith(e.target.value)}
                  placeholder="Christian, Muslim, etc."
                  className="w-full p-2.5 rounded-xl bg-white border border-stone-300 text-[11px]"
                />
              </div>
            </div>

            {/* Bio */}
            <div>
              <label className="font-semibold text-stone-700 block mb-1">Biography / About</label>
              <textarea
                rows={2}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Share your background, passions, and vision for marriage..."
                className="w-full p-2.5 rounded-xl bg-white border border-stone-300 text-[11px]"
              />
            </div>

            {/* Buttons */}
            <div className="pt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsCreatingNew(false)}
                className="flex-1 py-3 rounded-2xl border border-stone-300 text-stone-700 font-semibold cursor-pointer"
              >
                Back to Profiles
              </button>
              <button
                type="submit"
                className="flex-1 py-3 rounded-2xl bg-rose-900 text-amber-100 font-bold shadow-md hover:bg-rose-950 transition cursor-pointer"
              >
                Save & Switch to Profile
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
};

export default ProfileSwitcherModal;
