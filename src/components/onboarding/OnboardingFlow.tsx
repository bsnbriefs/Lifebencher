import React, { useState, useEffect } from 'react';
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
import { uploadProfilePhoto } from '../../lib/profilePhoto';
import { AppLogo } from '../common/AppLogo';
import { useTheme } from '../../context/ThemeContext';
import { Sun, Moon } from 'lucide-react';
import { Gender } from '../../types';

interface OnboardingFlowProps {
  onCompleted?: () => void;
}

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
  const {
    register,
    login,
    loginWithGoogle,
    sendEmailLink,
    resetPassword,
    sendPhoneCode,
    confirmPhoneCode,
    completeOnboarding,
    isAuthenticated
  } = useAuth();
  const { theme, toggleTheme } = useTheme();

  // Mode: 'register' vs 'login'
  const [authMode, setAuthMode] = useState<'register' | 'login'>(() => {
    try {
      if (sessionStorage.getItem('lifebencher_flw_return') === '1') return 'login';
    } catch {
      /* ignore */
    }
    return 'register';
  });
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginPhone, setLoginPhone] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [phoneCodeSent, setPhoneCodeSent] = useState(false);
  const [loginTab, setLoginTab] = useState<'email' | 'phone'>('email');
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  // Step indicator: 1 to 6 — restore if Auth hydration remounts this screen
  const [currentStep, setCurrentStep] = useState(() => {
    try {
      const saved = sessionStorage.getItem('lifebencher_onboarding_step');
      const n = saved ? Number(saved) : 1;
      return n >= 1 && n <= 6 ? n : 1;
    } catch {
      return 1;
    }
  });

  // Step 1: Account
  useEffect(() => {
    try {
      sessionStorage.setItem('lifebencher_onboarding_step', String(currentStep));
    } catch {
      /* ignore */
    }
  }, [currentStep]);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (authMode === 'login') setAuthMode('register');
    if (currentStep === 1) setCurrentStep(2);
  }, [isAuthenticated]);

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
  const [galleryPhotos, setGalleryPhotos] = useState<string[]>([]);
  const [primaryPhotoIndex, setPrimaryPhotoIndex] = useState(0);
  const [photoBusy, setPhotoBusy] = useState(false);

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

  const formatAuthError = (err: unknown, method?: 'email' | 'phone' | 'google' | 'reset' | 'link') => {
    const raw = err instanceof Error ? err.message : String(err);
    const code = raw.toLowerCase();
    if (code.includes('operation-not-allowed')) {
      if (method === 'phone') return 'SMS did not send. Finish the reCAPTCHA if it appears, or use email and password.';
      if (method === 'google') return 'Google sign-in is off. Enable Google in Authentication → Sign-in method.';
      if (method === 'link') return 'Email link is off. Enable Email link under Email/Password.';
      return 'That sign-in method is off in Firebase Authentication.';
    }
    if (code.includes('popup-closed') || code.includes('cancelled')) {
      return 'Google sign-in was closed before finishing.';
    }
    if (code.includes('unauthorized-domain') || code.includes('allowlisted')) {
      return 'Use email and password to sign in. Forgot-password and Google need a moment after the domain was added.';
    }
    if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) {
      return 'Email or password is incorrect.';
    }
    if (code.includes('too-many-requests')) {
      return 'Too many attempts. Wait a minute and try again.';
    }
    if (code.includes('invalid-phone') || code.includes('invalid-verification')) {
      return 'That phone number or code is not valid.';
    }
    if (code.includes('missing-phone') || code.includes('captcha')) {
      return 'Phone sign-in needs Phone enabled in Firebase Authentication → Sign-in method.';
    }
    return raw.replace(/^Firebase:\s*/i, '').replace(/\s*\(auth\/[^)]+\)\.?/i, '').trim() || 'Sign-in failed. Try email and password.';
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
      if (!loginPassword) {
        setErrorMessage('Please enter your password, or use Google / email link.');
        setIsSubmitting(false);
        return;
      }
      await login(loginEmail, loginPassword);
      try {
        sessionStorage.removeItem('lifebencher_onboarding_step');
      } catch {
        /* ignore */
      }
    } catch (err) {
      setErrorMessage(formatAuthError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const addPhotoFiles = async (list: FileList | File[] | null | undefined) => {
    const incoming = list ? Array.from(list as unknown as File[]) : [];
    if (!incoming.length) {
      setErrorMessage('No photo was received. Try one picture at a time.');
      return;
    }
    const room = 3 - galleryPhotos.length;
    if (room <= 0) {
      setErrorMessage('You can add up to 3 photos.');
      return;
    }
    const batch = incoming.slice(0, room);
    setGalleryPhotos((prev) => [...prev, ...batch.map((file) => URL.createObjectURL(file))].slice(0, 3));
    setPhotoBusy(true);
    setErrorMessage(null);
    const uploaded: string[] = [];
    const startSlot = galleryPhotos.length;
    for (let i = 0; i < batch.length; i += 1) {
      try {
        uploaded.push(await uploadProfilePhoto(batch[i], undefined, startSlot + i));
      } catch (err) {
        setErrorMessage(
          err instanceof Error
            ? err.message
            : 'Upload failed. Stay signed in and use JPG/PNG under 5MB.'
        );
      }
    }
    if (uploaded.length) {
      setGalleryPhotos((prev) => [...prev.filter((u) => !u.startsWith('blob:')), ...uploaded].slice(0, 3));
    }
    setPhotoBusy(false);
  };

  const handleNextStep = () => {
    setErrorMessage(null);
    if (currentStep === 1) {
      if (!displayName.trim()) {
        setErrorMessage('Please enter your display name.');
        return;
      }
      if (isAuthenticated) {
        setCurrentStep(2);
        return;
      }
      if (!email.trim() || !email.includes('@')) {
        setErrorMessage('Please enter a valid email address, or sign up with your phone first.');
        return;
      }
      if (!password || password.length < 6) {
        setErrorMessage('Password must be at least 6 characters, or sign up with your phone.');
        return;
      }
      setIsSubmitting(true);
      register({ email, phone, displayName, password })
        .then(() => {
          sessionStorage.setItem('lifebencher_onboarding_step', '2');
          setCurrentStep(2);
        })
        .catch((err) => setErrorMessage(err instanceof Error ? err.message : 'Registration failed.'))
        .finally(() => setIsSubmitting(false));
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
      if (galleryPhotos.length < 2) {
        setErrorMessage('Add at least 2 recent photos of yourself. Tap one to set it as your profile picture.');
        return;
      }
      setCurrentStep(6);
      return;
    }
  };

  const handleFinishOnboarding = async () => {
    setIsSubmitting(true);
    const ordered = [...galleryPhotos];
    if (primaryPhotoIndex > 0 && primaryPhotoIndex < ordered.length) {
      const [main] = ordered.splice(primaryPhotoIndex, 1);
      ordered.unshift(main);
    }
    const photoToUse = ordered[0] || '';

    try {
    await completeOnboarding(
      {
        displayName,
        age,
        gender,
        location,
        profession,
        education,
        bio,
        photos: ordered.length ? ordered : photoToUse ? [photoToUse] : [],
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
    } catch (err) {
      console.error(err);
      setErrorMessage(err instanceof Error ? err.message : 'Could not save profile. You can tap Activate again.');
    } finally {
    setIsSubmitting(false);
    try {
      sessionStorage.removeItem('lifebencher_onboarding_step');
    } catch {
      /* ignore */
    }
    if (onCompleted) onCompleted();
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-stone-900 flex flex-col p-4 pb-28 safe-area-top">
      {/* Top Brand Header */}
      <header className="max-w-md w-full mx-auto pt-2 pb-4 flex items-center justify-between border-b border-stone-200/70">
        <div className="flex items-center gap-2.5">
          <AppLogo size={32} className="rounded-xl shadow-xs" />
          <div>
            <h1 className="font-serif font-bold text-lg text-rose-950 leading-tight">
              Lifebencher
            </h1>
            <span className="text-[10px] uppercase font-semibold text-amber-800 tracking-widest block leading-none">
              Match
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={toggleTheme}
          className="w-9 h-9 rounded-full bg-stone-100 border border-stone-200 flex items-center justify-center text-stone-600"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
        {/* Toggle Login vs Register */}
        {currentStep === 1 && (
        <button
          onClick={() => {
            setAuthMode((prev) => (prev === 'register' ? 'login' : 'register'));
            setErrorMessage(null);
          }}
          className="text-[11px] font-semibold text-rose-900 bg-rose-50 px-2.5 py-1.5 rounded-full border border-rose-200 hover:bg-rose-100 transition cursor-pointer max-w-[9.5rem] leading-tight"
        >
          {authMode === 'register' ? 'Log In' : 'Register'}
        </button>
        )}
        </div>
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

            <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-stone-100">
              <button
                type="button"
                onClick={() => {
                  setLoginTab('email');
                  setErrorMessage(null);
                  setInfoMessage(null);
                }}
                className={`py-2 rounded-xl text-[11px] font-semibold ${loginTab === 'email' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'}`}
              >
                Email
              </button>
              <button
                type="button"
                onClick={() => {
                  setLoginTab('phone');
                  setErrorMessage(null);
                  setInfoMessage(null);
                }}
                className={`py-2 rounded-xl text-[11px] font-semibold ${loginTab === 'phone' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'}`}
              >
                Phone
              </button>
            </div>

            {errorMessage && (
              <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                {errorMessage}
              </div>
            )}
            {infoMessage && (
              <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs">
                {infoMessage}
              </div>
            )}

            {loginTab === 'email' ? (
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
                type="button"
                disabled={isSubmitting || !loginEmail.trim()}
                onClick={async () => {
                  setIsSubmitting(true);
                  setErrorMessage(null);
                  try {
                    await resetPassword(loginEmail);
                    setInfoMessage('Password reset email sent. Check your inbox and spam.');
                  } catch (err) {
                    setErrorMessage(formatAuthError(err, 'reset'));
                  } finally {
                    setIsSubmitting(false);
                  }
                }}
                className="text-[11px] font-semibold text-rose-900"
              >
                Forgot password?
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-rose-900 to-rose-800 text-amber-100 font-semibold text-xs shadow-md hover:bg-rose-950 transition active:scale-98 cursor-pointer flex items-center justify-center gap-2"
              >
                {isSubmitting ? 'Signing in...' : 'Sign In to Lifebencher Match'}
              </button>
            </form>
            ) : (
            <div className="space-y-3">
              <p className="text-xs text-stone-500">Use country code (+234…). Complete the check below, then send the code.</p>
              <div id="lifebencher-recaptcha" className="flex justify-center min-h-[78px]" />
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-2xl bg-stone-50 border border-stone-300">
                <Phone className="w-4 h-4 text-stone-400" />
                <input
                  type="tel"
                  value={loginPhone}
                  onChange={(e) => setLoginPhone(e.target.value)}
                  placeholder="+44 7700 900123"
                  className="w-full text-xs bg-transparent outline-hidden"
                />
              </div>
              {phoneCodeSent && (
                <input
                  type="text"
                  inputMode="numeric"
                  value={phoneCode}
                  onChange={(e) => setPhoneCode(e.target.value)}
                  placeholder="6-digit SMS code"
                  className="w-full text-xs px-3 py-2.5 rounded-2xl bg-stone-50 border border-stone-300 outline-hidden"
                />
              )}
              <button
                type="button"
                disabled={isSubmitting || !loginPhone.trim()}
                onClick={async () => {
                  setIsSubmitting(true);
                  setErrorMessage(null);
                  setInfoMessage(null);
                  try {
                    if (!phoneCodeSent) {
                      await sendPhoneCode(loginPhone);
                      setPhoneCodeSent(true);
                      setInfoMessage('SMS sent. Enter the 6-digit code.');
                    } else {
                      await confirmPhoneCode(phoneCode);
                      sessionStorage.setItem('lifebencher_onboarding_step', '2');
                      setAuthMode('register');
                      setCurrentStep(2);
                    }
                  } catch (err) {
                    setErrorMessage(formatAuthError(err, 'phone'));
                  } finally {
                    setIsSubmitting(false);
                  }
                }}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-rose-900 to-rose-800 text-amber-100 font-semibold text-xs"
              >
                {phoneCodeSent ? 'Verify SMS code' : 'Send SMS code'}
              </button>
            </div>
            )}

            <div className="relative py-1">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-stone-200" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white px-2 text-[10px] uppercase tracking-wider text-stone-400">or</span>
              </div>
            </div>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={async () => {
                setIsSubmitting(true);
                setErrorMessage(null);
                try {
                  await loginWithGoogle();
                  if (onCompleted) onCompleted();
                  sessionStorage.setItem('lifebencher_onboarding_step', '2');
                  setAuthMode('register');
                  setCurrentStep(2);
                } catch (err) {
                  setErrorMessage(formatAuthError(err, 'google'));
                } finally {
                  setIsSubmitting(false);
                }
              }}
              className="w-full py-3 rounded-2xl border border-stone-300 bg-white text-stone-800 font-semibold text-xs hover:bg-stone-50 transition cursor-pointer"
            >
              Continue with Google
            </button>

            {loginTab === 'email' && (
              <button
                type="button"
                disabled={isSubmitting || !loginEmail.trim()}
                onClick={async () => {
                  if (!loginEmail.trim()) {
                    setErrorMessage('Enter your email first.');
                    return;
                  }
                  setIsSubmitting(true);
                  setErrorMessage(null);
                  setInfoMessage(null);
                  try {
                    await sendEmailLink(loginEmail);
                    setInfoMessage('Sign-in link sent. Check your inbox.');
                  } catch (err) {
                    setErrorMessage(formatAuthError(err, 'link'));
                  } finally {
                    setIsSubmitting(false);
                  }
                }}
                className="w-full text-[11px] font-semibold text-stone-500"
              >
                Email me a sign-in link instead
              </button>
            )}

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
                          placeholder="Your first name"
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
                          placeholder="you@email.com"
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
                          placeholder="+234 800 000 0000 or +1 415…"
                          className="w-full text-xs text-stone-900 bg-transparent outline-hidden"
                        />
                      </div>
                      <p className="text-[10px] text-stone-400 mt-1">
                        Never shown publicly. Only shared with mutual consent.
                      </p>
                      <div className="flex gap-2 mt-2">
                        <button
                          type="button"
                          disabled={isSubmitting || !phone.trim()}
                          onClick={async () => {
                            setIsSubmitting(true);
                            setErrorMessage(null);
                            try {
                              await sendPhoneCode(phone);
                              setPhoneCodeSent(true);
                              setErrorMessage('SMS code sent. Enter it below, then continue.');
                            } catch (err) {
                              setErrorMessage(formatAuthError(err));
                            } finally {
                              setIsSubmitting(false);
                            }
                          }}
                          className="flex-1 py-2 rounded-xl border border-stone-300 text-[11px] font-semibold"
                        >
                          Sign up with this number
                        </button>
                      </div>
                      {phoneCodeSent && (
                        <div className="flex gap-2 mt-2">
                          <input
                            type="text"
                            inputMode="numeric"
                            value={phoneCode}
                            onChange={(e) => setPhoneCode(e.target.value)}
                            placeholder="SMS code"
                            className="flex-1 text-xs px-3 py-2 rounded-xl border border-stone-300"
                          />
                          <button
                            type="button"
                            disabled={isSubmitting}
                            onClick={async () => {
                              setIsSubmitting(true);
                              setErrorMessage(null);
                              try {
                                await confirmPhoneCode(phoneCode);
                                setCurrentStep(2);
                              } catch (err) {
                                setErrorMessage(formatAuthError(err));
                              } finally {
                                setIsSubmitting(false);
                              }
                            }}
                            className="px-3 py-2 rounded-xl bg-rose-900 text-amber-100 text-[11px] font-semibold"
                          >
                            Verify
                          </button>
                        </div>
                      )}
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
                        Your photos
                      </h2>
                      <p className="text-xs text-stone-500 mt-0.5">
                        Add 2–3 recent photos of yourself. Tap one to use it as your profile picture.
                      </p>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      {galleryPhotos.map((url, idx) => (
                        <button
                          key={url}
                          type="button"
                          onClick={() => setPrimaryPhotoIndex(idx)}
                          className={`relative rounded-xl overflow-hidden aspect-square border-2 ${
                            primaryPhotoIndex === idx ? 'border-rose-900 ring-2 ring-rose-200' : 'border-stone-200'
                          }`}
                        >
                          <img src={url} alt="" className="w-full h-full object-cover" />
                          {primaryPhotoIndex === idx && (
                            <span className="absolute bottom-1 left-1 right-1 text-[9px] font-bold bg-rose-900 text-amber-100 rounded px-1 py-0.5">
                              Profile
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                    {galleryPhotos.length < 3 && (
                      <div className="space-y-2">
                        <p className="text-[11px] font-semibold text-stone-700">
                          {photoBusy ? 'Uploading…' : 'Choose a photo'}
                        </p>
                        <input
                          type="file"
                          accept="image/*"
                          disabled={photoBusy}
                          className="block w-full text-xs text-stone-700 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:bg-rose-900 file:text-amber-100 file:font-semibold"
                          onChange={(e) => {
                            const picked = e.target.files?.[0];
                            if (!picked) return;
                            void addPhotoFiles([picked]);
                          }}
                        />
                      </div>
                    )}
                    <p className="text-[11px] text-stone-500">
                      {galleryPhotos.length}/3 photos · JPG, PNG or WebP · max 5MB each
                    </p>
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
                          src={galleryPhotos[primaryPhotoIndex] || galleryPhotos[0] || ''}
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

            </div>
          </div>
        )}
      </div>

      {authMode !== 'login' && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#FAF8F5]/95 dark:bg-[#161210]/95 backdrop-blur-md border-t border-stone-200 px-4 py-3 pb-[calc(12px+env(safe-area-inset-bottom,0px)+48px)]">
          <div className="max-w-md mx-auto flex items-center justify-between gap-2">
            {currentStep > 1 ? (
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => prev - 1)}
                className="flex items-center gap-1 text-xs font-semibold text-stone-600 px-3 py-3 rounded-xl"
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
                className="flex items-center gap-1.5 px-5 py-3 rounded-2xl bg-rose-900 text-amber-100 font-semibold text-sm shadow-sm ml-auto min-h-12"
              >
                <span>Continue</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinishOnboarding}
                disabled={isSubmitting}
                className="flex items-center gap-1.5 px-5 py-3 rounded-2xl bg-gradient-to-r from-rose-900 to-amber-700 text-white font-bold text-sm shadow-md ml-auto min-h-12"
              >
                {isSubmitting ? 'Saving Profile...' : 'Complete Profile & Enter'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Safety & Trust Footer */}
      <footer className="max-w-md w-full mx-auto pt-3 pb-4 text-center text-[11px] text-stone-400 flex items-center justify-center gap-1.5">
        <Shield className="w-3.5 h-3.5 text-rose-800" />
        <span>Lifebencher Match · Verified Intentional Courtship</span>
      </footer>
    </div>
  );
};
