import { Profile, ProfilePreferences } from '../types';

export interface CompatibilityResult {
  score: number;
  summary: string;
  breakdown: {
    goalsMatch: boolean;
    valuesSharedCount: number;
    lifestyleMatch: boolean;
    interestsSharedCount: number;
    locationMatch: boolean;
  };
}

export interface CompatibilityWeights {
  goalsWeight: number; // e.g. 0.30
  valuesWeight: number; // e.g. 0.25
  lifestyleWeight: number; // e.g. 0.20
  interestsWeight: number; // e.g. 0.15
  locationWeight: number; // e.g. 0.10
}

export const DEFAULT_COMPATIBILITY_WEIGHTS: CompatibilityWeights = {
  goalsWeight: 0.30,
  valuesWeight: 0.25,
  lifestyleWeight: 0.20,
  interestsWeight: 0.15,
  locationWeight: 0.10
};

/**
 * Calculates a transparent, modular compatibility score between two profiles
 * based on structured goals, core values, lifestyle, interests, and preferences.
 */
export function calculateCompatibility(
  myProfile: Profile,
  targetProfile: Profile,
  myPreferences?: ProfilePreferences | null,
  weights: CompatibilityWeights = DEFAULT_COMPATIBILITY_WEIGHTS
): CompatibilityResult {
  let score = 50; // baseline score for any verified eligible member

  // 1. Relationship Goals Alignment (30%)
  const goalsNormalized1 = (myProfile.relationshipGoal || '').toLowerCase();
  const goalsNormalized2 = (targetProfile.relationshipGoal || '').toLowerCase();
  const goalsMatch =
    goalsNormalized1.includes('marriage') === goalsNormalized2.includes('marriage') ||
    goalsNormalized1.includes('long-term') === goalsNormalized2.includes('long-term');

  if (goalsMatch) {
    score += weights.goalsWeight * 100 * 0.5;
  }

  // 2. Shared Core Values Overlap (25%)
  const myValues = myProfile.values || [];
  const targetValues = targetProfile.values || [];
  const sharedValues = myValues.filter((v) =>
    targetValues.some((tv) => tv.toLowerCase() === v.toLowerCase())
  );
  const valuesRatio = Math.min(sharedValues.length / 3, 1);
  score += valuesRatio * (weights.valuesWeight * 100 * 0.5);

  // 3. Lifestyle Compatibility (Faith, Kids, Habits) (20%)
  let lifestylePoints = 0;
  if (myProfile.lifestyle?.faith && targetProfile.lifestyle?.faith) {
    if (myProfile.lifestyle.faith.toLowerCase() === targetProfile.lifestyle.faith.toLowerCase()) {
      lifestylePoints += 0.5;
    }
  } else {
    lifestylePoints += 0.25;
  }

  if (myProfile.lifestyle?.kids && targetProfile.lifestyle?.kids) {
    if (
      myProfile.lifestyle.kids === targetProfile.lifestyle.kids ||
      myProfile.lifestyle.kids.includes('kids') && targetProfile.lifestyle.kids.includes('kids')
    ) {
      lifestylePoints += 0.5;
    }
  } else {
    lifestylePoints += 0.25;
  }
  score += lifestylePoints * (weights.lifestyleWeight * 100 * 0.5);

  // 4. Shared Interests (15%)
  const myInterests = myProfile.interests || [];
  const targetInterests = targetProfile.interests || [];
  const sharedInterests = myInterests.filter((i) =>
    targetInterests.some((ti) => ti.toLowerCase() === i.toLowerCase())
  );
  const interestsRatio = Math.min(sharedInterests.length / 2, 1);
  score += interestsRatio * (weights.interestsWeight * 100 * 0.5);

  // 5. Age & Location Preferences (10%)
  let locMatch = false;
  if (myPreferences) {
    const ageInRange =
      targetProfile.age >= myPreferences.ageMin && targetProfile.age <= myPreferences.ageMax;
    if (ageInRange) score += 3;

    locMatch = myPreferences.preferredLocations.some((loc) =>
      targetProfile.location.toLowerCase().includes(loc.toLowerCase().split(',')[0])
    );
    if (locMatch) score += 2;
  } else {
    locMatch = true;
    score += 4;
  }

  // Final bounded integer score between 65% and 98%
  const finalScore = Math.min(Math.max(Math.round(score), 68), 98);

  // Generate tailored contextual description
  let summary = 'Strong alignment in relationship goals and life intentions.';
  if (sharedValues.length >= 2 && goalsMatch) {
    summary = `High congruence in ${sharedValues.slice(0, 2).join(' & ')} and shared marriage vision.`;
  } else if (goalsMatch) {
    summary = 'Harmonious relationship direction and compatible lifestyle habits.';
  } else if (sharedInterests.length >= 2) {
    summary = `Mutual interest in ${sharedInterests.slice(0, 2).join(' and ')}.`;
  }

  return {
    score: finalScore,
    summary,
    breakdown: {
      goalsMatch,
      valuesSharedCount: sharedValues.length,
      lifestyleMatch: lifestylePoints >= 0.5,
      interestsSharedCount: sharedInterests.length,
      locationMatch: locMatch
    }
  };
}
