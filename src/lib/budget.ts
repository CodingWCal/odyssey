/**
 * Pure split-the-bill math for the Budget tab (extracted from SplitSection for
 * testability, ODY-016). Weighted shares: each member's portion of the total
 * spend is weight/sum(weights); with all-zero weights everyone splits equally.
 */

export interface SplitMemberInput {
  id: string;
  /** Relative share weight (>= 0). */
  weight: number;
  /** Total this member has paid so far. */
  paid: number;
}

export interface SplitRow {
  id: string;
  /** Fraction of the total this member owes (0..1). */
  pct: number;
  /** Dollar share of totalSpent. */
  share: number;
  /** paid - share: positive = owed money, negative = owes. */
  balance: number;
}

export function computeSplit(members: SplitMemberInput[], totalSpent: number): SplitRow[] {
  const n = members.length || 1;
  const weights = members.map((m) => Math.max(0, m.weight) || 0);
  const sumW = weights.reduce((s, w) => s + w, 0);

  return members.map((m, i) => {
    const pct = sumW > 0 ? weights[i] / sumW : 1 / n;
    const share = totalSpent * pct;
    return { id: m.id, pct, share, balance: m.paid - share };
  });
}
