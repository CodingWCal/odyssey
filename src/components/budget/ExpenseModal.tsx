"use client";

import { useState, useEffect, useTransition } from "react";
import { Modal } from "@/components/shared/Modal";
import { Icons } from "@/components/shared/Icons";
import { CATEGORIES, CAT_LABEL, CAT_ICON, type Category } from "./categories";
import { createExpense, updateExpense, deleteExpense } from "@/app/trips/[tripId]/budget/actions";

export interface ExpenseInitial {
  id?: string;
  label?: string;
  amount?: number;
  category?: Category;
}

interface ExpenseModalProps {
  open: boolean;
  tripId: string;
  mode: "add" | "edit";
  initial: ExpenseInitial | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ExpenseModal({ open, tripId, mode, initial, onClose, onSuccess }: ExpenseModalProps) {
  const isEdit = mode === "edit";
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({
    category: (initial?.category ?? "misc") as Category,
    label: initial?.label ?? "",
    amount: initial?.amount != null ? String(initial.amount) : "",
  });

  useEffect(() => {
    if (open) {
      setForm({
        category: (initial?.category ?? "misc") as Category,
        label: initial?.label ?? "",
        amount: initial?.amount != null ? String(initial.amount) : "",
      });
    }
  }, [open, initial]);

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((s) => ({ ...s, [k]: v }));
  }

  const valid = form.label.trim() !== "" && form.amount !== "" && Number(form.amount) > 0;

  function handleSave() {
    if (!valid) return;
    startTransition(async () => {
      const payload = { label: form.label.trim(), amount: Number(form.amount), category: form.category };
      if (isEdit && initial?.id) {
        await updateExpense(initial.id, tripId, payload);
      } else {
        await createExpense({ tripId, ...payload });
      }
      onSuccess?.();
      onClose();
    });
  }

  function handleDelete() {
    if (!initial?.id) return;
    startTransition(async () => {
      await deleteExpense(initial.id!, tripId);
      onSuccess?.();
      onClose();
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
                  className={`type-chip c-${c} ${form.category === c ? "selected" : ""}`}
                  style={{ "--type-color": "var(--cat-color)", "--type-soft": "var(--cat-soft)" } as React.CSSProperties}
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
      </div>

      <div className="modal-foot">
        {isEdit && (
          <button className="btn btn-danger" onClick={handleDelete} disabled={isPending} style={{ marginRight: "auto" }}>
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
