import { CompatibilityResult } from './compatibility';

export function whyMatchedLines(result: CompatibilityResult | null | undefined): string[] {
  if (!result) return [];
  const lines: string[] = [];
  if (result.breakdown.goalsMatch) lines.push('Similar relationship goal');
  if (result.breakdown.valuesSharedCount > 0) {
    lines.push(`${result.breakdown.valuesSharedCount} shared value${result.breakdown.valuesSharedCount === 1 ? '' : 's'}`);
  }
  if (result.breakdown.lifestyleMatch) lines.push('Compatible lifestyle notes');
  if (result.breakdown.interestsSharedCount > 0) {
    lines.push(`${result.breakdown.interestsSharedCount} shared interest${result.breakdown.interestsSharedCount === 1 ? '' : 's'}`);
  }
  if (result.breakdown.locationMatch) lines.push('Location overlap');
  return lines.slice(0, 4);
}
