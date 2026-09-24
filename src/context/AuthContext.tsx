import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Profile, ProfilePreferences } from '../types';

interface AuthContextType {
  user: User | null;
  currentProfile: Profile | null;
  preferences: ProfilePreferences | null;
  isAuthenticated: boolean;
  isOnboarded: boolean;
  isLoading: boolean;
  login: (email: string) => Promise<boolean>;
  register: (accountData: { email: string; phone?: string; displayName: string }) => Promise<void>;
  completeOnboarding: (profileData: Partial<Profile>, prefsData?: Partial<ProfilePreferences>) => Promise<void>;
  updateProfile: (updated: Partial<Profile>) => void;
  updatePreferences: (updated: Partial<ProfilePreferences>) => void;
  logout: () => void;
}

const DEFAULT_CURRENT_PROFILE: Profile = {
  id: 'prof_me',
  userId: 'usr_me',
  displayName: 'Chukwudi',
  age: 31,
  gender: 'male',
  location: 'Lagos, Nigeria',
  profession: 'Senior Software Architect',
  education: 'M.Sc. Computer Science',
  bio: 'Passionate about technology, thoughtful architecture, and classical jazz. Seeking an intentional partner to build a meaningful, enduring life together.',
  photos: [
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&auto=format&fit=crop&q=80'
  ],
  interests: ['Architecture', 'Literature', 'Jazz', 'Fine Dining', 'Travel'],
  values: ['Faith & Family', 'Continuous Growth', 'Emotional Intelligence', 'Honesty'],
  relationshipGoal: 'Long-term marriage with deep companionship',
  lifestyle: {
    faith: 'Christian',
    smoking: 'no',
    drinking: 'socially',
    exercise: 'active',
    kids: 'wants kids'
  },
  isVerified: true,
  isVisible: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

const DEFAULT_PREFERENCES: ProfilePreferences = {
  id: 'pref_me',
  profileId: 'prof_me',
  preferredGender: ['female'],
  ageMin: 25,
  ageMax: 33,
  preferredLocations: ['Lagos, Nigeria', 'Abuja, Nigeria'],
  preferredRelationshipGoals: ['Long-term marriage with deep companionship', 'Intentional courtship']
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [preferences, setPreferences] = useState<ProfilePreferences | null>(null);
  const [isOnboarded, setIsOnboarded] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const savedUser = localStorage.getItem('lifebencher_user');
    const savedProfile = localStorage.getItem('lifebencher_profile');
    const savedPrefs = localStorage.getItem('lifebencher_prefs');
    const savedOnboarded = localStorage.getItem('lifebencher_onboarded');

    if (savedUser && savedProfile) {
      try {
        setUser(JSON.parse(savedUser));
        setCurrentProfile(JSON.parse(savedProfile));
        setPreferences(savedPrefs ? JSON.parse(savedPrefs) : DEFAULT_PREFERENCES);
        setIsOnboarded(savedOnboarded === 'false' ? false : true);
      } catch (e) {
        console.error('Failed to parse auth cache', e);
      }
    } else {
      // Default initial profile for direct mobile testing
      const defaultUser: User = {
        id: 'usr_me',
        email: 'chukwudi@lifebencher.com',
        role: 'client',
        isActive: true,
        createdAt: new Date().toISOString()
      };
      setUser(defaultUser);
      setCurrentProfile(DEFAULT_CURRENT_PROFILE);
      setPreferences(DEFAULT_PREFERENCES);
      setIsOnboarded(true);
      localStorage.setItem('lifebencher_user', JSON.stringify(defaultUser));
      localStorage.setItem('lifebencher_profile', JSON.stringify(DEFAULT_CURRENT_PROFILE));
      localStorage.setItem('lifebencher_prefs', JSON.stringify(DEFAULT_PREFERENCES));
      localStorage.setItem('lifebencher_onboarded', 'true');
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string): Promise<boolean> => {
    setIsLoading(true);
    // Check if user already exists
    const loggedUser: User = {
      id: 'usr_' + Date.now(),
      email,
      role: 'client',
      isActive: true,
      createdAt: new Date().toISOString()
    };
    setUser(loggedUser);
    setCurrentProfile(DEFAULT_CURRENT_PROFILE);
    setPreferences(DEFAULT_PREFERENCES);
    setIsOnboarded(true);

    localStorage.setItem('lifebencher_user', JSON.stringify(loggedUser));
    localStorage.setItem('lifebencher_profile', JSON.stringify(DEFAULT_CURRENT_PROFILE));
    localStorage.setItem('lifebencher_prefs', JSON.stringify(DEFAULT_PREFERENCES));
    localStorage.setItem('lifebencher_onboarded', 'true');
    setIsLoading(false);
    return true;
  };

  const register = async (accountData: { email: string; phone?: string; displayName: string }) => {
    setIsLoading(true);
    const newUser: User = {
      id: 'usr_' + Date.now(),
      email: accountData.email,
      phone: accountData.phone,
      role: 'client',
      isActive: true,
      createdAt: new Date().toISOString()
    };

    const initialProfile: Profile = {
      id: 'prof_' + Date.now(),
      userId: newUser.id,
      displayName: accountData.displayName,
      age: 28,
      gender: 'male',
      location: 'Lagos, Nigeria',
      profession: '',
      education: '',
      bio: '',
      photos: [
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&auto=format&fit=crop&q=80'
      ],
      interests: [],
      values: [],
      relationshipGoal: 'Intentional marriage',
      lifestyle: {},
      isVerified: false,
      isVisible: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    setUser(newUser);
    setCurrentProfile(initialProfile);
    setIsOnboarded(false);

    localStorage.setItem('lifebencher_user', JSON.stringify(newUser));
    localStorage.setItem('lifebencher_profile', JSON.stringify(initialProfile));
    localStorage.setItem('lifebencher_onboarded', 'false');
    setIsLoading(false);
  };

  const completeOnboarding = async (
    profileData: Partial<Profile>,
    prefsData?: Partial<ProfilePreferences>
  ) => {
    if (!currentProfile) return;
    const finalProfile: Profile = {
      ...currentProfile,
      ...profileData,
      isVerified: true,
      isVisible: true,
      updatedAt: new Date().toISOString()
    };

    const finalPrefs: ProfilePreferences = {
      id: 'pref_' + Date.now(),
      profileId: finalProfile.id,
      preferredGender: prefsData?.preferredGender || ['female'],
      ageMin: prefsData?.ageMin || 24,
      ageMax: prefsData?.ageMax || 35,
      preferredLocations: prefsData?.preferredLocations || ['Lagos, Nigeria'],
      preferredRelationshipGoals: prefsData?.preferredRelationshipGoals || ['Intentional marriage']
    };

    setCurrentProfile(finalProfile);
    setPreferences(finalPrefs);
    setIsOnboarded(true);

    localStorage.setItem('lifebencher_profile', JSON.stringify(finalProfile));
    localStorage.setItem('lifebencher_prefs', JSON.stringify(finalPrefs));
    localStorage.setItem('lifebencher_onboarded', 'true');
  };

  const updateProfile = (updated: Partial<Profile>) => {
    if (!currentProfile) return;
    const merged = { ...currentProfile, ...updated, updatedAt: new Date().toISOString() };
    setCurrentProfile(merged);
    localStorage.setItem('lifebencher_profile', JSON.stringify(merged));
  };

  const updatePreferences = (updated: Partial<ProfilePreferences>) => {
    if (!preferences) return;
    const merged = { ...preferences, ...updated };
    setPreferences(merged);
    localStorage.setItem('lifebencher_prefs', JSON.stringify(merged));
  };

  const logout = () => {
    setUser(null);
    setCurrentProfile(null);
    setPreferences(null);
    setIsOnboarded(false);
    localStorage.removeItem('lifebencher_user');
    localStorage.removeItem('lifebencher_profile');
    localStorage.removeItem('lifebencher_prefs');
    localStorage.removeItem('lifebencher_onboarded');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        currentProfile,
        preferences,
        isAuthenticated: !!user,
        isOnboarded,
        isLoading,
        login,
        register,
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

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
