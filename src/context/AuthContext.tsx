import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  signOut,
  updateProfile as updateAuthProfile,
  User as FirebaseUser
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { User, Profile, ProfilePreferences } from '../types';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';



const SUPER_ADMIN_EMAIL = 'admin@barristerstreet.org';
const EMAIL_LINK_STORAGE_KEY = 'lifebencher_email_for_sign_in';
const EXTRAS_STORAGE_KEY = 'lifebencher_profile_extras';
const PREFS_STORAGE_KEY = 'lifebencher_prefs';

interface AuthContextType {
  user: User | null;
  currentProfile: Profile | null;
  preferences: ProfilePreferences | null;
  isAuthenticated: boolean;
  isOnboarded: boolean;
  isLoading: boolean;
  isAdmin: boolean;
  authError: string | null;
  login: (email: string, password?: string) => Promise<boolean>;
  register: (accountData: { email: string; phone?: string; displayName: string; password?: string }) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  sendEmailLink: (email: string) => Promise<void>;
  completeOnboarding: (profileData: Partial<Profile>, prefsData?: Partial<ProfilePreferences>) => Promise<void>;
  updateProfile: (updated: Partial<Profile>) => void;
  updatePreferences: (updated: Partial<ProfilePreferences>) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function nowIso() {
  return new Date().toISOString();
}

function emailLocalPart(email: string | null | undefined): string {
  const raw = (email || 'member').split('@')[0] || 'member';
  const cleaned = raw.replace(/[^a-zA-Z0-9 _-]/g, ' ').trim();
  return cleaned.length >= 2 ? cleaned : 'Member';
}

function mapUserDoc(uid: string, email: string, data: Partial<User> | undefined, phone?: string): User {
  return {
    id: uid,
    email: data?.email || email,
    phone: data?.phone || phone,
    role: data?.role === 'admin' || email === SUPER_ADMIN_EMAIL ? 'admin' : 'client',
    isActive: data?.isActive ?? true,
    createdAt: data?.createdAt || nowIso()
  };
}

function draftProfile(uid: string, displayName: string): Record<string, unknown> {
  const ts = nowIso();
  return {
    id: uid,
    userId: uid,
    displayName: displayName.slice(0, 60),
    age: 28,
    gender: 'male',
    location: 'Lagos, Nigeria',
    profession: '',
    education: '',
    bio: '',
    relationshipGoal: 'Intentional marriage',
    isVerified: false,
    isVisible: false,
    createdAt: ts,
    updatedAt: ts
  };
}

function profileFromDoc(uid: string, data: Record<string, unknown> | undefined, extras?: Partial<Profile>): Profile {
  return {
    id: (data?.id as string) || uid,
    userId: (data?.userId as string) || uid,
    displayName: (data?.displayName as string) || extras?.displayName || 'Member',
    age: typeof data?.age === 'number' ? data.age : extras?.age || 28,
    gender: (data?.gender as Profile['gender']) || extras?.gender || 'male',
    location: (data?.location as string) || extras?.location || 'Lagos, Nigeria',
    profession: (data?.profession as string) || extras?.profession || '',
    education: (data?.education as string) || extras?.education || '',
    bio: (data?.bio as string) || extras?.bio || '',
    photos: Array.isArray(data?.photoUrls) && data.photoUrls.length
      ? (data.photoUrls as string[])
      : (typeof data?.photoUrl === 'string' && data.photoUrl
        ? [data.photoUrl]
        : extras?.photos) || [],
    interests: Array.isArray(data?.interests) ? (data.interests as string[]) : extras?.interests || [],
    values: Array.isArray(data?.values) ? (data.values as string[]) : extras?.values || [],
    relationshipGoal: (data?.relationshipGoal as string) || extras?.relationshipGoal || 'Intentional marriage',
    lifestyle: (data?.lifestyle && typeof data.lifestyle === 'object'
      ? (data.lifestyle as Profile['lifestyle'])
      : extras?.lifestyle) || {},
    isVerified: Boolean(data?.isVerified),
    isVisible: data?.isVisible !== false,
    createdAt: (data?.createdAt as string) || nowIso(),
    updatedAt: (data?.updatedAt as string) || nowIso()
  };
}

function isProfileOnboarded(profile: Profile | null): boolean {
  if (!profile) return false;
  return Boolean(profile.displayName?.trim() && profile.bio?.trim() && profile.profession?.trim());
}

function clipList(list: string[] | undefined, maxItems: number, maxLen: number): string[] {
  return (list || []).slice(0, maxItems).map((s) => String(s).slice(0, maxLen));
}

function firestoreProfilePayload(profile: Partial<Profile> & { id: string; userId: string; createdAt: string }): Record<string, unknown> {
  const photoUrl = profile.photos?.[0];
  const lifestyle = profile.lifestyle || {};
  return {
    id: profile.id,
    userId: profile.userId,
    displayName: (profile.displayName || 'Member').slice(0, 60),
    age: typeof profile.age === 'number' ? Math.round(profile.age) : 28,
    gender: profile.gender || 'male',
    location: (profile.location || 'Lagos, Nigeria').slice(0, 100),
    profession: (profile.profession || '').slice(0, 100),
    education: (profile.education || '').slice(0, 120),
    bio: (profile.bio || '').slice(0, 1000),
    relationshipGoal: (profile.relationshipGoal || 'Intentional marriage').slice(0, 100),
    isVerified: Boolean(profile.isVerified),
    isVisible: profile.isVisible !== false,
    createdAt: profile.createdAt,
    updatedAt: nowIso(),
    interests: clipList(profile.interests, 12, 80),
    values: clipList(profile.values, 12, 80),
    lifestyle: {
      ...(lifestyle.faith ? { faith: String(lifestyle.faith).slice(0, 40) } : {}),
      ...(lifestyle.smoking ? { smoking: lifestyle.smoking } : {}),
      ...(lifestyle.drinking ? { drinking: lifestyle.drinking } : {}),
      ...(lifestyle.exercise ? { exercise: lifestyle.exercise } : {}),
      ...(lifestyle.kids ? { kids: lifestyle.kids } : {})
    },
    ...(photoUrl && photoUrl.startsWith('https://') ? { photoUrl: photoUrl.slice(0, 2000) } : {}),
    ...(profile.photos && profile.photos.length
      ? { photoUrls: profile.photos.filter((u) => u.startsWith('https://')).slice(0, 3).map((u) => u.slice(0, 2000)) }
      : {})
  };
}

function loadExtras(uid: string): Partial<Profile> {
  try {
    const raw = localStorage.getItem(`${EXTRAS_STORAGE_KEY}_${uid}`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveExtras(uid: string, extras: Partial<Profile>) {
  const next = {
    photos: extras.photos,
    interests: extras.interests,
    values: extras.values,
    lifestyle: extras.lifestyle
  };
  localStorage.setItem(`${EXTRAS_STORAGE_KEY}_${uid}`, JSON.stringify(next));
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [preferences, setPreferences] = useState<ProfilePreferences | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const hydrateFromFirebaseUser = useCallback(async (fbUser: FirebaseUser) => {
    const uid = fbUser.uid;
    const email = fbUser.email || '';
    const displayName = fbUser.displayName || emailLocalPart(email);

    const userRef = doc(db, 'users', uid);
    const profileRef = doc(db, 'profiles', uid);

    setUser(mapUserDoc(uid, email, undefined, fbUser.phoneNumber || undefined));
    const extras = loadExtras(uid);
    setCurrentProfile(profileFromDoc(uid, undefined, extras));

    try {
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        const payload = {
          id: uid,
          email,
          role: 'client' as const,
          isActive: true,
          createdAt: nowIso()
        };
        await setDoc(userRef, payload);
      }
    } catch (error) {
      console.error('users hydrate failed', error);
    }

    try {
      const profileSnap = await getDoc(profileRef);
      if (!profileSnap.exists()) {
        await setDoc(profileRef, draftProfile(uid, displayName));
      }
    } catch (error) {
      console.error('profiles hydrate failed', error);
    }

    try {
      const [userSnap, profileSnap] = await Promise.all([getDoc(userRef), getDoc(profileRef)]);
      const mappedUser = mapUserDoc(uid, email, userSnap.data() as Partial<User> | undefined, fbUser.phoneNumber || undefined);
      setUser(mappedUser);

      const mappedProfile = profileFromDoc(uid, profileSnap.data() as Record<string, unknown> | undefined, extras);
      setCurrentProfile(mappedProfile);

      const prefRef = doc(db, 'preferences', uid);
      let mappedPrefs: ProfilePreferences | null = null;
      try {
        const prefSnap = await getDoc(prefRef);
        if (prefSnap.exists()) {
          const p = prefSnap.data() as Record<string, unknown>;
          mappedPrefs = {
            id: String(p.id || `pref_${uid}`),
            profileId: uid,
            preferredGender: Array.isArray(p.preferredGender) ? (p.preferredGender as ProfilePreferences['preferredGender']) : ['female'],
            ageMin: typeof p.ageMin === 'number' ? p.ageMin : 24,
            ageMax: typeof p.ageMax === 'number' ? p.ageMax : 35,
            preferredLocations: Array.isArray(p.preferredLocations) ? (p.preferredLocations as string[]) : [mappedProfile.location],
            preferredRelationshipGoals: Array.isArray(p.preferredRelationshipGoals)
              ? (p.preferredRelationshipGoals as string[])
              : [mappedProfile.relationshipGoal]
          };
        }
      } catch {
        mappedPrefs = null;
      }
      if (!mappedPrefs) {
        const savedPrefs = localStorage.getItem(`${PREFS_STORAGE_KEY}_${uid}`);
        mappedPrefs = savedPrefs
          ? JSON.parse(savedPrefs)
          : {
              id: `pref_${uid}`,
              profileId: uid,
              preferredGender: mappedProfile.gender === 'male' ? ['female'] : ['male'],
              ageMin: 24,
              ageMax: 35,
              preferredLocations: [mappedProfile.location || 'Lagos, Nigeria'],
              preferredRelationshipGoals: [mappedProfile.relationshipGoal]
            };
      }
      setPreferences(mappedPrefs);
      localStorage.setItem(`${PREFS_STORAGE_KEY}_${uid}`, JSON.stringify(mappedPrefs));
    } catch (error) {
      console.error('hydrate read failed', error);
    }
  }, []);

  useEffect(() => {
    let unsubUser: (() => void) | undefined;
    let unsubProfile: (() => void) | undefined;

    const completeEmailLinkIfPresent = async () => {
      if (typeof window === 'undefined') return;
      if (isSignInWithEmailLink(auth, window.location.href)) {
        let email = window.localStorage.getItem(EMAIL_LINK_STORAGE_KEY);
        if (!email) {
          email = window.prompt('Confirm your email to complete sign-in') || '';
        }
        if (email) {
          await signInWithEmailLink(auth, email, window.location.href);
          window.localStorage.removeItem(EMAIL_LINK_STORAGE_KEY);
        }
      }
    };

    completeEmailLinkIfPresent().catch((err) => {
      console.error('Email link sign-in failed', err);
      setAuthError(err instanceof Error ? err.message : 'Email link sign-in failed');
    });

    const unsubAuth = onAuthStateChanged(auth, async (fbUser) => {
      unsubUser?.();
      unsubProfile?.();

      if (!fbUser) {
        setUser(null);
        setCurrentProfile(null);
        setPreferences(null);
        setIsLoading(false);
        return;
      }

      // Do not flip isLoading on later auth events (registration). That unmounts
      // OnboardingFlow and resets currentStep back to 1.
      setAuthError(null);
      try {
        await hydrateFromFirebaseUser(fbUser);

        unsubUser = onSnapshot(doc(db, 'users', fbUser.uid), (snap) => {
          if (snap.exists()) {
            setUser(mapUserDoc(fbUser.uid, fbUser.email || '', snap.data() as Partial<User>, fbUser.phoneNumber || undefined));
          }
        });

        unsubProfile = onSnapshot(doc(db, 'profiles', fbUser.uid), (snap) => {
          const extras = loadExtras(fbUser.uid);
          setCurrentProfile(profileFromDoc(fbUser.uid, snap.data() as Record<string, unknown> | undefined, extras));
        });
      } catch (err) {
        console.error(err);
        setAuthError(err instanceof Error ? err.message : 'Failed to load account');
      } finally {
        setIsLoading(false);
      }
    });

    return () => {
      unsubAuth();
      unsubUser?.();
      unsubProfile?.();
    };
  }, [hydrateFromFirebaseUser]);

  const login = async (email: string, password?: string): Promise<boolean> => {
    setAuthError(null);
    if (!password) {
      throw new Error('Password is required');
    }
    const signIn = signInWithEmailAndPassword(auth, email.trim(), password);
    const timeout = new Promise<never>((_, reject) => {
      window.setTimeout(() => reject(new Error('Sign-in timed out. Check Authorized domains and try again.')), 12000);
    });
    await Promise.race([signIn, timeout]);
    return true;
  };

  const register = async (accountData: { email: string; phone?: string; displayName: string; password?: string }) => {
    setAuthError(null);
    if (!accountData.password) {
      throw new Error('Password is required');
    }
    const cred = await createUserWithEmailAndPassword(auth, accountData.email.trim(), accountData.password);
    if (accountData.displayName) {
      await updateAuthProfile(cred.user, { displayName: accountData.displayName });
    }
    if (accountData.phone) {
      try {
        await updateDoc(doc(db, 'users', cred.user.uid), { phone: accountData.phone.slice(0, 32) });
      } catch {
        // user doc may still be creating; hydrate will retry
      }
    }
  };

  const loginWithGoogle = async () => {
    setAuthError(null);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    await signInWithPopup(auth, provider);
  };

  const sendEmailLink = async (email: string) => {
    setAuthError(null);
    await sendSignInLinkToEmail(auth, email.trim(), {
      url: window.location.origin,
      handleCodeInApp: true
    });
    window.localStorage.setItem(EMAIL_LINK_STORAGE_KEY, email.trim());
  };

  const completeOnboarding = async (
    profileData: Partial<Profile>,
    prefsData?: Partial<ProfilePreferences>
  ) => {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;
    const merged: Profile = {
      ...(currentProfile || profileFromDoc(uid, undefined, profileData)),
      ...profileData,
      id: uid,
      userId: uid,
      isVerified: currentProfile?.isVerified ?? false,
      isVisible: true,
      updatedAt: nowIso()
    };

    saveExtras(uid, merged);
    setCurrentProfile(merged);

    const payload = firestoreProfilePayload({
      ...merged,
      createdAt: currentProfile?.createdAt || nowIso()
    });
    const payloadNoPhoto = { ...payload };
    delete payloadNoPhoto.photoUrl;

    const writeProfile = async () => {
      try {
        await updateDoc(doc(db, 'profiles', uid), payload);
        return;
      } catch {
        /* fall through */
      }
      try {
        await setDoc(doc(db, 'profiles', uid), { ...payload, isVerified: false });
        return;
      } catch {
        /* photoUrl may be rejected by older rules */
      }
      try {
        await updateDoc(doc(db, 'profiles', uid), payloadNoPhoto);
      } catch {
        try {
          await setDoc(doc(db, 'profiles', uid), { ...payloadNoPhoto, isVerified: false });
        } catch (err) {
          console.error('Profile save failed', err);
        }
      }
    };

    const timeout = new Promise<void>((resolve) => {
      window.setTimeout(resolve, 8000);
    });
    await Promise.race([writeProfile(), timeout]);

    if (accountPhonePending(profileData) && user) {
      try {
        await updateDoc(doc(db, 'users', uid), { phone: user.phone });
      } catch {
        /* phone is optional */
      }
    }

    const finalPrefs: ProfilePreferences = {
      id: `pref_${uid}`,
      profileId: uid,
      preferredGender: prefsData?.preferredGender || preferences?.preferredGender || ['female'],
      ageMin: prefsData?.ageMin || preferences?.ageMin || 24,
      ageMax: prefsData?.ageMax || preferences?.ageMax || 35,
      preferredLocations: prefsData?.preferredLocations || preferences?.preferredLocations || [merged.location],
      preferredRelationshipGoals: prefsData?.preferredRelationshipGoals || preferences?.preferredRelationshipGoals || [merged.relationshipGoal]
    };
    setPreferences(finalPrefs);
    localStorage.setItem(`${PREFS_STORAGE_KEY}_${uid}`, JSON.stringify(finalPrefs));
    try {
      await setDoc(doc(db, 'preferences', uid), {
        id: finalPrefs.id,
        profileId: uid,
        preferredGender: finalPrefs.preferredGender.slice(0, 4),
        ageMin: finalPrefs.ageMin,
        ageMax: finalPrefs.ageMax,
        preferredLocations: clipList(finalPrefs.preferredLocations, 8, 100),
        preferredRelationshipGoals: clipList(finalPrefs.preferredRelationshipGoals, 6, 100)
      });
    } catch (err) {
      console.error('Preferences save failed', err);
    }
  };

  const updateProfile = (updated: Partial<Profile>) => {
    if (!currentProfile || !auth.currentUser) return;
    const uid = auth.currentUser.uid;
    const merged = { ...currentProfile, ...updated, updatedAt: nowIso() };
    setCurrentProfile(merged);
    saveExtras(uid, merged);

    const allowed = firestoreProfilePayload({
      ...merged,
      isVerified: currentProfile.isVerified,
      createdAt: currentProfile.createdAt
    });
    updateDoc(doc(db, 'profiles', uid), allowed).catch((error) => {
      console.error('Profile update failed', error);
    });
  };

  const updatePreferences = (updated: Partial<ProfilePreferences>) => {
    if (!preferences || !auth.currentUser) return;
    const merged = { ...preferences, ...updated };
    setPreferences(merged);
    localStorage.setItem(`${PREFS_STORAGE_KEY}_${auth.currentUser.uid}`, JSON.stringify(merged));
    setDoc(doc(db, 'preferences', auth.currentUser.uid), {
      id: merged.id,
      profileId: auth.currentUser.uid,
      preferredGender: (merged.preferredGender || []).slice(0, 4),
      ageMin: merged.ageMin,
      ageMax: merged.ageMax,
      preferredLocations: clipList(merged.preferredLocations, 8, 100),
      preferredRelationshipGoals: clipList(merged.preferredRelationshipGoals, 6, 100)
    }).catch((err) => console.error('Preferences update failed', err));
  };

  const logout = () => {
    signOut(auth).catch((err) => console.error(err));
    setUser(null);
    setCurrentProfile(null);
    setPreferences(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        currentProfile,
        preferences,
        isAuthenticated: !!user,
        isOnboarded:
          isProfileOnboarded(currentProfile) ||
          user?.email === SUPER_ADMIN_EMAIL ||
          user?.role === 'admin',
        isLoading,
        isAdmin: user?.role === 'admin' || user?.email === SUPER_ADMIN_EMAIL,
        authError,
        login,
        register,
        loginWithGoogle,
        sendEmailLink,
        completeOnboarding,
        updateProfile,
        updatePreferences,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

function accountPhonePending(_profileData: Partial<Profile>) {
  return false;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
