import React, { useState } from 'react';
import {
  ShieldCheck,
  Eye,
  MapPin,
  Briefcase,
  GraduationCap,
  Heart,
  Settings,
  Smartphone,
  LogOut,
  Edit3,
  X,
  Check,
  Sparkles,
  Sliders,
  UserCheck,
  Camera
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../../context/AuthContext';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { uploadProfilePhoto } from '../../lib/profilePhoto';
import { MembershipPanel } from '../billing/MembershipPanel';

interface ProfileScreenProps {
  onOpenAdmin?: () => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ onOpenAdmin }) => {
  const { currentProfile, updateProfile, preferences, updatePreferences, logout, isAdmin } = useAuth();
  const { isInstallable, isInstalled, install } = usePWAInstall();

  // Modal / sheet states
  const [isEditingFull, setIsEditingFull] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isPrefsOpen, setIsPrefsOpen] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoProgress, setPhotoProgress] = useState(0);
  const [photoError, setPhotoError] = useState<string | null>(null);

  // Form states for full edit
  const [displayName, setDisplayName] = useState(currentProfile?.displayName || '');
  const [age, setAge] = useState(currentProfile?.age || 29);
  const [profession, setProfession] = useState(currentProfile?.profession || '');
  const [education, setEducation] = useState(currentProfile?.education || '');
  const [location, setLocation] = useState(currentProfile?.location || '');
  const [bio, setBio] = useState(currentProfile?.bio || '');
  const [relationshipGoal, setRelationshipGoal] = useState(currentProfile?.relationshipGoal || '');

  // Form state for preferences
  const [prefAgeMin, setPrefAgeMin] = useState(preferences?.ageMin || 24);
  const [prefAgeMax, setPrefAgeMax] = useState(preferences?.ageMax || 35);
  const [prefLocations, setPrefLocations] = useState(preferences?.preferredLocations.join(', ') || 'Lagos, Abuja');

  if (!currentProfile) {
    return (
      <div className="text-center py-12 text-stone-500 text-sm">
        No profile active.
      </div>
    );
  }

  const handleSaveFullProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile({
      displayName,
      age: Number(age),
      profession,
      education,
      location,
      bio,
      relationshipGoal
    });
    setIsEditingFull(false);
  };

  const handleSavePreferences = (e: React.FormEvent) => {
    e.preventDefault();
    updatePreferences({
      ageMin: Number(prefAgeMin),
      ageMax: Number(prefAgeMax),
      preferredLocations: prefLocations.split(',').map((s) => s.trim()).filter(Boolean)
    });
    setIsPrefsOpen(false);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold text-stone-900 tracking-tight">
            My Profile
          </h1>
          <p className="text-xs text-stone-500">
            Manage your personal presentation & matchmaking criteria
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPreviewOpen(true)}
            className="flex items-center gap-1 text-xs font-semibold text-rose-900 bg-rose-50 px-3 py-1.5 rounded-full border border-rose-200 hover:bg-rose-100 transition cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5" />
            Preview
          </button>
        </div>
      </div>

      {/* Main Profile Summary Card */}
      <div className="bg-white rounded-3xl p-5 border border-stone-200/90 shadow-sm space-y-4">
        <div className="flex items-center gap-4">
          <div className="relative">
            <img
              src={currentProfile.photos[0] || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80'}
              alt={currentProfile.displayName}
              className="w-20 h-20 rounded-2xl object-cover border-2 border-stone-200 shadow-xs"
            />
            <label className="absolute inset-0 rounded-2xl bg-black/0 hover:bg-black/25 transition flex items-end justify-center cursor-pointer">
              <span className="mb-1 px-1.5 py-0.5 rounded-full bg-white/90 text-[10px] font-semibold text-stone-800 flex items-center gap-1">
                <Camera className="w-3 h-3" />
                {photoBusy ? `${photoProgress}%` : 'Photo'}
              </span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={photoBusy}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (!file) return;
                  setPhotoError(null);
                  setPhotoBusy(true);
                  setPhotoProgress(0);
                  try {
                    const url = await uploadProfilePhoto(file, setPhotoProgress);
                    updateProfile({ photos: [url] });
                  } catch (err) {
                    setPhotoError(err instanceof Error ? err.message : 'Upload failed');
                  } finally {
                    setPhotoBusy(false);
                  }
                }}
              />
            </label>
            {currentProfile.isVerified && (
              <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center ring-2 ring-white">
                <ShieldCheck className="w-3.5 h-3.5" />
              </span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="font-serif text-xl font-bold text-stone-900 truncate">
                {currentProfile.displayName}, {currentProfile.age}
              </h2>
            </div>
            <p className="text-xs text-stone-600 flex items-center gap-1 mt-0.5">
              <Briefcase className="w-3 h-3 text-stone-400" />
              <span className="truncate">{currentProfile.profession}</span>
            </p>
            <p className="text-xs text-stone-500 flex items-center gap-1 mt-0.5">
              <MapPin className="w-3 h-3 text-stone-400" />
              <span>{currentProfile.location}</span>
            </p>
          </div>
        </div>

        {photoError && (
          <p className="text-[11px] text-rose-700">{photoError}</p>
        )}

        {/* Visibility Toggle */}
        <div className="flex items-center justify-between p-3 rounded-2xl bg-stone-50 border border-stone-200/70">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-stone-500" />
            <div>
              <p className="text-xs font-semibold text-stone-800">Profile Visibility</p>
              <p className="text-[11px] text-stone-500">
                {currentProfile.isVisible ? 'Visible to eligible matches' : 'Hidden from discovery pool'}
              </p>
            </div>
          </div>
          <button
            onClick={() => updateProfile({ isVisible: !currentProfile.isVisible })}
            className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
              currentProfile.isVisible ? 'bg-rose-900' : 'bg-stone-300'
            }`}
          >
            <span
              className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${
                currentProfile.isVisible ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Bio Section */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <p className="text-[11px] font-medium uppercase tracking-wider text-stone-400">
              About Me
            </p>
            <button
              onClick={() => setIsEditingFull(true)}
              className="text-xs font-semibold text-rose-900 hover:underline cursor-pointer flex items-center gap-1"
            >
              <Edit3 className="w-3 h-3" /> Edit Profile
            </button>
          </div>

          <p className="text-xs text-stone-700 leading-relaxed bg-[#FBF7F0]/60 p-3 rounded-2xl border border-stone-100">
            {currentProfile.bio}
          </p>
        </div>

        {/* Relationship Goal & Details */}
        <div className="space-y-2 pt-1 border-t border-stone-100 text-xs">
          <div className="flex items-center gap-2">
            <Heart className="w-4 h-4 text-rose-700" />
            <span className="font-semibold text-stone-900">Seeking:</span>
            <span className="text-stone-700">{currentProfile.relationshipGoal}</span>
          </div>
          <div className="flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-stone-400" />
            <span className="font-semibold text-stone-900">Education:</span>
            <span className="text-stone-700">{currentProfile.education}</span>
          </div>
        </div>
      </div>

      {/* Matchmaking Preferences Quick Card */}
      <div className="bg-white rounded-3xl p-5 border border-stone-200/90 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-serif font-bold text-base text-stone-900 flex items-center gap-2">
            <Sliders className="w-4 h-4 text-amber-700" />
            Matchmaking Preferences
          </h3>
          <button
            onClick={() => setIsPrefsOpen(true)}
            className="text-xs font-semibold text-rose-900 hover:underline cursor-pointer"
          >
            Adjust
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200/70">
            <span className="text-stone-400 text-[10px] uppercase font-bold block">Target Age</span>
            <span className="font-semibold text-stone-800">{preferences?.ageMin || 24} – {preferences?.ageMax || 35} years</span>
          </div>
          <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200/70">
            <span className="text-stone-400 text-[10px] uppercase font-bold block">Locations</span>
            <span className="font-semibold text-stone-800 truncate block">
              {preferences?.preferredLocations.join(', ') || 'Lagos, Nigeria'}
            </span>
          </div>
        </div>
      </div>

      <MembershipPanel />

      {isInstallable && !isInstalled && (
        <button
          onClick={install}
          className="w-full py-3 rounded-2xl bg-amber-400 hover:bg-amber-300 text-stone-950 font-semibold text-xs transition active:scale-98 cursor-pointer flex items-center justify-center gap-2 shadow-xs"
        >
          <Smartphone className="w-4 h-4" />
          <span>Add Lifebencher Match to Home Screen</span>
        </button>
      )}

      {isAdmin && onOpenAdmin && (
        <div className="pt-2">
          <button
            onClick={onOpenAdmin}
            className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-stone-900 to-stone-800 text-amber-200 border border-amber-400/30 font-semibold text-xs transition active:scale-98 flex items-center justify-between shadow-xs cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <span className="text-base">👑</span>
              <div className="text-left">
                <span className="font-bold text-white block">Concierge Admin Portal</span>
                <span className="text-[10px] text-amber-300/80">Client Verifications & Manual Introductions</span>
              </div>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400 text-stone-950 font-bold">
              Switch
            </span>
          </button>
        </div>
      )}

      {/* Account Logout Action */}
      <div className="pt-1">
        <button
          onClick={logout}
          className="w-full py-3 rounded-2xl border border-stone-300 text-stone-600 hover:text-stone-900 hover:bg-stone-50 font-medium text-xs transition active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Log Out of Lifebencher Match</span>
        </button>
      </div>

      {/* EDIT FULL PROFILE MODAL / BOTTOM SHEET */}
      <AnimatePresence>
        {isEditingFull && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="w-full max-w-sm max-h-[90vh] overflow-y-auto bg-[#FAF8F5] text-stone-900 rounded-3xl p-6 shadow-2xl border border-stone-200"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-serif font-bold text-xl text-stone-900">
                  Edit Profile
                </h3>
                <button
                  onClick={() => setIsEditingFull(false)}
                  className="w-8 h-8 rounded-full bg-stone-200 flex items-center justify-center text-stone-600 hover:text-stone-900 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveFullProfile} className="space-y-3.5 text-xs">
                <div>
                  <label className="font-semibold text-stone-700 block mb-1">Profile Photo</label>
                  <div className="flex items-center gap-3 p-2.5 rounded-xl bg-white border border-stone-300">
                    <img
                      src={currentProfile.photos[0] || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80'}
                      alt=""
                      className="w-14 h-14 rounded-xl object-cover border border-stone-200"
                    />
                    <div className="flex-1 min-w-0">
                      <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-900 text-amber-100 font-semibold cursor-pointer">
                        <Camera className="w-3 h-3" />
                        {photoBusy ? `Uploading ${photoProgress}%` : currentProfile.photos[0] ? 'Change Photo' : 'Upload Photo'}
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                          className="hidden"
                          disabled={photoBusy}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            e.target.value = '';
                            if (!file) return;
                            setPhotoError(null);
                            setPhotoBusy(true);
                            setPhotoProgress(0);
                            try {
                              const url = await uploadProfilePhoto(file, setPhotoProgress);
                              updateProfile({ photos: [url] });
                            } catch (err) {
                              setPhotoError(err instanceof Error ? err.message : 'Upload failed');
                            } finally {
                              setPhotoBusy(false);
                            }
                          }}
                        />
                      </label>
                      <p className="text-[10px] text-stone-500 mt-1">JPG, PNG or WebP. Max 5 MB.</p>
                      {photoError && <p className="text-[10px] text-rose-700 mt-0.5">{photoError}</p>}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-stone-700 block mb-1">Display Name</label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-white border border-stone-300"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-semibold text-stone-700 block mb-1">Age</label>
                    <input
                      type="number"
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
                      className="w-full p-2.5 rounded-xl bg-white border border-stone-300"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-stone-700 block mb-1">Profession</label>
                  <input
                    type="text"
                    value={profession}
                    onChange={(e) => setProfession(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-white border border-stone-300"
                  />
                </div>

                <div>
                  <label className="font-semibold text-stone-700 block mb-1">Education</label>
                  <input
                    type="text"
                    value={education}
                    onChange={(e) => setEducation(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-white border border-stone-300"
                  />
                </div>

                <div>
                  <label className="font-semibold text-stone-700 block mb-1">Relationship Goal</label>
                  <input
                    type="text"
                    value={relationshipGoal}
                    onChange={(e) => setRelationshipGoal(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-white border border-stone-300"
                  />
                </div>

                <div>
                  <label className="font-semibold text-stone-700 block mb-1">About Me / Bio</label>
                  <textarea
                    rows={3}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-white border border-stone-300"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 rounded-2xl bg-rose-900 text-amber-100 font-semibold shadow-md hover:bg-rose-950 transition cursor-pointer"
                >
                  Save Profile Changes
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ADJUST PREFERENCES MODAL */}
      <AnimatePresence>
        {isPrefsOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="w-full max-w-sm bg-[#FAF8F5] text-stone-900 rounded-3xl p-6 shadow-2xl border border-stone-200"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-serif font-bold text-xl text-stone-900">
                  Match Preferences
                </h3>
                <button
                  onClick={() => setIsPrefsOpen(false)}
                  className="w-8 h-8 rounded-full bg-stone-200 flex items-center justify-center text-stone-600 hover:text-stone-900 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSavePreferences} className="space-y-4 text-xs">
                <div>
                  <label className="font-semibold text-stone-700 block mb-1">
                    Target Age Range ({prefAgeMin} - {prefAgeMax} years)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={21}
                      max={60}
                      value={prefAgeMin}
                      onChange={(e) => setPrefAgeMin(Number(e.target.value))}
                      className="w-full accent-rose-900"
                    />
                    <input
                      type="range"
                      min={21}
                      max={65}
                      value={prefAgeMax}
                      onChange={(e) => setPrefAgeMax(Number(e.target.value))}
                      className="w-full accent-rose-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-stone-700 block mb-1">
                    Preferred Locations (Comma-separated)
                  </label>
                  <input
                    type="text"
                    value={prefLocations}
                    onChange={(e) => setPrefLocations(e.target.value)}
                    placeholder="e.g. Lagos, Abuja, London"
                    className="w-full p-2.5 rounded-xl bg-white border border-stone-300"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 rounded-2xl bg-rose-900 text-amber-100 font-semibold shadow-md hover:bg-rose-950 transition cursor-pointer"
                >
                  Update Preferences
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* FULL CARD PREVIEW MODAL */}
      <AnimatePresence>
        {isPreviewOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm max-h-[85vh] overflow-y-auto bg-white rounded-3xl overflow-hidden shadow-2xl border border-stone-200 relative"
            >
              <button
                onClick={() => setIsPreviewOpen(false)}
                className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="relative aspect-4/5 w-full bg-stone-200">
                <img
                  src={currentProfile.photos[0]}
                  alt={currentProfile.displayName}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <div className="absolute bottom-4 left-4 right-4 text-white">
                  <h3 className="font-serif text-2xl font-bold">
                    {currentProfile.displayName}, {currentProfile.age}
                  </h3>
                  <p className="text-xs text-stone-200 mt-1">
                    {currentProfile.profession} · {currentProfile.location}
                  </p>
                </div>
              </div>

              <div className="p-5 space-y-3 text-xs text-stone-700">
                <div className="p-2.5 rounded-xl bg-amber-50 text-amber-900 border border-amber-200">
                  <span className="font-semibold block">Public View Confirmation</span>
                  This is exactly how eligible candidates experience your profile on Discover.
                </div>
                <p className="leading-relaxed">{currentProfile.bio}</p>
                <div className="pt-2 border-t border-stone-100 flex items-center gap-1.5 font-medium text-stone-900">
                  <Heart className="w-4 h-4 text-rose-700" />
                  <span>Seeking: {currentProfile.relationshipGoal}</span>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
