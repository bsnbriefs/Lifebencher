import { Profile, User } from '../types';

/**
 * Standardized Name Resolution Engine for Lifebencher Match
 * 
 * Priority:
 * 1. Legitimate profile displayName (non-empty, not generic 'Member')
 * 2. Firebase Auth / User displayName
 * 3. Legitimate profile username
 * 4. Fallback ONLY if absolutely no name exists ('Intentional Candidate')
 */
export function resolveDisplayName(
  profile?: Partial<Profile> | null,
  user?: Partial<User> | { displayName?: string | null } | null
): string {
  // Check profile.displayName
  if (profile?.displayName) {
    const trimmed = profile.displayName.trim();
    if (trimmed && trimmed.toLowerCase() !== 'member') {
      return trimmed;
    }
  }

  // Check user displayName
  if (user && 'displayName' in user && user.displayName) {
    const trimmed = String(user.displayName).trim();
    if (trimmed && trimmed.toLowerCase() !== 'member') {
      return trimmed;
    }
  }

  // Check username field if present
  const profileAny = profile as Record<string, unknown> | undefined;
  if (profileAny && typeof profileAny.username === 'string') {
    const trimmed = profileAny.username.trim();
    if (trimmed && trimmed.toLowerCase() !== 'member') {
      return trimmed;
    }
  }

  // Fallback
  return 'Intentional Candidate';
}

/**
 * Helper to ensure a profile does not store or fall back to 'Member'
 */
export function sanitizeDisplayName(name?: string | null): string {
  if (!name) return 'Intentional Candidate';
  const trimmed = name.trim();
  if (!trimmed || trimmed.toLowerCase() === 'member') {
    return 'Intentional Candidate';
  }
  return trimmed;
}
