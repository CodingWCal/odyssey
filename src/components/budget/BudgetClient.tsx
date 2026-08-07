"use client";

import { useState, useRef, useLayoutEffect, useTransition } from "react";
import { Icons } from "@/components/shared/Icons";
import { AvatarStack } from "@/components/shared/AvatarStack";
import { CATEGORIES, CAT_LABEL, CAT_ICON, type Category } from "./categories";
import { ExpenseModal, type ExpenseInitial } from "./ExpenseModal";
import { updateTripBudget, updateSplitWeights, recordSettlement, deleteSettlement } from "@/app/trips/[tripId]/budget/actions";
import { toast } from "@/components/shared/Toast";
import { suggestSettlements, type SplitRow } from "@/lib/budget";

/** A recorded settle-up payment outside the expense ledger (ODY-107). */
export interface RecordedSettlement {
  id: string;
  fromUserId: string;
  fromName: string;
  toUserId: string;
  toName: string;
  amount: number;
  createdAt: string;
}

export interface BudgetExpense {
  id: string;
  label: string;
  amount: number;
  category: Category;
  who: string;
  eventTitle: string | null;
  /** Resolved payer userId (paidBy ?? addedBy) — ODY-094. */
  paidBy: string;
  splitMode: "equal" | "exact";
  shares: { userId: string; amountCents: number }[];
}

export interface SplitMember {
  id: string;
  userId: string;
  name: string;
  weight: number;
  /** Real amount paid, resolved from paidBy across every expense. */
  paid: number;
  /** Real amount owed, aggregated from actual per-expense participation (ODY-094). */
  owed: number;
  /** paid - owed, adjusted for recorded settlements (ODY-107) — the true
   * outstanding amount. Use this for balance display, not paid - owed. */
  balance: number;
}

interface BudgetClientProps {
  tripId: string;
  totalBudget: number | null;
  eyebrow: string;
  members: { id: string; name: string }[];
  /** Trip members by userId, for the expense "who's involved" picker (ODY-094). */
  tripMembers: { userId: string; name: string }[];
  /** The signed-in viewer's userId — defaults "Paid by" on a new expense (ODY-094). */
  currentUserId: string;
  splitMembers: SplitMember[];
  expenses: BudgetExpense[];
  /** Past settle-up payments (ODY-107). */
  settlements: RecordedSettlement[];
  /** Viewers get a read-only budget (ODY-001). */
  readOnly?: boolean;
}

function fmtMoney(n: number) {
  return "$" + Math.round(Number(n) || 0).toLocaleString("en-US");
}

function CategoryBlock({
  category,
  expenses,
  total,
  grandTotal,
  onAdd,
  onEdit,
  readOnly,
}: {
  category: Category;
  expenses: BudgetExpense[];
  total: number;
  grandTotal: number;
  onAdd: (c: Category) => void;
  onEdit: (e: BudgetExpense) => void;
  readOnly?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  // Collapse animation: write max-height straight to the DOM node (external
  // system) instead of routing measured pixels through state.
  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    if (collapsed) {
      el.style.maxHeight = "0px";
    } else {
      el.style.maxHeight = el.scrollHeight + "px";
      const t = setTimeout(() => {
        el.style.maxHeight = "4000px";
      }, 350);
      return () => clearTimeout(t);
    }
  }, [collapsed, expenses.length]);

  const Icon = CAT_ICON[category];
  const pct = grandTotal ? (total / grandTotal) * 100 : 0;

  return (
    <section className={`cat-block c-${category} ${collapsed ? "collapsed" : ""}`}>
      <header className="cat-head" onClick={() => setCollapsed((c) => !c)}>
        <svg className="chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
        <span className="cat-icon"><Icon size={18} /></span>
        <div>
          <h2 className="cat-title">{CAT_LABEL[category]}</h2>
          <div className="cat-meta">{expenses.length} expense{expenses.length === 1 ? "" : "s"}</div>
        </div>
        <div className="cat-total">
          {fmtMoney(total)}
          <span className="pct">{pct.toFixed(0)}% of trip</span>
        </div>
      </header>

      <div className="cat-body" ref={bodyRef}>
        <div className="expense-list">
          {expenses.map((e) => (
            <div className={`expense-row c-${e.category}`} key={e.id}>
              <div className="label-block">
                <div className="lbl">
                  <span>{e.label}</span>
                  {e.eventTitle && <span className="link-tag">↪ Itinerary</span>}
                </div>
                <span className="sub">Paid by {e.who}{e.eventTitle ? ` · linked to "${e.eventTitle}"` : ""}</span>
              </div>
              <div className="amount">{fmtMoney(e.amount)}</div>
              {!readOnly && (
                <div className="row-actions">
                  <button className="icon-btn" onClick={() => onEdit(e)} aria-label="Edit"><Icons.edit size={13} /></button>
                </div>
              )}
            </div>
          ))}
        </div>
        {!readOnly && (
          <button className="cat-add" onClick={() => onAdd(category)}>
            <span className="plus"><Icons.plus size={12} /></span>
            <span>Add {CAT_LABEL[category].toLowerCase()} expense</span>
          </button>
        )}
      </div>
    </section>
  );
}

function SplitSection({
  tripId,
  members,
  recordedSettlements,
}: {
  tripId: string;
  members: SplitMember[];
  recordedSettlements: RecordedSettlement[];
}) {
  const [isPending, startTransition] = useTransition();
  const [isSettling, startSettling] = useTransition();
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [weights, setWeights] = useState<Record<string, string>>(
    Object.fromEntries(members.map((m) => [m.id, String(m.weight)]))
  );

  // Rows reflect real per-expense participation (ODY-094 Stage B), not a
  // hypothetical even split of the trip total. `weights` here only sets the
  // *default* for future uncustomized expenses (`pct` shown is that default,
  // for context) — it no longer drives the displayed share/balance.
  const sumWeights = members.reduce((s, m) => s + (Number(weights[m.id]) || 0), 0);
  const rows: SplitRow[] = members.map((m) => {
    const w = Number(weights[m.id]) || 0;
    const pct = sumWeights > 0 ? w / sumWeights : 1 / (members.length || 1);
    return { id: m.id, pct, share: m.owed, balance: m.balance };
  });
  const nameById = Object.fromEntries(members.map((m) => [m.id, m.name]));
  const userIdById = Object.fromEntries(members.map((m) => [m.id, m.userId]));
  const suggested = suggestSettlements(rows);

  const dirty = members.some((m) => (Number(weights[m.id]) || 0) !== m.weight);

  function setW(id: string, v: string) {
    setWeights((s) => ({ ...s, [id]: v }));
  }

  function resetEqual() {
    setWeights(Object.fromEntries(members.map((m) => [m.id, "1"])));
  }

  function save() {
    startTransition(async () => {
      try {
        await updateSplitWeights({
          tripId,
          weights: members.map((m) => ({ memberId: m.id, weight: Math.max(0, Number(weights[m.id]) || 0) })),
        });
        toast("Split saved.", "success");
      } catch {
        toast("The split didn't save — try again.");
      }
    });
  }

  function markPaid(t: { fromId: string; toId: string; amount: number }) {
    const key = `${t.fromId}-${t.toId}-${t.amount}`;
    setPendingKey(key);
    startSettling(async () => {
      try {
        await recordSettlement({
          tripId,
          fromUserId: userIdById[t.fromId],
          toUserId: userIdById[t.toId],
          amountCents: Math.round(t.amount * 100),
        });
        toast("Marked as paid.", "success");
      } catch {
        toast("Couldn't mark that as paid — try again.");
      } finally {
        setPendingKey(null);
      }
    });
  }

  function undoSettlement(id: string) {
    startSettling(async () => {
      try {
        await deleteSettlement(id, tripId);
      } catch {
        toast("Couldn't undo that — try again.");
      }
    });
  }

  return (
    <div className="split-card">
      <div className="split-head">
        <div className="left">
          <div className="label">Split between travelers</div>
          <div className="sub">Balances reflect who&apos;s actually on each expense — weights below only set the default for new expenses you don&apos;t customize.</div>
        </div>
        <button className="btn btn-ghost" onClick={resetEqual} disabled={isPending} type="button">
          Reset to equal
        </button>
      </div>

      <div className="split-rows">
        {members.map((m, i) => {
          const { pct, share, balance } = rows[i];
          const rounded = Math.round(balance * 100) / 100;
          return (
            <div className="split-row" key={m.id}>
              <span className="who">{m.name}</span>
              <div className="weight">
                <input
                  className="input mono"
                  inputMode="decimal"
                  value={weights[m.id] ?? ""}
                  onChange={(e) => setW(m.id, e.target.value)}
                  aria-label={`${m.name} share weight`}
                />
                <span className="pct">{(pct * 100).toFixed(0)}%</span>
              </div>
              <div className="split-metrics">
                <span className="share">{fmtMoney(share)}<span className="lbl">share</span></span>
                <span className="paid">{fmtMoney(m.paid)}<span className="lbl">paid</span></span>
                <span className={`balance ${rounded > 0 ? "pos" : rounded < 0 ? "neg" : "even"}`}>
                  {rounded > 0 ? `+${fmtMoney(rounded)}` : rounded < 0 ? `−${fmtMoney(Math.abs(rounded))}` : "settled"}
                  <span className="lbl">{rounded > 0 ? "owed" : rounded < 0 ? "owes" : ""}</span>
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {suggested.length > 0 && (
        <div className="settle-list" aria-label="Settle up">
          <div className="settle-label">Settle up</div>
          <ul>
            {suggested.map((t) => {
              const key = `${t.fromId}-${t.toId}-${t.amount}`;
              return (
                <li key={key}>
                  <strong>{nameById[t.fromId] ?? "Traveler"}</strong>
                  {" pays "}
                  <strong>{nameById[t.toId] ?? "Traveler"}</strong>
                  <span className="settle-amt">{fmtMoney(t.amount)}</span>
                  <button
                    type="button"
                    className="btn btn-ghost sm"
                    onClick={() => markPaid(t)}
                    disabled={isSettling}
                  >
                    {isSettling && pendingKey === key ? "Marking…" : "Mark as paid"}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {recordedSettlements.length > 0 && (
        <div className="settle-list settled" aria-label="Settled payments">
          <div className="settle-label">Settled</div>
          <ul>
            {recordedSettlements.map((s) => (
              <li key={s.id}>
                <strong>{s.fromName}</strong>
                {" paid "}
                <strong>{s.toName}</strong>
                <span className="settle-amt">{fmtMoney(s.amount)}</span>
                <button
                  type="button"
                  className="icon-btn sm"
                  onClick={() => undoSettlement(s.id)}
                  disabled={isSettling}
                  aria-label="Undo this settlement"
                  title="Undo"
                >
                  <Icons.trash size={13} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="split-foot">
        <button className="btn-cta" onClick={save} disabled={!dirty || isPending} type="button">
          {isPending ? "Saving…" : "Save split"}
        </button>
      </div>
    </div>
  );
}

export function BudgetClient({ tripId, totalBudget, eyebrow, members, tripMembers, currentUserId, splitMembers, expenses, settlements, readOnly = false }: BudgetClientProps) {
  const [modal, setModal] = useState<{ open: boolean; mode: "add" | "edit"; initial: ExpenseInitial | null }>({
    open: false,
    mode: "add",
    initial: null,
  });
  const [budgetVal, setBudgetVal] = useState(totalBudget != null ? String(totalBudget) : "");

  const totalSpent = expenses.reduce((s, e) => s + e.amount, 0);
  const budget = totalBudget ?? 0;
  const remaining = budget - totalSpent;
  const pct = budget > 0 ? Math.min(100, (totalSpent / budget) * 100) : 0;
  const perPerson = members.length ? totalSpent / members.length : totalSpent;

  // Is the budget shared equally, or has a custom split been set? Drives the
  // hero summary so it stays in sync with the "Split between travelers" card.
  const splitIsEqual = splitMembers.every((m) => m.weight === (splitMembers[0]?.weight ?? 1));

  const catTotals: Record<string, number> = {};
  for (const e of expenses) catTotals[e.category] = (catTotals[e.category] ?? 0) + e.amount;
  const byCategory = CATEGORIES.map((c) => ({
    category: c,
    total: catTotals[c] ?? 0,
    list: expenses.filter((e) => e.category === c),
  })).filter((g) => g.list.length > 0);
  const activeCatCount = CATEGORIES.filter((c) => (catTotals[c] ?? 0) > 0).length;

  function openAdd(category: Category | null) {
    setModal({ open: true, mode: "add", initial: category ? { category } : null });
  }
  function openEdit(e: BudgetExpense) {
    setModal({
      open: true,
      mode: "edit",
      initial: {
        id: e.id,
        label: e.label,
        amount: e.amount,
        category: e.category,
        paidBy: e.paidBy,
        splitMode: e.splitMode,
        shares: e.shares,
      },
    });
  }

  async function saveBudget() {
    const n = Number(budgetVal) || 0;
    if (n === budget) return;
    try {
      await updateTripBudget(tripId, n);
    } catch {
      setBudgetVal(totalBudget != null ? String(totalBudget) : "");
      toast("The budget didn't save — try again.");
    }
  }

  return (
    <div className="canvas">
      {/* Hero */}
      <section className="hero budget-hero" aria-label="Budget overview">
        <div className="hero-top">
          <div className="left">
            <div className="hero-eyebrow">{eyebrow}</div>
            <h1 className="hero-title">Budget &amp; <em>receipts</em></h1>
          </div>
          {members.length > 0 && (
            <div className="hero-people" title="Collaborators">
              <AvatarStack members={members} />
              <span>{members.length} traveler{members.length !== 1 ? "s" : ""}</span>
            </div>
          )}
        </div>

        <div className="hero-figure">
          <span className="figure-spent">{fmtMoney(totalSpent)}</span>
          {budget > 0 && <span className="figure-of">spent of {fmtMoney(budget)}</span>}
        </div>
        {budget > 0 && (
          <div className="progress" aria-label={`${pct.toFixed(0)} percent of budget spent`}>
            <div className="progress-fill fill-w" style={{ "--w": pct + "%" } as React.CSSProperties} />
          </div>
        )}
        <div className="progress-meta">
          <span className="left">
            {budget > 0 ? `${pct.toFixed(1)}% used · ` : ""}
            {remaining >= 0 ? `${fmtMoney(Math.max(0, remaining))} remaining` : `${fmtMoney(Math.abs(remaining))} over`}
          </span>
          {members.length > 1 && totalSpent > 0 && (
            splitIsEqual ? (
              <span className="pp">
                <span>≈</span>
                <span className="num">{fmtMoney(perPerson)}</span>
                <span>per person</span>
              </span>
            ) : (
              <span className="pp">
                <span className="num">Custom split</span>
                <span>see breakdown below</span>
              </span>
            )
          )}
        </div>
      </section>

      {/* Trip budget editor */}
      {!readOnly && (
        <div className="budget-set">
          <div className="left">
            <div className="label">Trip budget</div>
            <div className="sub">A soft ceiling — we&apos;ll warn before you blow past it.</div>
          </div>
          <div className="right">
            <div className="input-with-prefix">
              <span className="prefix">$</span>
              <input
                className="input mono"
                inputMode="decimal"
                value={budgetVal}
                onChange={(e) => setBudgetVal(e.target.value)}
                onBlur={saveBudget}
                onKeyDown={(e) => { if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur(); }}
                placeholder="0"
              />
            </div>
          </div>
        </div>
      )}

      {/* Split between travelers */}
      {splitMembers.length > 0 && !readOnly && (
        <SplitSection tripId={tripId} members={splitMembers} recordedSettlements={settlements} />
      )}

      {/* Breakdown bar */}
      {totalSpent > 0 && (
        <div className="cat-bar-card">
          <div className="cat-bar-head">
            <h3>How it breaks down</h3>
            <span className="total">{fmtMoney(totalSpent)} across {activeCatCount} categor{activeCatCount === 1 ? "y" : "ies"}</span>
          </div>
          <div className="cat-bar" role="img" aria-label="Category breakdown bar">
            {CATEGORIES.map((c) => {
              const v = catTotals[c] ?? 0;
              if (v === 0) return null;
              return <div key={c} className={`seg seg-grow c-${c}`} style={{ "--grow": v } as React.CSSProperties} title={`${CAT_LABEL[c]} — ${fmtMoney(v)}`} />;
            })}
          </div>
          <div className="cat-legend">
            {CATEGORIES.map((c) => {
              const v = catTotals[c] ?? 0;
              if (v === 0) return null;
              const p = totalSpent ? (v / totalSpent) * 100 : 0;
              return (
                <span key={c} className={`item c-${c}`}>
                  <span className="swatch" />
                  <span>{CAT_LABEL[c]}</span>
                  <span className="amount">{fmtMoney(v)}</span>
                  <span className="pct">{p.toFixed(0)}%</span>
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* By category */}
      <div className="page-bar">
        <h2>By category</h2>
        {!readOnly && (
          <button className="btn-cta" onClick={() => openAdd(null)}>
            <Icons.plus size={14} /> Add expense
          </button>
        )}
      </div>

      {byCategory.length === 0 ? (
        <div className="budget-empty">
          <p className="glyph" aria-hidden="true">💰</p>
          <p className="headline">No expenses yet.</p>
          <p className="sub">Add one above, or set a cost on an itinerary event.</p>
        </div>
      ) : (
        byCategory.map((g) => (
          <CategoryBlock
            key={g.category}
            category={g.category}
            expenses={g.list}
            total={g.total}
            grandTotal={totalSpent}
            onAdd={openAdd}
            onEdit={openEdit}
            readOnly={readOnly}
          />
        ))
      )}

      <ExpenseModal
        open={modal.open}
        tripId={tripId}
        mode={modal.mode}
        initial={modal.initial}
        tripMembers={tripMembers}
        currentUserId={currentUserId}
        onClose={() => setModal((m) => ({ ...m, open: false }))}
      />
    </div>
  );
}
