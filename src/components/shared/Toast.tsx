"use client";

import { useEffect, useState } from "react";

/**
 * Minimal toast system (ODY-013) — no dependency, no context. `toast()` can be
 * called from any client component; a single <Toaster /> (mounted in the root
 * layout) renders the stack. Styled via `.toast` classes in globals.css.
 */

export type ToastKind = "error" | "success";

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

type Listener = (t: ToastItem) => void;

let nextId = 1;
const listeners = new Set<Listener>();

export function toast(message: string, kind: ToastKind = "error") {
  const item: ToastItem = { id: nextId++, kind, message };
  listeners.forEach((l) => l(item));
}

const AUTO_DISMISS_MS = 5000;

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    const onToast: Listener = (item) => {
      setItems((prev) => [...prev, item]);
      setTimeout(() => {
        setItems((prev) => prev.filter((t) => t.id !== item.id));
      }, AUTO_DISMISS_MS);
    };
    listeners.add(onToast);
    return () => {
      listeners.delete(onToast);
    };
  }, []);

  if (items.length === 0) return null;

  const dismiss = (id: number) => setItems((prev) => prev.filter((x) => x.id !== id));
  const renderToast = (t: ToastItem) => (
    <div key={t.id} className={`toast ${t.kind}`}>
      <span>{t.message}</span>
      <button className="toast-dismiss" aria-label="Dismiss" onClick={() => dismiss(t.id)}>
        ×
      </button>
    </div>
  );

  // Two live regions (ODY-118 F7): failures announce assertively (role="alert"),
  // successes politely — a failure shouldn't wait behind a success in the queue.
  const errors = items.filter((t) => t.kind === "error");
  const successes = items.filter((t) => t.kind === "success");

  return (
    <div className="toast-stack">
      {errors.length > 0 && (
        <div className="toast-group" role="alert" aria-live="assertive">
          {errors.map(renderToast)}
        </div>
      )}
      {successes.length > 0 && (
        <div className="toast-group" role="status" aria-live="polite">
          {successes.map(renderToast)}
        </div>
      )}
    </div>
  );
}
