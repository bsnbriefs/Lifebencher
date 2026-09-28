import { Profile, ProfilePreferences } from '../types';

export function profileCompletionPct(profile: Profile | null, prefs?: ProfilePreferences | null): number {
  if (!profile) return 0;
  const checks = [
    Boolean(profile.displayName && profile.displayName.trim() && profile.displayName.toLowerCase() !== 'member'),
    Boolean(profile.age && profile.age >= 18),
    Boolean(profile.location),
    Boolean(profile.profession),
    Boolean(profile.education),
    Boolean(profile.bio && profile.bio.trim().length >= 20),
    Boolean(profile.photos && profile.photos.length >= 2),
    Boolean(profile.relationshipGoal),
    Boolean(profile.values && profile.values.length >= 2),
    Boolean(profile.interests && profile.interests.length >= 2),
    Boolean(prefs && prefs.ageMin && prefs.ageMax)
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}
