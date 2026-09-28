import React, { useState } from 'react';
import {
  ShieldCheck,
  Eye,
  MapPin,
  Briefcase,
  GraduationCap,
  Heart,
  Sliders,
  UserCheck,
  Download,
  Copy,
  Terminal,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  Users,
  Smartphone,
  LogOut,
  Edit3,
  X,
  Check,
  Sparkles,
  Code2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../../context/AuthContext';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { downloadProjectZip } from '../../lib/downloadZip';
import { ProfileSwitcherModal } from '../profile/ProfileSwitcherModal';
import { resolveDisplayName, sanitizeDisplayName } from '../../lib/userNames';

interface ProfileScreenProps {
  onOpenAdmin?: () => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ onOpenAdmin }) => {
  const { currentProfile, updateProfile, preferences, updatePreferences, logout } = useAuth();
  const { isInstallable, isInstalled, install } = usePWAInstall();

  // Modal / sheet states
  const [isEditingFull, setIsEditingFull] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isPrefsOpen, setIsPrefsOpen] = useState(false);
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);
  const [isHandoffOpen, setIsHandoffOpen] = useState(false);
  const [isDevToolsOpen, setIsDevToolsOpen] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2500);
  };

  // Form states for full edit
  const [displayName, setDisplayName] = useState(currentProfile?.displayName || '');
  const [phone, setPhone] = useState(currentProfile?.phone || '');
  const [whatsapp, setWhatsapp] = useState(currentProfile?.whatsapp || currentProfile?.phone || '');
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
      <div className="text-center py-16 text-stone-500 text-sm">
        No active profile loaded.
      </div>
    );
  }

  const handleSaveFullProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile({
      displayName: sanitizeDisplayName(displayName),
      phone: phone.trim(),
      whatsapp: whatsapp.trim() || phone.trim(),
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
    <div className="space-y-4 max-w-md mx-auto pb-6">
      {/* Top Bar Header */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <h1 className="font-serif text-2xl font-bold text-stone-900 tracking-tight">
            My Profile
          </h1>
          <p className="text-xs text-stone-500">
            Personal presentation & matchmaking criteria
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setIsPreviewOpen(true)}
            className="flex items-center gap-1 text-xs font-medium text-stone-700 bg-white px-3 py-1.5 rounded-full border border-stone-200 hover:bg-stone-50 transition cursor-pointer shadow-2xs"
            title="Preview how matches see your card"
          >
            <Eye className="w-3.5 h-3.5 text-stone-500" />
            <span>Preview</span>
          </button>
          <button
            onClick={() => setIsSwitcherOpen(true)}
            className="flex items-center gap-1 text-xs font-semibold text-rose-900 bg-rose-50 px-3 py-1.5 rounded-full border border-rose-200/80 hover:bg-rose-100 transition cursor-pointer"
            title="Switch or create profile"
          >
            <Sparkles className="w-3.5 h-3.5 text-rose-800" />
            <span>Switch</span>
          </button>
        </div>
      </div>

      {/* Primary Identity Card */}
      <div className="bg-white rounded-3xl p-5 border border-stone-200/90 shadow-2xs space-y-4">
        <div className="flex items-start gap-4">
          <div className="relative shrink-0">
            <img
              src={currentProfile.photos[0]}
              alt={resolveDisplayName(currentProfile)}
              className="w-18 h-18 rounded-2xl object-cover border border-stone-200 shadow-2xs"
            />
            {currentProfile.isVerified && (
              <span
                className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center ring-2 ring-white"
                title="Verified Matrimonial Candidate"
              >
                <ShieldCheck className="w-3 h-3" />
              </span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-xl font-bold text-stone-900 truncate">
                {resolveDisplayName(currentProfile)}, {currentProfile.age}
              </h2>
              <button
                onClick={() => setIsEditingFull(true)}
                className="text-xs font-semibold text-rose-900 hover:text-rose-950 flex items-center gap-1 p-1 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit</span>
              </button>
            </div>

            <p className="text-xs text-stone-600 truncate mt-0.5">
              {currentProfile.profession}
            </p>
            <p className="text-xs text-stone-500 flex items-center gap-1 mt-0.5">
              <MapPin className="w-3 h-3 text-stone-400 shrink-0" />
              <span className="truncate">{currentProfile.location}</span>
            </p>
          </div>
        </div>

        {/* Bio */}
        <div className="pt-2 border-t border-stone-100">
          <p className="text-xs text-stone-700 leading-relaxed font-normal">
            {currentProfile.bio}
          </p>
        </div>

        {/* Seeking & Education */}
        <div className="pt-2 border-t border-stone-100 space-y-1.5 text-xs">
          <div className="flex items-center gap-2 text-stone-700">
            <Heart className="w-3.5 h-3.5 text-rose-700 shrink-0" />
            <span className="text-stone-500 font-medium">Seeking:</span>
            <span className="font-semibold text-stone-900 truncate">{currentProfile.relationshipGoal}</span>
          </div>
          <div className="flex items-center gap-2 text-stone-700">
            <GraduationCap className="w-3.5 h-3.5 text-stone-400 shrink-0" />
            <span className="text-stone-500 font-medium">Education:</span>
            <span className="text-stone-800 truncate">{currentProfile.education}</span>
          </div>
        </div>

        {/* Visibility Toggle */}
        <div className="pt-2 border-t border-stone-100 flex items-center justify-between">
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
            className={`w-10 h-6 rounded-full transition-colors relative cursor-pointer ${
              currentProfile.isVisible ? 'bg-rose-900' : 'bg-stone-300'
            }`}
            aria-label="Toggle profile visibility"
          >
            <span
              className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${
                currentProfile.isVisible ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Matchmaking Preferences Row */}
      <div className="bg-white rounded-3xl border border-stone-200/90 shadow-2xs overflow-hidden">
        <button
          onClick={() => setIsPrefsOpen(true)}
          className="w-full p-4 flex items-center justify-between hover:bg-stone-50/60 transition cursor-pointer text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200/60 flex items-center justify-center text-amber-800 shrink-0">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <span className="font-semibold text-xs text-stone-900 block">Matchmaking Preferences</span>
              <span className="text-[11px] text-stone-500">
                Age {preferences?.ageMin || 24}–{preferences?.ageMax || 35} · {preferences?.preferredLocations.join(', ') || 'Lagos, Nigeria'}
              </span>
            </div>
          </div>
          <span className="text-xs font-semibold text-rose-900 flex items-center gap-0.5">
            Adjust <ChevronRight className="w-3.5 h-3.5" />
          </span>
        </button>
      </div>

      {/* Account & App Experience Group */}
      <div className="bg-white rounded-3xl border border-stone-200/90 shadow-2xs divide-y divide-stone-100 overflow-hidden text-xs">
        {/* Switch Persona */}
        <button
          onClick={() => setIsSwitcherOpen(true)}
          className="w-full p-3.5 flex items-center justify-between hover:bg-stone-50 transition cursor-pointer text-left"
        >
          <div className="flex items-center gap-2.5">
            <Users className="w-4 h-4 text-stone-500" />
            <div>
              <span className="font-medium text-stone-800 block">Switch / Add Real Profiles</span>
              <span className="text-[11px] text-stone-400">Current: {currentProfile.displayName}</span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-stone-400" />
        </button>

        {/* PWA / Mobile installation if installable */}
        {isInstallable && !isInstalled && (
          <button
            onClick={install}
            className="w-full p-3.5 flex items-center justify-between hover:bg-amber-50/40 transition cursor-pointer text-left"
          >
            <div className="flex items-center gap-2.5">
              <Smartphone className="w-4 h-4 text-amber-700" />
              <div>
                <span className="font-semibold text-stone-900 block">Install to Home Screen</span>
                <span className="text-[11px] text-stone-500">Launch directly as a native mobile app</span>
              </div>
            </div>
            <span className="text-[11px] font-bold text-amber-900 bg-amber-100 px-2.5 py-1 rounded-full border border-amber-200">
              Install
            </span>
          </button>
        )}

        {isInstalled && (
          <div className="p-3.5 flex items-center gap-2.5 text-emerald-800">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span className="font-medium text-[11px]">Installed as Mobile App</span>
          </div>
        )}

        {/* Log Out */}
        <button
          onClick={logout}
          className="w-full p-3.5 flex items-center justify-between text-stone-600 hover:text-stone-900 hover:bg-stone-50 transition cursor-pointer text-left"
        >
          <div className="flex items-center gap-2.5">
            <LogOut className="w-4 h-4 text-stone-400" />
            <span className="font-medium">Log Out</span>
          </div>
        </button>
      </div>

      {/* Discreet Platform, Developer & Handoff Tools */}
      <div className="bg-white rounded-3xl border border-stone-200/90 shadow-2xs overflow-hidden">
        <button
          onClick={() => setIsDevToolsOpen(!isDevToolsOpen)}
          className="w-full p-3.5 flex items-center justify-between hover:bg-stone-50 transition cursor-pointer text-left"
        >
          <div className="flex items-center gap-2.5">
            <Code2 className="w-4 h-4 text-stone-400" />
            <div>
              <span className="text-xs font-medium text-stone-700 block">Platform & Deployment Tools</span>
              <span className="text-[10px] text-stone-400">Codebase export, GitHub deployment & Concierge</span>
            </div>
          </div>
          <ChevronDown
            className={`w-4 h-4 text-stone-400 transition-transform duration-200 ${
              isDevToolsOpen ? 'rotate-180' : ''
            }`}
          />
        </button>

        <AnimatePresence>
          {isDevToolsOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="divide-y divide-stone-100 border-t border-stone-100 bg-stone-50/50 text-xs"
            >
              {/* Export ZIP */}
              <button
                onClick={downloadProjectZip}
                className="w-full p-3 flex items-center justify-between hover:bg-white transition cursor-pointer text-left"
              >
                <div className="flex items-center gap-2.5">
                  <Download className="w-4 h-4 text-rose-800" />
                  <div>
                    <span className="font-semibold text-stone-800 block">Download Project ZIP</span>
                    <span className="text-[10px] text-stone-500">Self-contained production archive (84 KB)</span>
                  </div>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-stone-200 text-stone-800 font-semibold">
                  ZIP
                </span>
              </button>

              {/* GitHub Guide Modal Trigger */}
              <button
                onClick={() => setIsHandoffOpen(true)}
                className="w-full p-3 flex items-center justify-between hover:bg-white transition cursor-pointer text-left"
              >
                <div className="flex items-center gap-2.5">
                  <Terminal className="w-4 h-4 text-stone-700" />
                  <div>
                    <span className="font-semibold text-stone-800 block">GitHub & Vercel Guide</span>
                    <span className="text-[10px] text-stone-500">Terminal commands & AI handoff prompt</span>
                  </div>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-stone-900 text-white font-semibold">
                  Guide
                </span>
              </button>

              {/* Admin Concierge Portal */}
              {onOpenAdmin && (
                <button
                  onClick={onOpenAdmin}
                  className="w-full p-3 flex items-center justify-between hover:bg-white transition cursor-pointer text-left"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-sm">👑</span>
                    <div>
                      <span className="font-semibold text-stone-800 block">Concierge Admin Portal</span>
                      <span className="text-[10px] text-stone-500">Client verifications & manual matchmaking</span>
                    </div>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-semibold border border-amber-200">
                    Open
                  </span>
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
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
                  <label className="font-semibold text-stone-700 block mb-1">Display Name</label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Your official or chosen name"
                    className="w-full p-2.5 rounded-xl bg-white border border-stone-300"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-semibold text-stone-700 block mb-1">Phone Number</label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+234 803 000 0000"
                      className="w-full p-2.5 rounded-xl bg-white border border-stone-300"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-stone-700 block mb-1">WhatsApp (Optional)</label>
                    <input
                      type="text"
                      value={whatsapp}
                      onChange={(e) => setWhatsapp(e.target.value)}
                      placeholder="+234 803 000 0000"
                      className="w-full p-2.5 rounded-xl bg-white border border-stone-300"
                    />
                  </div>
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
                  alt={resolveDisplayName(currentProfile)}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <div className="absolute bottom-4 left-4 right-4 text-white">
                  <h3 className="font-serif text-2xl font-bold">
                    {resolveDisplayName(currentProfile)}, {currentProfile.age}
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

      {/* Profile Switcher Modal */}
      <ProfileSwitcherModal
        isOpen={isSwitcherOpen}
        onClose={() => setIsSwitcherOpen(false)}
      />

      {/* GitHub, Vercel & Grok AI Handoff Modal */}
      <AnimatePresence>
        {isHandoffOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-white rounded-3xl p-5 shadow-2xl border border-stone-200 max-h-[90vh] overflow-y-auto space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                <div>
                  <h3 className="font-serif text-lg font-bold text-stone-900">
                    GitHub & Vercel Deployment
                  </h3>
                  <p className="text-xs text-stone-500">Repository: github.com/bsnbriefs/Lifebencher</p>
                </div>
                <button
                  onClick={() => setIsHandoffOpen(false)}
                  className="p-1.5 rounded-full hover:bg-stone-100 text-stone-500 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Step 1: Download & Push */}
              <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-amber-400 text-stone-950 flex items-center justify-center text-[11px] font-bold">1</span>
                    Push Code to GitHub in 1 Command
                  </span>
                  <button
                    onClick={() => {
                      downloadProjectZip();
                    }}
                    className="text-[11px] font-bold text-rose-800 hover:text-rose-950 underline flex items-center gap-1 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download ZIP
                  </button>
                </div>
                <p className="text-[11px] text-stone-700 leading-relaxed">
                  Instead of editing files one-by-one on GitHub, unzip the downloaded project and run this single command in your terminal:
                </p>
                <div className="relative p-2.5 rounded-xl bg-stone-950 text-amber-200 font-mono text-[11px] overflow-x-auto">
                  <pre className="whitespace-pre-wrap select-all">git init && git branch -M main && git add . && git commit -m "feat: complete platform" && git remote add origin https://github.com/bsnbriefs/Lifebencher.git && git push -u origin main --force</pre>
                  <button
                    onClick={() =>
                      handleCopy(
                        'git init && git branch -M main && git add . && git commit -m "feat: complete platform" && git remote add origin https://github.com/bsnbriefs/Lifebencher.git && git push -u origin main --force',
                        'git'
                      )
                    }
                    className="absolute top-2 right-2 px-2 py-1 rounded bg-stone-800 hover:bg-stone-700 text-stone-300 text-[10px] flex items-center gap-1 cursor-pointer"
                  >
                    {copiedText === 'git' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedText === 'git' ? 'Copied!' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              {/* Step 2: Vercel Deploy */}
              <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200 space-y-2">
                <span className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-stone-900 text-white flex items-center justify-center text-[11px] font-bold">2</span>
                  Deploy on Vercel (60 seconds)
                </span>
                <ol className="text-[11px] text-stone-600 space-y-1 pl-5 list-decimal">
                  <li>Go to <strong className="text-stone-800">vercel.com</strong> &rarr; Click <strong className="text-stone-800">Add New Project</strong>.</li>
                  <li>Import <strong className="text-stone-800">bsnbriefs/Lifebencher</strong>.</li>
                  <li>Framework preset defaults to <strong className="text-stone-800">Vite</strong> (preset configuration <code className="bg-stone-200 px-1 rounded">vercel.json</code> is already included).</li>
                  <li>Click <strong className="text-stone-800">Deploy</strong>!</li>
                </ol>
              </div>

              {/* Step 3: Grok AI Handoff Prompt */}
              <div className="p-3.5 rounded-2xl bg-rose-50/60 border border-rose-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-rose-950 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-rose-800 text-white flex items-center justify-center text-[11px] font-bold">3</span>
                    Grok AI Handoff Prompt
                  </span>
                  <button
                    onClick={() =>
                      handleCopy(
                        `Hi Grok! I have the complete, working production codebase for "Lifebencher Match" (a high-intent African matrimonial web application built with React 19, TypeScript, Tailwind CSS, Firebase Firestore & Authentication, and PWA capabilities).

Key Architecture:
1. src/context/AuthContext.tsx: Full user state, verification, active persona switcher, mutual consent logic, 7-day connection countdowns, and Firestore sync.
2. src/components/screens/:
   - DiscoverScreen.tsx: Editorial profiles, compatibility breakdown, and mutual interest requests.
   - MatchesScreen.tsx: Active 7-day connections, request approvals/declines, and Paystack connection extensions.
   - MessagesScreen.tsx: Ephemeral encrypted courtship chat with icebreaker prompts, countdown timer, and mutual contact reveal (phone/email exchange).
   - ProfileScreen.tsx: Real profile switcher, profile creator, verified badge status, and ZIP download.
3. src/components/admin/AdminDashboard.tsx: Concierge matchmaker portal for manual profile approvals and editorial introductions.
4. src/lib/firebase.ts & firestore.rules: Configured with project database ai-studio-lifebenchermatch-4a9e32eb-4d4e-43e7-a790-123ced5a4d04 and admin authority admin@barristerstreet.org.

Please inspect the files in this repository and continue with my next request.`,
                        'grok'
                      )
                    }
                    className="px-2.5 py-1 rounded-lg bg-rose-800 hover:bg-rose-900 text-white text-[10px] font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    {copiedText === 'grok' ? <Check className="w-3 h-3 text-emerald-300" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedText === 'grok' ? 'Prompt Copied!' : 'Copy Handoff Prompt'}</span>
                  </button>
                </div>
                <p className="text-[11px] text-stone-600">
                  Copy and paste this prompt into Grok along with your GitHub repo or unzipped folder to let Grok take over seamlessly.
                </p>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => setIsHandoffOpen(false)}
                  className="w-full py-2.5 rounded-xl bg-stone-900 text-white text-xs font-semibold cursor-pointer"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
