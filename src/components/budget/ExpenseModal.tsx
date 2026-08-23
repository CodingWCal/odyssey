"use client";

import { useState, useTransition } from "react";
import { Modal } from "@/components/shared/Modal";
import { Icons } from "@/components/shared/Icons";
import { CATEGORIES, CAT_LABEL, CAT_ICON, type Category } from "./categories";
import { createExpense, updateExpense, deleteExpense } from "@/app/trips/[tripId]/budget/actions";
import { toast } from "@/components/shared/Toast";
import { equalSharesCents, adjustmentSharesCents, weightedSharesCents } from "@/lib/budget";

export interface ExpenseInitial {
  id?: string;
  label?: string;
  amount?: number;
  category?: Category;
  /** Who actually paid (ODY-094). */
  paidBy?: string;
  splitMode?: "equal" | "exact";
  shares?: { userId: string; amountCents: number }[];
}

interface ExpenseModalProps {
  open: boolean;
  tripId: string;
  mode: "add" | "edit";
  initial: ExpenseInitial | null;
  /** Trip members, for "Paid by" and "Split between" (ODY-094). */
  tripMembers: { userId: string; name: string }[];
  /** The signed-in viewer — defaults "Paid by" on a new expense. */
  currentUserId: string;
  onClose: () => void;
  onSuccess?: () => void;
}

function centsToStr(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function ExpenseModal({
  open,
  tripId,
  mode,
  initial,
  tripMembers,
  currentUserId,
  onClose,
  onSuccess,
}: ExpenseModalProps) {
  const isEdit = mode === "edit";
  const [isPending, startTransition] = useTransition();

  const initialForm = () => ({
    category: (initial?.category ?? "misc") as Category,
    label: initial?.label ?? "",
    amount: initial?.amount != null ? String(initial.amount) : "",
  });
  const [form, setForm] = useState(initialForm);

  const allMemberIds = tripMembers.map((m) => m.userId);
  const initialSelected = () =>
    new Set(initial?.shares?.length ? initial.shares.map((s) => s.userId) : allMemberIds);
  const initialExact = () =>
    initial?.splitMode === "exact" && initial.shares
      ? Object.fromEntries(initial.shares.map((s) => [s.userId, centsToStr(s.amountCents)]))
      : {};

  const [paidBy, setPaidBy] = useState(initial?.paidBy ?? currentUserId);
  const [selected, setSelected] = useState<Set<string>>(initialSelected);
  // UI has three modes; the schema only knows two ("equal" | "exact" —
  // splitMode is cosmetic, ExpenseShare.amountCents is authoritative). Adjust
  // mode persists as "exact" (ODY-114), same as exact mode already does.
  const [uiMode, setUiMode] = useState<"equal" | "exact" | "adjust">(initial?.splitMode ?? "equal");
  const splitMode: "equal" | "exact" = uiMode === "equal" ? "equal" : "exact";
  const [exactAmounts, setExactAmounts] = useState<Record<string, string>>(initialExact);
  // Per-participant override for adjust mode (ODY-114) — blank/absent means
  // "auto-split the remainder evenly," matching adjustmentSharesCents.
  const [adjustAmounts, setAdjustAmounts] = useState<Record<string, string>>({});
  // Once the traveler touches participants/mode/amounts, we compute and send
  // explicit shares; until then, saving reuses whatever was already correct
  // (server's weighted default on add, or the untouched existing shares on
  // edit) rather than guessing at a recomputation (ODY-094).
  const [dirtiedSplit, setDirtiedSplit] = useState(false);

  // Re-seed the form each time the modal opens ("adjust state during render"
  // — the React-sanctioned replacement for a reset-on-open effect).
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setForm(initialForm());
      setPaidBy(initial?.paidBy ?? currentUserId);
      setSelected(initialSelected());
      setUiMode(initial?.splitMode ?? "equal");
      setExactAmounts(initialExact());
      setAdjustAmounts({});
      setDirtiedSplit(false);
    }
  }

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((s) => ({ ...s, [k]: v }));
  }

  function toggleParticipant(userId: string) {
    setDirtiedSplit(true);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
        setAdjustAmounts((a) => {
          if (!(userId in a)) return a;
          const rest = { ...a };
          delete rest[userId];
          return rest;
        });
      } else {
        next.add(userId);
      }
      return next;
    });
  }

  function chooseMode(next: "equal" | "exact" | "adjust") {
    setDirtiedSplit(true);
    setUiMode(next);
    if (next === "exact" && Object.keys(exactAmounts).length === 0) {
      // Seed with an equal starting point so the traveler adjusts numbers
      // instead of typing every amount from a blank $0.00.
      const totalCents = Math.round((Number(form.amount) || 0) * 100);
      const seeded = equalSharesCents([...selected], totalCents);
      setExactAmounts(Object.fromEntries(seeded.map((s) => [s.userId, centsToStr(s.amountCents)])));
    }
    // Adjust mode starts fully "auto" (everyone splits evenly) — no seeding
    // needed. That's the point: type a number only for who's different.
  }

  function setExact(userId: string, v: string) {
    setDirtiedSplit(true);
    setExactAmounts((s) => ({ ...s, [userId]: v }));
  }

  function setAdjust(userId: string, v: string) {
    setDirtiedSplit(true);
    setAdjustAmounts((s) => ({ ...s, [userId]: v }));
  }

  const totalCents = Math.round((Number(form.amount) || 0) * 100);

  // Adjust mode: participants with a typed override get exactly that
  // amount; everyone else auto-splits whatever's left (ODY-114).
  const adjustOverriddenIds = [...selected].filter((id) => (adjustAmounts[id] ?? "").trim() !== "");
  const adjustAutoIds = [...selected].filter((id) => !adjustOverriddenIds.includes(id));
  const adjustOverriddenCents = adjustOverriddenIds.reduce(
    (s, id) => s + Math.round((Number(adjustAmounts[id]) || 0) * 100),
    0
  );
  const adjustRemainingCents = totalCents - adjustOverriddenCents;

  const allocatedCents =
    uiMode === "exact"
      ? [...selected].reduce((s, id) => s + Math.round((Number(exactAmounts[id]) || 0) * 100), 0)
      : totalCents;
  const remainingCents = totalCents - allocatedCents;

  const adjustValid =
    uiMode !== "adjust" ||
    (adjustRemainingCents >= 0 && (adjustAutoIds.length > 0 || adjustRemainingCents === 0));

  const valid =
    form.label.trim() !== "" &&
    form.amount !== "" &&
    Number(form.amount) > 0 &&
    selected.size > 0 &&
    (uiMode === "equal" || (uiMode === "exact" && remainingCents === 0) || (uiMode === "adjust" && adjustValid));

  function sharesPayload(): { userId: string; amountCents: number }[] | undefined {
    if (!dirtiedSplit) {
      if (!isEdit) return undefined; // undefined => server applies the weighted default
      const existing = initial?.shares;
      if (!existing?.length) return undefined;
      // Split wasn't touched, but the amount may have changed. Rescale the
      // existing shares proportionally so they still reconcile to the new
      // total — otherwise editing just the price sends stale shares summing to
      // the old amount, which the server's reconcile check rejects (a 500).
      const existingSum = existing.reduce((s, x) => s + x.amountCents, 0);
      if (existingSum === totalCents) return existing;
      return weightedSharesCents(
        existing.map((s) => ({ userId: s.userId, weight: s.amountCents })),
        totalCents
      );
    }
    const ids = [...selected];
    if (uiMode === "adjust") {
      return adjustmentSharesCents(
        ids.map((id) => ({
          userId: id,
          overrideCents: adjustOverriddenIds.includes(id)
            ? Math.round((Number(adjustAmounts[id]) || 0) * 100)
            : null,
        })),
        totalCents
      );
    }
    if (splitMode === "exact") {
      return ids.map((id) => ({ userId: id, amountCents: Math.round((Number(exactAmounts[id]) || 0) * 100) }));
    }
    return equalSharesCents(ids, totalCents);
  }

  function handleSave() {
    if (!valid) return;
    startTransition(async () => {
      try {
        const payload = {
          label: form.label.trim(),
          amount: Number(form.amount),
          category: form.category,
          paidBy,
          splitMode,
          shares: sharesPayload(),
        };
        if (isEdit && initial?.id) {
          await updateExpense(initial.id, tripId, payload);
        } else {
          await createExpense({ tripId, ...payload });
        }
        onSuccess?.();
        onClose();
      } catch {
        toast(isEdit ? "Couldn't update expense — try again." : "Couldn't add expense — try again.");
      }
    });
  }

  function handleDelete() {
    if (!initial?.id) return;
    // Confirm before an irreversible delete — matches the app's destructive-
    // action convention (member removal / leave / event delete).
    if (!window.confirm(`Delete "${initial.label ?? "this expense"}"? This can't be undone.`)) return;
    startTransition(async () => {
      try {
        await deleteExpense(initial.id!, tripId);
        onSuccess?.();
        onClose();
      } catch {
        toast("Couldn't delete expense — try again.");
      }
    });
  }

  return (
    <Modal open={open} onClose={onClose} ariaLabel={isEdit ? "Edit expense" : "Add expense"}>
      <div className="modal-head">
        <div className="left">
          <h3>{isEdit ? "Edit expense" : "Add an expense"}</h3>
          <p>Track every yen and dollar.</p>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close">
          <Icons.close size={16} />
        </button>
      </div>

      <div className="modal-body">
        <div className="field">
          <label>Category</label>
          <div className="type-grid">
            {CATEGORIES.map((c) => {
              const Icon = CAT_ICON[c];
              return (
                <button
                  key={c}
                  type="button"
                  className={`type-chip cat c-${c} ${form.category === c ? "selected" : ""}`}
                  onClick={() => set("category", c)}
                >
                  <Icon size={18} />
                  {CAT_LABEL[c]}
                </button>
              );
            })}
          </div>
        </div>

        <div className="field">
          <label htmlFor="exp-label">Description</label>
          <input
            id="exp-label"
            className="input"
            value={form.label}
            onChange={(e) => set("label", e.target.value)}
            placeholder="e.g. Dinner at Den"
            autoFocus
          />
        </div>

        <div className="field">
          <label htmlFor="exp-amt">Amount</label>
          <div className="input-with-prefix">
            <span className="prefix">$</span>
            <input
              id="exp-amt"
              className="input mono"
              inputMode="decimal"
              value={form.amount}
              onChange={(e) => set("amount", e.target.value)}
              placeholder="0.00"
            />
          </div>
        </div>

        {tripMembers.length > 0 && (
          <>
            <div className="field">
              <label htmlFor="exp-paidby">Paid by</label>
              <select
                id="exp-paidby"
                className="input"
                value={paidBy}
                onChange={(e) => setPaidBy(e.target.value)}
              >
                {tripMembers.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>Split between</label>
              <div className="opt-chips wrap">
                {tripMembers.map((m) => (
                  <button
                    key={m.userId}
                    type="button"
                    className={`rounded-xl opt-chip ${selected.has(m.userId) ? "on" : ""}`}
                    onClick={() => toggleParticipant(m.userId)}
                    aria-pressed={selected.has(m.userId)}
                  >
                    {m.name}
                  </button>
                ))}
              </div>
              <div className="opt-chips" role="group" aria-label="Split mode">
                <button
                  type="button"
                  className={`rounded-xl opt-chip ${uiMode === "equal" ? "on" : ""}`}
                  onClick={() => chooseMode("equal")}
                >
                  Equal
                </button>
                {/* Adjust (ODY-114): "everyone's even except this one person" —
                    the common case stays one-tap Equal; this and Exact are both
                    progressive disclosure, not competing with it. */}
                <button
                  type="button"
                  className={`rounded-xl opt-chip ${uiMode === "adjust" ? "on" : ""}`}
                  onClick={() => chooseMode("adjust")}
                >
                  Adjust one person
                </button>
                <button
                  type="button"
                  className={`rounded-xl opt-chip ${uiMode === "exact" ? "on" : ""}`}
                  onClick={() => chooseMode("exact")}
                >
                  Exact amounts
                </button>
              </div>

              {uiMode === "adjust" && (
                <div className="exact-split-rows">
                  <p className="adjust-hint">Type an amount for anyone who owes something different — everyone else splits the rest evenly.</p>
                  {tripMembers
                    .filter((m) => selected.has(m.userId))
                    .map((m) => (
                      <div className="exact-split-row" key={m.userId}>
                        <span className="who">{m.name}</span>
                        <div className="input-with-prefix">
                          <span className="prefix">$</span>
                          <input
                            className="input mono"
                            inputMode="decimal"
                            value={adjustAmounts[m.userId] ?? ""}
                            onChange={(e) => setAdjust(m.userId, e.target.value)}
                            placeholder="auto"
                          />
                        </div>
                      </div>
                    ))}
                  <div className={`exact-remaining ${adjustValid ? "ok" : "warn"}`}>
                    {adjustAutoIds.length > 0
                      ? `${centsToStr(Math.max(0, adjustRemainingCents))} splits evenly among ${adjustAutoIds.length} ${adjustAutoIds.length === 1 ? "person" : "people"}`
                      : adjustRemainingCents === 0
                        ? "Fully allocated"
                        : `${centsToStr(Math.abs(adjustRemainingCents))} ${adjustRemainingCents > 0 ? "left to allocate" : "over the total"}`}
                  </div>
                </div>
              )}

              {uiMode === "exact" && (
                <div className="exact-split-rows">
                  {tripMembers
                    .filter((m) => selected.has(m.userId))
                    .map((m) => (
                      <div className="exact-split-row" key={m.userId}>
                        <span className="who">{m.name}</span>
                        <div className="input-with-prefix">
                          <span className="prefix">$</span>
                          <input
                            className="input mono"
                            inputMode="decimal"
                            value={exactAmounts[m.userId] ?? ""}
                            onChange={(e) => setExact(m.userId, e.target.value)}
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                    ))}
                  <div className={`exact-remaining ${remainingCents === 0 ? "ok" : "warn"}`}>
                    {remainingCents === 0
                      ? "Fully allocated"
                      : `${centsToStr(Math.abs(remainingCents))} ${remainingCents > 0 ? "left to allocate" : "over the total"}`}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <div className="modal-foot">
        {isEdit && (
          <button className="btn btn-danger mr-auto" onClick={handleDelete} disabled={isPending}>
            <Icons.trash size={14} /> Delete
          </button>
        )}
        <button className="btn btn-ghost" onClick={onClose} disabled={isPending}>Cancel</button>
        <button className="btn btn-primary" onClick={handleSave} disabled={!valid || isPending}>
          {isPending ? "Saving…" : isEdit ? "Save changes" : "Add expense"}
        </button>
      </div>
    </Modal>
  );
}
