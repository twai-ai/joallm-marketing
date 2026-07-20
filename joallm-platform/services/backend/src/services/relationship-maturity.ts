/**
 * Constitutional relationship maturity — Evidence-backed evolution stages.
 * Prefer upgrade-only transitions so noisy status events never downgrade a Person.
 */

export type RelationshipMaturity =
  | 'unknown'
  | 'observed'
  | 'identified'
  | 'engaged'
  | 'participating'
  | 'contributing'
  | 'leading'
  | 'mentoring'
  | 'partnering';

const MATURITY_RANK: Record<RelationshipMaturity, number> = {
  unknown: 0,
  observed: 1,
  identified: 2,
  engaged: 3,
  participating: 4,
  contributing: 5,
  leading: 6,
  mentoring: 7,
  partnering: 8,
};

export function isRelationshipMaturity(value: unknown): value is RelationshipMaturity {
  return typeof value === 'string' && value in MATURITY_RANK;
}

export function maxMaturity(
  a: RelationshipMaturity | null | undefined,
  b: RelationshipMaturity | null | undefined,
): RelationshipMaturity {
  const left = isRelationshipMaturity(a) ? a : 'unknown';
  const right = isRelationshipMaturity(b) ? b : 'unknown';
  return MATURITY_RANK[left] >= MATURITY_RANK[right] ? left : right;
}

/**
 * Derive maturity from interaction volume (Phase A heuristic).
 * Later Evidence layer can raise further (contributing+).
 */
export function maturityFromInteractionCount(interactionCount: number): RelationshipMaturity {
  if (interactionCount >= 5) return 'participating';
  if (interactionCount >= 1) return 'engaged';
  return 'identified';
}

/** Status-only contact (delivery/read) without a prior interaction */
export function maturityFromObservedContact(): RelationshipMaturity {
  return 'observed';
}
