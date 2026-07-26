/**
 * Pure split-the-bill math for the Budget tab (extracted from SplitSection for
 * testability, ODY-016 / ODY-030 / ODY-094). Weighted shares: each member's
 * portion of the total spend is weight/sum(weights); with all-zero weights
 * everyone splits equally. Shares are rounded to cents so they always sum to
 * totalSpent (largest-remainder).
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
  /** Dollar share of totalSpent (cents-reconciled). */
  share: number;
  /** paid - share: positive = owed money, negative = owes. */
  balance: number;
}

export interface Settlement {
  /** Debtor member id (owes money). */
  fromId: string;
  /** Creditor member id (is owed). */
  toId: string;
  /** Amount in dollars (2 decimal places). */
  amount: number;
}

function roundCents(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Distribute `totalCents` across `n` parts using largest-remainder on raw fractions. */
function allocateCents(raw: number[], totalCents: number): number[] {
  const floors = raw.map((r) => Math.floor(r));
  let rem = totalCents - floors.reduce((s, x) => s + x, 0);
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac);
  const out = [...floors];
  for (let k = 0; k < order.length && rem > 0; k++) {
    out[order[k].i] += 1;
    rem -= 1;
  }
  return out;
}

export function computeSplit(members: SplitMemberInput[], totalSpent: number): SplitRow[] {
  const n = members.length || 1;
  const weights = members.map((m) => Math.max(0, m.weight) || 0);
  const sumW = weights.reduce((s, w) => s + w, 0);
  const totalCents = Math.round(Math.max(0, totalSpent) * 100);

  const pcts = members.map((_, i) => (sumW > 0 ? weights[i] / sumW : 1 / n));
  const rawCents = pcts.map((p) => p * totalCents);
  const shareCents = allocateCents(rawCents, totalCents);

  return members.map((m, i) => {
    const share = shareCents[i] / 100;
    const paid = roundCents(m.paid);
    return {
      id: m.id,
      pct: pcts[i],
      share,
      balance: roundCents(paid - share),
    };
  });
}

/**
 * Minimal transfer set so everyone settles (ODY-030). Greedy: largest debtor
 * pays largest creditor until balances clear (within 1¢).
 */
export function suggestSettlements(rows: SplitRow[]): Settlement[] {
  const debtors = rows
    .filter((r) => r.balance < -0.004)
    .map((r) => ({ id: r.id, amt: roundCents(-r.balance) }))
    .sort((a, b) => b.amt - a.amt);
  const creditors = rows
    .filter((r) => r.balance > 0.004)
    .map((r) => ({ id: r.id, amt: roundCents(r.balance) }))
    .sort((a, b) => b.amt - a.amt);

  const out: Settlement[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].amt, creditors[j].amt);
    if (pay >= 0.01) {
      out.push({
        fromId: debtors[i].id,
        toId: creditors[j].id,
        amount: roundCents(pay),
      });
    }
    debtors[i].amt = roundCents(debtors[i].amt - pay);
    creditors[j].amt = roundCents(creditors[j].amt - pay);
    if (debtors[i].amt < 0.01) i += 1;
    if (creditors[j].amt < 0.01) j += 1;
  }
  return out;
}
