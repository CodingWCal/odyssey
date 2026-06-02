"use client";

import { useState, useRef, useLayoutEffect } from "react";
import { Icons } from "@/components/shared/Icons";
import { AvatarStack } from "@/components/shared/AvatarStack";
import { CATEGORIES, CAT_LABEL, CAT_ICON, type Category } from "./categories";
import { ExpenseModal, type ExpenseInitial } from "./ExpenseModal";
import { updateTripBudget } from "@/app/trips/[tripId]/budget/actions";

export interface BudgetExpense {
  id: string;
  label: string;
  amount: number;
  category: Category;
  who: string;
  eventTitle: string | null;
}

interface BudgetClientProps {
  tripId: string;
  totalBudget: number | null;
  eyebrow: string;
  members: { id: string; name: string }[];
  expenses: BudgetExpense[];
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
}: {
  category: Category;
  expenses: BudgetExpense[];
  total: number;
  grandTotal: number;
  onAdd: (c: Category) => void;
  onEdit: (e: BudgetExpense) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [maxH, setMaxH] = useState<string>("none");

  useLayoutEffect(() => {
    if (!bodyRef.current) return;
    if (collapsed) setMaxH("0px");
    else {
      setMaxH(bodyRef.current.scrollHeight + "px");
      const t = setTimeout(() => setMaxH("4000px"), 350);
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

      <div className="cat-body" ref={bodyRef} style={{ maxHeight: maxH }}>
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
              <div className="row-actions">
                <button className="icon-btn" onClick={() => onEdit(e)} aria-label="Edit"><Icons.edit size={13} /></button>
              </div>
            </div>
          ))}
        </div>
        <button className="cat-add" onClick={() => onAdd(category)}>
          <span className="plus"><Icons.plus size={12} /></span>
          <span>Add {CAT_LABEL[category].toLowerCase()} expense</span>
        </button>
      </div>
    </section>
  );
}

export function BudgetClient({ tripId, totalBudget, eyebrow, members, expenses }: BudgetClientProps) {
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
    setModal({ open: true, mode: "edit", initial: { id: e.id, label: e.label, amount: e.amount, category: e.category } });
  }

  function saveBudget() {
    const n = Number(budgetVal) || 0;
    if (n === budget) return;
    updateTripBudget(tripId, n);
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
            <div className="progress-fill" style={{ width: pct + "%" }} />
          </div>
        )}
        <div className="progress-meta">
          <span className="left">
            {budget > 0 ? `${pct.toFixed(1)}% used · ` : ""}
            {remaining >= 0 ? `${fmtMoney(Math.max(0, remaining))} remaining` : `${fmtMoney(Math.abs(remaining))} over`}
          </span>
          {members.length > 1 && totalSpent > 0 && (
            <span className="pp">
              <span>≈</span>
              <span className="num">{fmtMoney(perPerson)}</span>
              <span>per person</span>
            </span>
          )}
        </div>
      </section>

      {/* Trip budget editor */}
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
              return <div key={c} className={`seg c-${c}`} style={{ flexGrow: v, background: "var(--cat-color)" }} title={`${CAT_LABEL[c]} — ${fmtMoney(v)}`} />;
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
        <button className="btn-cta" onClick={() => openAdd(null)}>
          <Icons.plus size={14} /> Add expense
        </button>
      </div>

      {byCategory.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 24px", background: "var(--paper-2)", borderRadius: "var(--radius-xl)", border: "1px solid var(--rule)" }}>
          <p style={{ fontSize: 36, marginBottom: 12 }} aria-hidden="true">💰</p>
          <p style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "var(--ink)", margin: "0 0 6px" }}>No expenses yet.</p>
          <p style={{ color: "var(--ink-3)", fontSize: 13, margin: 0 }}>Add one above, or set a cost on an itinerary event.</p>
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
          />
        ))
      )}

      <ExpenseModal
        open={modal.open}
        tripId={tripId}
        mode={modal.mode}
        initial={modal.initial}
        onClose={() => setModal((m) => ({ ...m, open: false }))}
      />
    </div>
  );
}
