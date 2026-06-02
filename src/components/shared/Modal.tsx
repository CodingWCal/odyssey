"use client";

import { useEffect } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  ariaLabel: string;
  children: React.ReactNode;
}

/**
 * Centered modal shell (`.modal-backdrop` / `.modal`) matching the design.
 * Handles Escape-to-close, body scroll-lock, and backdrop-click-to-close.
 * Callers compose `.modal-head` / `.modal-body` / `.modal-foot` inside.
 */
export function Modal({ open, onClose, ariaLabel, children }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-label={ariaLabel}>
        {children}
      </div>
    </div>
  );
}
