import React, { useState } from 'react';
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Heart,
  MapPin,
  Briefcase,
  GraduationCap,
  Shield,
  Eye,
  Camera,
  User,
  Lock,
  Mail,
  Phone
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../../context/AuthContext';
import { Gender } from '../../types';

interface OnboardingFlowProps {
  onCompleted?: () => void;
}

const PRESET_PHOTOS = [
  {
    label: 'Warm Portrait 1',
    url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&auto=format&fit=crop&q=80'
  },
  {
    label: 'Warm Portrait 2',
    url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800&auto=format&fit=crop&q=80'
  },
  {
    label: 'Warm Portrait 3',
    url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop&q=80'
  },
  {
    label: 'Warm Portrait 4',
    url: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=800&auto=format&fit=crop&q=80'
  },
  {
    label: 'Warm Portrait 5',
    url: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=800&auto=format&fit=crop&q=80'
  },
  {
    label: 'Warm Portrait 6',
    url: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=800&auto=format&fit=crop&q=80'
  }
];

const AVAILABLE_VALUES = [
  'Faith & Spirituality',
  'Family-Centered',
  'Emotional Intelligence',
  'Integrity & Honesty',
  'Continuous Growth',
  'Mutual Respect',
  'Financial Responsibility',
  'Generosity & Kindness',
  'Cultural Heritage',
  'Patience & Peace'
];

const AVAILABLE_INTERESTS = [
  'Fine Art & Galleries',
  'Classical & Jazz Music',
  'Culinary Arts & Cooking',
  'Literature & Books',
  'Travel & Exploration',
  'Health & Fitness',
  'Philanthropy & Mentoring',
  'Architecture & Design',
  'Nature & Hiking',
  'Business & Tech'
];

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ onCompleted }) => {
  const { register, login, completeOnboarding } = useAuth();

  // Mode: 'register' vs 'login'
  const [authMode, setAuthMode] = useState<'register' | 'login'>('register');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Step indicator: 1 to 6
  const [currentStep, setCurrentStep] = useState(1);

  // Step 1: Account
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');

  // Step 2: About You
  const [age, setAge] = useState<number>(29);
  const [gender, setGender] = useState<Gender>('male');
  const [location, setLocation] = useState('Lagos, Nigeria');
  const [profession, setProfession] = useState('Senior Product Manager');
  const [education, setEducation] = useState('B.Sc. Computer Engineering');
  const [bio, setBio] = useState('Intentional, thoughtful, and family-minded.');

  // Step 3: Lifestyle
  const [faith, setFaith] = useState('Christian');
  const [smoking, setSmoking] = useState<'no' | 'occasionally' | 'yes'>('no');
  const [drinking, setDrinking] = useState<'no' | 'socially' | 'frequently'>('socially');
  const [exercise, setExercise] = useState<'active' | 'sometimes' | 'rarely'>('active');
  const [kids, setKids] = useState<'wants kids' | 'has kids' | 'open to kids' | 'prefers none'>('wants kids');

  // Step 4: What You're Looking For
  const [relationshipGoal, setRelationshipGoal] = useState('Intentional courtship leading to marriage');
  const [selectedValues, setSelectedValues] = useState<string[]>([
    'Faith & Spirituality',
    'Family-Centered',
    'Integrity & Honesty'
  ]);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([
    'Travel & Exploration',
    'Literature & Books',
    'Fine Art & Galleries'
  ]);
  const [prefAgeMin, setPrefAgeMin] = useState(24);
  const [prefAgeMax, setPrefAgeMax] = useState(33);

  // Step 5: Profile Photo
  const [selectedPhoto, setSelectedPhoto] = useState<string>(PRESET_PHOTOS[0].url);
  const [customPhotoUrl, setCustomPhotoUrl] = useState('');

  // Processing state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Quick toggle helper for arrays
  const toggleItem = (list: string[], item: string, setter: (val: string[]) => void, max = 5) => {
    if (list.includes(item)) {
      setter(list.filter((i) => i !== item));
    } else {
      if (list.length < max) {
        setter([...list, item]);
      }
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim()) {
      setErrorMessage('Please enter your email.');
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await login(loginEmail);
      if (onCompleted) onCompleted();
    } catch {
      setErrorMessage('Failed to log in. Please check your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNextStep = () => {
    setErrorMessage(null);
    if (currentStep === 1) {
      if (!displayName.trim()) {
        setErrorMessage('Please enter your display name.');
        return;
      }
      if (!email.trim() || !email.includes('@')) {
        setErrorMessage('Please enter a valid email address.');
        return;
      }
      if (!password || password.length < 6) {
        setErrorMessage('Password must be at least 6 characters.');
        return;
      }
      // Register preliminary account in context
      register({ email, phone, displayName });
      setCurrentStep(2);
      return;
    }

    if (currentStep === 2) {
      if (!profession.trim()) {
        setErrorMessage('Please state your profession.');
        return;
      }
      if (!bio.trim() || bio.length < 15) {
        setErrorMessage('Please write a short bio (at least 15 characters).');
        return;
      }
      setCurrentStep(3);
      return;
    }

    if (currentStep === 3) {
      setCurrentStep(4);
      return;
    }

    if (currentStep === 4) {
      if (selectedValues.length === 0) {
        setErrorMessage('Please choose at least 1 core value.');
        return;
      }
      setCurrentStep(5);
      return;
    }

    if (currentStep === 5) {
      const activePhoto = customPhotoUrl.trim() || selectedPhoto;
      if (!activePhoto) {
        setErrorMessage('Please select or provide a profile photo.');
        return;
      }
      setCurrentStep(6);
      return;
    }
  };

  const handleFinishOnboarding = async () => {
    setIsSubmitting(true);
    const photoToUse = customPhotoUrl.trim() || selectedPhoto;

    await completeOnboarding(
      {
        displayName,
        age,
        gender,
        location,
        profession,
        education,
        bio,
        photos: [photoToUse],
        interests: selectedInterests,
        values: selectedValues,
        relationshipGoal,
        lifestyle: {
          faith,
          smoking,
          drinking,
          exercise,
          kids
        }
      },
      {
        preferredGender: [gender === 'male' ? 'female' : 'male'],
        ageMin: prefAgeMin,
        ageMax: prefAgeMax,
        preferredLocations: [location]
      }
    );

    setIsSubmitting(false);
    if (onCompleted) onCompleted();
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-stone-900 flex flex-col justify-between p-4 safe-area-top safe-area-bottom">
      {/* Top Brand Header */}
      <header className="max-w-md w-full mx-auto pt-2 pb-4 flex items-center justify-between border-b border-stone-200/70">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-rose-900 to-rose-700 flex items-center justify-center text-amber-300 shadow-xs">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h1 className="font-serif font-bold text-lg text-rose-950 leading-tight">
              Lifebencher
            </h1>
            <span className="text-[10px] uppercase font-semibold text-amber-800 tracking-widest block leading-none">
              Match
            </span>
          </div>
        </div>

        {/* Toggle Login vs Register */}
        <button
          onClick={() => {
            setAuthMode((prev) => (prev === 'register' ? 'login' : 'register'));
            setErrorMessage(null);
          }}
          className="text-xs font-semibold text-rose-900 bg-rose-50 px-3 py-1.5 rounded-full border border-rose-200 hover:bg-rose-100 transition cursor-pointer"
        >
          {authMode === 'register' ? 'Already have an account? Log In' : 'New Client? Register'}
        </button>
      </header>

      {/* Main Body */}
      <div className="max-w-md w-full mx-auto my-auto py-4">
        {authMode === 'login' ? (
          /* LOGIN FORM */
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-3xl p-6 border border-stone-200/90 shadow-sm space-y-4"
          >
            <div>
              <h2 className="font-serif text-2xl font-bold text-stone-900">
                Welcome Back
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Sign in to your Lifebencher Match account
              </p>
            </div>

            {errorMessage && (
              <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleLoginSubmit} className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-stone-700 block mb-1">
                  Email Address
                </label>
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-2xl bg-stone-50 border border-stone-300 focus-within:border-rose-900 focus-within:bg-white transition">
                  <Mail className="w-4 h-4 text-stone-400" />
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="e.g. chukwudi@lifebencher.com"
                    className="w-full text-xs text-stone-900 bg-transparent outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-700 block mb-1">
                  Password
                </label>
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-2xl bg-stone-50 border border-stone-300 focus-within:border-rose-900 focus-within:bg-white transition">
                  <Lock className="w-4 h-4 text-stone-400" />
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full text-xs text-stone-900 bg-transparent outline-hidden"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-rose-900 to-rose-800 text-amber-100 font-semibold text-xs shadow-md hover:bg-rose-950 transition active:scale-98 cursor-pointer flex items-center justify-center gap-2"
              >
                {isSubmitting ? 'Signing in...' : 'Sign In to Lifebencher Match'}
              </button>
            </form>
          </motion.div>
        ) : (
          /* MULTI-STEP ONBOARDING (STEPS 1 TO 6) */
          <div className="space-y-4">
            {/* Step progress bar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-stone-500 font-medium">
                <span>Step {currentStep} of 6</span>
                <span className="text-rose-900 font-semibold">
                  {currentStep === 1 && 'Account Credentials'}
                  {currentStep === 2 && 'About You'}
                  {currentStep === 3 && 'Lifestyle & Values'}
                  {currentStep === 4 && 'Partner Preferences'}
                  {currentStep === 5 && 'Profile Portrait'}
                  {currentStep === 6 && 'Review & Activate'}
                </span>
              </div>
              <div className="w-full h-1.5 bg-stone-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-rose-900 to-amber-600 transition-all duration-300 rounded-full"
                  style={{ width: `${(currentStep / 6) * 100}%` }}
                />
              </div>
            </div>

            {errorMessage && (
              <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs animate-in fade-in">
                {errorMessage}
              </div>
            )}

            {/* Step Content Card */}
            <div className="bg-white rounded-3xl p-5 border border-stone-200/90 shadow-sm min-h-[380px] flex flex-col justify-between">
              <AnimatePresence mode="wait">
                {/* STEP 1: Account */}
                {currentStep === 1 && (
                  <motion.div
                    key="step1"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="space-y-3.5"
                  >
                    <div>
                      <h2 className="font-serif text-xl font-bold text-stone-900">
                        Create Your Account
                      </h2>
                      <p className="text-xs text-stone-500 mt-0.5">
                        Your private credentials for Lifebencher Match
                      </p>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-stone-700 block mb-1">
                        First / Display Name
                      </label>
                      <div className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-stone-50 border border-stone-300 focus-within:border-rose-900">
                        <User className="w-4 h-4 text-stone-400" />
                        <input
                          type="text"
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          placeholder="e.g. Chukwudi"
                          className="w-full text-xs text-stone-900 bg-transparent outline-hidden"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-stone-700 block mb-1">
                        Email Address
                      </label>
                      <div className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-stone-50 border border-stone-300 focus-within:border-rose-900">
                        <Mail className="w-4 h-4 text-stone-400" />
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="chukwudi@example.com"
                          className="w-full text-xs text-stone-900 bg-transparent outline-hidden"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-stone-700 block mb-1">
                        Phone Number (Kept Confidential)
                      </label>
                      <div className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-stone-50 border border-stone-300 focus-within:border-rose-900">
                        <Phone className="w-4 h-4 text-stone-400" />
                        <input
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="+234 800 000 0000"
                          className="w-full text-xs text-stone-900 bg-transparent outline-hidden"
                        />
                      </div>
                      <p className="text-[10px] text-stone-400 mt-1">
                        Never shown publicly. Only shared with mutual consent.
                      </p>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-stone-700 block mb-1">
                        Secure Password
                      </label>
                      <div className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-stone-50 border border-stone-300 focus-within:border-rose-900">
                        <Lock className="w-4 h-4 text-stone-400" />
                        <input
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="At least 6 characters"
                          className="w-full text-xs text-stone-900 bg-transparent outline-hidden"
                        />
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* STEP 2: About You */}
                {currentStep === 2 && (
                  <motion.div
                    key="step2"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="space-y-3"
                  >
                    <div>
                      <h2 className="font-serif text-xl font-bold text-stone-900">
                        About You
                      </h2>
                      <p className="text-xs text-stone-500 mt-0.5">
                        Tell eligible matches about your background
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs font-semibold text-stone-700 block mb-1">
                          Age
                        </label>
                        <input
                          type="number"
                          min={21}
                          max={75}
                          value={age}
                          onChange={(e) => setAge(Number(e.target.value))}
                          className="w-full text-xs text-stone-900 p-2 rounded-xl bg-stone-50 border border-stone-300 outline-hidden"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-stone-700 block mb-1">
                          Gender
                        </label>
                        <select
                          value={gender}
                          onChange={(e) => setGender(e.target.value as Gender)}
                          className="w-full text-xs text-stone-900 p-2 rounded-xl bg-stone-50 border border-stone-300 outline-hidden"
                        >
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-stone-700 block mb-1">
                        Location / City
                      </label>
                      <input
                        type="text"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        placeholder="e.g. Lagos, Nigeria"
                        className="w-full text-xs text-stone-900 p-2 rounded-xl bg-stone-50 border border-stone-300 outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-stone-700 block mb-1">
                        Profession / Career
                      </label>
                      <input
                        type="text"
                        value={profession}
                        onChange={(e) => setProfession(e.target.value)}
                        placeholder="e.g. Senior Software Architect"
                        className="w-full text-xs text-stone-900 p-2 rounded-xl bg-stone-50 border border-stone-300 outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-stone-700 block mb-1">
                        Education
                      </label>
                      <input
                        type="text"
                        value={education}
                        onChange={(e) => setEducation(e.target.value)}
                        placeholder="e.g. M.Sc. Computer Science"
                        className="w-full text-xs text-stone-900 p-2 rounded-xl bg-stone-50 border border-stone-300 outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-stone-700 block mb-1">
                        Short Bio
                      </label>
                      <textarea
                        rows={2}
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        placeholder="A brief introduction of your life and character..."
                        className="w-full text-xs text-stone-900 p-2 rounded-xl bg-stone-50 border border-stone-300 outline-hidden"
                      />
                    </div>
                  </motion.div>
                )}

                {/* STEP 3: Lifestyle */}
                {currentStep === 3 && (
                  <motion.div
                    key="step3"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="space-y-3"
                  >
                    <div>
                      <h2 className="font-serif text-xl font-bold text-stone-900">
                        Your Lifestyle
                      </h2>
                      <p className="text-xs text-stone-500 mt-0.5">
                        Helps ensure healthy alignment with potential matches
                      </p>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-stone-700 block mb-1">
                        Faith / Spirituality
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {['Christian', 'Muslim', 'Other'].map((f) => (
                          <button
                            key={f}
                            type="button"
                            onClick={() => setFaith(f)}
                            className={`py-2 text-xs rounded-xl border transition ${
                              faith === f
                                ? 'bg-rose-900 text-white border-rose-950 font-semibold'
                                : 'bg-stone-50 text-stone-700 border-stone-200'
                            }`}
                          >
                            {f}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-stone-700 block mb-1">
                        Children / Family Plans
                      </label>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {(['wants kids', 'open to kids', 'has kids', 'prefers none'] as const).map((k) => (
                          <button
                            key={k}
                            type="button"
                            onClick={() => setKids(k)}
                            className={`p-2 rounded-xl border capitalize transition ${
                              kids === k
                                ? 'bg-rose-900 text-white border-rose-950 font-semibold'
                                : 'bg-stone-50 text-stone-700 border-stone-200'
                            }`}
                          >
                            {k}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs font-semibold text-stone-700 block mb-1">
                          Drinking
                        </label>
                        <select
                          value={drinking}
                          onChange={(e) => setDrinking(e.target.value as 'no' | 'socially' | 'frequently')}
                          className="w-full text-xs p-2 rounded-xl bg-stone-50 border border-stone-300 outline-hidden"
                        >
                          <option value="no">Never</option>
                          <option value="socially">Socially</option>
                          <option value="frequently">Frequently</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-stone-700 block mb-1">
                          Smoking
                        </label>
                        <select
                          value={smoking}
                          onChange={(e) => setSmoking(e.target.value as 'no' | 'occasionally' | 'yes')}
                          className="w-full text-xs p-2 rounded-xl bg-stone-50 border border-stone-300 outline-hidden"
                        >
                          <option value="no">Never</option>
                          <option value="occasionally">Occasionally</option>
                          <option value="yes">Yes</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-stone-700 block mb-1">
                        Exercise & Activity
                      </label>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        {(['active', 'sometimes', 'rarely'] as const).map((ex) => (
                          <button
                            key={ex}
                            type="button"
                            onClick={() => setExercise(ex)}
                            className={`p-2 rounded-xl border capitalize transition ${
                              exercise === ex
                                ? 'bg-rose-900 text-white border-rose-950 font-semibold'
                                : 'bg-stone-50 text-stone-700 border-stone-200'
                            }`}
                          >
                            {ex}
                          </button>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* STEP 4: What You're Looking For */}
                {currentStep === 4 && (
                  <motion.div
                    key="step4"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="space-y-3"
                  >
                    <div>
                      <h2 className="font-serif text-xl font-bold text-stone-900">
                        What You're Looking For
                      </h2>
                      <p className="text-xs text-stone-500 mt-0.5">
                        Define your intentions and mutual compatibility markers
                      </p>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-stone-700 block mb-1">
                        Relationship Objective
                      </label>
                      <input
                        type="text"
                        value={relationshipGoal}
                        onChange={(e) => setRelationshipGoal(e.target.value)}
                        placeholder="e.g. Long-term marriage with deep companionship"
                        className="w-full text-xs text-stone-900 p-2 rounded-xl bg-stone-50 border border-stone-300 outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-stone-700 block mb-1">
                        Core Values (Choose up to 4)
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {AVAILABLE_VALUES.map((val) => {
                          const isSel = selectedValues.includes(val);
                          return (
                            <button
                              key={val}
                              type="button"
                              onClick={() => toggleItem(selectedValues, val, setSelectedValues, 4)}
                              className={`text-xs px-2.5 py-1 rounded-lg border transition ${
                                isSel
                                  ? 'bg-rose-900 text-white border-rose-950 font-medium'
                                  : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                              }`}
                            >
                              {val}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-stone-700 block mb-1">
                        Interests & Passions (Choose up to 4)
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {AVAILABLE_INTERESTS.map((int) => {
                          const isSel = selectedInterests.includes(int);
                          return (
                            <button
                              key={int}
                              type="button"
                              onClick={() => toggleItem(selectedInterests, int, setSelectedInterests, 4)}
                              className={`text-xs px-2.5 py-1 rounded-lg border transition ${
                                isSel
                                  ? 'bg-amber-600 text-white border-amber-700 font-medium'
                                  : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                              }`}
                            >
                              {int}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-stone-700 block mb-1">
                        Preferred Match Age: {prefAgeMin} – {prefAgeMax}
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
                  </motion.div>
                )}

                {/* STEP 5: Profile Photo */}
                {currentStep === 5 && (
                  <motion.div
                    key="step5"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="space-y-3"
                  >
                    <div>
                      <h2 className="font-serif text-xl font-bold text-stone-900">
                        Profile Portrait
                      </h2>
                      <p className="text-xs text-stone-500 mt-0.5">
                        Choose a representative photo or paste an image URL
                      </p>
                    </div>

                    {/* Active preview */}
                    <div className="flex items-center gap-3 p-3 bg-stone-50 rounded-2xl border border-stone-200">
                      <img
                        src={customPhotoUrl.trim() || selectedPhoto}
                        alt="Preview"
                        className="w-16 h-16 rounded-2xl object-cover border border-stone-200"
                      />
                      <div className="text-xs">
                        <p className="font-semibold text-stone-900">Selected Photo Preview</p>
                        <p className="text-stone-500 text-[11px]">Clean, high-resolution portrait</p>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-stone-700 block mb-1.5">
                        Quick Mobile Presets
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {PRESET_PHOTOS.map((p, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              setSelectedPhoto(p.url);
                              setCustomPhotoUrl('');
                            }}
                            className={`relative rounded-xl overflow-hidden aspect-square border-2 transition ${
                              selectedPhoto === p.url && !customPhotoUrl
                                ? 'border-rose-900 ring-2 ring-rose-200'
                                : 'border-transparent'
                            }`}
                          >
                            <img src={p.url} alt={p.label} className="w-full h-full object-cover" />
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-stone-700 block mb-1">
                        Or Custom Image URL
                      </label>
                      <input
                        type="url"
                        value={customPhotoUrl}
                        onChange={(e) => setCustomPhotoUrl(e.target.value)}
                        placeholder="https://example.com/my-photo.jpg"
                        className="w-full text-xs text-stone-900 p-2.5 rounded-xl bg-stone-50 border border-stone-300 outline-hidden"
                      />
                    </div>
                  </motion.div>
                )}

                {/* STEP 6: Preview & Complete */}
                {currentStep === 6 && (
                  <motion.div
                    key="step6"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="space-y-3"
                  >
                    <div>
                      <h2 className="font-serif text-xl font-bold text-stone-900">
                        Profile Preview
                      </h2>
                      <p className="text-xs text-stone-500 mt-0.5">
                        This is how your verified profile appears to prospective matches
                      </p>
                    </div>

                    {/* Miniature Card Preview */}
                    <div className="bg-stone-50 rounded-2xl overflow-hidden border border-stone-200 p-3 space-y-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={customPhotoUrl.trim() || selectedPhoto}
                          alt={displayName}
                          className="w-16 h-16 rounded-2xl object-cover border border-stone-200"
                        />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h3 className="font-serif font-bold text-base text-stone-900">
                              {displayName}, {age}
                            </h3>
                            <span className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">
                              ✓
                            </span>
                          </div>
                          <p className="text-xs text-stone-600 flex items-center gap-1 mt-0.5">
                            <Briefcase className="w-3 h-3 text-stone-400" />
                            {profession}
                          </p>
                          <p className="text-xs text-stone-500 flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3 text-stone-400" />
                            {location}
                          </p>
                        </div>
                      </div>

                      <div className="text-xs text-stone-700 bg-white p-2.5 rounded-xl border border-stone-200/80">
                        <p className="italic">"{bio}"</p>
                      </div>

                      <div className="flex items-center gap-2 text-xs">
                        <Heart className="w-3.5 h-3.5 text-rose-700" />
                        <span className="font-medium text-stone-800">Seeking: {relationshipGoal}</span>
                      </div>

                      <div className="flex flex-wrap gap-1">
                        {selectedValues.slice(0, 3).map((v) => (
                          <span key={v} className="text-[11px] px-2 py-0.5 rounded-md bg-stone-200 text-stone-800">
                            {v}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                      <span>Ready for discovery. Admin review ensures privacy and seriousness.</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Navigation Controls */}
              <div className="pt-4 flex items-center justify-between border-t border-stone-100 mt-2">
                {currentStep > 1 ? (
                  <button
                    type="button"
                    onClick={() => setCurrentStep((prev) => prev - 1)}
                    className="flex items-center gap-1 text-xs font-semibold text-stone-600 hover:text-stone-900 px-3 py-2 rounded-xl transition cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Back
                  </button>
                ) : (
                  <div />
                )}

                {currentStep < 6 ? (
                  <button
                    type="button"
                    onClick={handleNextStep}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-rose-900 text-amber-100 font-semibold text-xs shadow-sm hover:bg-rose-950 transition active:scale-95 cursor-pointer ml-auto"
                  >
                    <span>Continue</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleFinishOnboarding}
                    disabled={isSubmitting}
                    className="flex items-center gap-1.5 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-rose-900 to-amber-700 text-white font-bold text-xs shadow-md hover:from-rose-950 transition active:scale-95 cursor-pointer ml-auto"
                  >
                    {isSubmitting ? (
                      <span>Saving Profile...</span>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                        <span>Complete Profile & Enter</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Safety & Trust Footer */}
      <footer className="max-w-md w-full mx-auto pt-3 text-center text-[11px] text-stone-400 flex items-center justify-center gap-1.5">
        <Shield className="w-3.5 h-3.5 text-rose-800" />
        <span>Lifebencher Match · Verified Intentional Courtship</span>
      </footer>
    </div>
  );
};
