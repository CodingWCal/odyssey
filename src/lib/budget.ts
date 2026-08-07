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
// ─── Per-expense participant shares (ODY-094) ──────────────────────────────

/** Cent-reconciled weighted allocation, keyed by userId — the shared engine
 * behind both a brand-new expense's default shares (trip-wide weights) and
 * a customized expense's "Equal" mode among just the selected people
 * (uniform weight = 1 each). */
export function weightedSharesCents(
  members: { userId: string; weight: number }[],
  totalCents: number
): { userId: string; amountCents: number }[] {
  const n = members.length || 1;
  const weights = members.map((m) => Math.max(0, m.weight) || 0);
  const sumW = weights.reduce((s, w) => s + w, 0);
  const pcts = members.map((_, i) => (sumW > 0 ? weights[i] / sumW : 1 / n));
  const raw = pcts.map((p) => p * totalCents);
  const cents = allocateCents(raw, totalCents);
  return members.map((m, i) => ({ userId: m.userId, amountCents: cents[i] }));
}

/** Uniform equal split among the given people — "Equal" mode once someone
 * has customized who's on an expense (weight ratios stop being meaningful
 * for an ad-hoc subset). */
export function equalSharesCents(userIds: string[], totalCents: number): { userId: string; amountCents: number }[] {
  return weightedSharesCents(userIds.map((userId) => ({ userId, weight: 1 })), totalCents);
}

export interface ResolvedExpenseForBalances {
  amountCents: number;
  /** Resolved payer — Expense.paidBy ?? addedBy. */
  paidByUserId: string;
  /** Resolved per-person owed amounts — real ExpenseShare rows, or a
   * synthesized weighted fallback for expenses that predate this feature. */
  shares: { userId: string; amountCents: number }[];
}

export interface MemberBalance {
  userId: string;
  paidCents: number;
  owedCents: number;
  /** paid - owed, adjusted for recorded settlements: positive = owed money, negative = owes. */
  balanceCents: number;
}

/** A recorded settle-up payment outside the expense ledger (ODY-107), e.g.
 * "Sam Venmo'd Alex $30." */
export interface ResolvedSettlement {
  fromUserId: string;
  toUserId: string;
  amountCents: number;
}

/**
 * Real per-member balances aggregated across every expense's actual
 * participants (ODY-094 Stage B) — replaces treating the trip total as one
 * pool split by trip-wide weight. Contributions referencing a userId no
 * longer on the trip are dropped (consistent with prior addedBy-keyed
 * behavior; departed-member attribution is out of scope here).
 *
 * `settlements` (ODY-107) adjust only the final balance, not paid/owed —
 * those two stay pure expense figures for display. A settlement moves the
 * payer's balance toward zero (their debt shrinks) and the receiver's
 * balance toward zero (they've now collected what they were owed).
 */
export function aggregateBalances(
  memberUserIds: string[],
  expenses: ResolvedExpenseForBalances[],
  settlements: ResolvedSettlement[] = []
): MemberBalance[] {
  const paid = new Map<string, number>(memberUserIds.map((id) => [id, 0]));
  const owed = new Map<string, number>(memberUserIds.map((id) => [id, 0]));
  const settled = new Map<string, number>(memberUserIds.map((id) => [id, 0]));

  for (const exp of expenses) {
    if (paid.has(exp.paidByUserId)) {
      paid.set(exp.paidByUserId, (paid.get(exp.paidByUserId) ?? 0) + exp.amountCents);
    }
    for (const s of exp.shares) {
      if (owed.has(s.userId)) {
        owed.set(s.userId, (owed.get(s.userId) ?? 0) + s.amountCents);
      }
    }
  }

  for (const s of settlements) {
    if (settled.has(s.fromUserId)) settled.set(s.fromUserId, (settled.get(s.fromUserId) ?? 0) + s.amountCents);
    if (settled.has(s.toUserId)) settled.set(s.toUserId, (settled.get(s.toUserId) ?? 0) - s.amountCents);
  }

  return memberUserIds.map((userId) => {
    const paidCents = paid.get(userId) ?? 0;
    const owedCents = owed.get(userId) ?? 0;
    const settledCents = settled.get(userId) ?? 0;
    return { userId, paidCents, owedCents, balanceCents: paidCents - owedCents + settledCents };
  });
}

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
