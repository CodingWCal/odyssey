"use client";

import { useEffect, useRef } from "react";
import { useIsMobile } from "@/lib/hooks/useIsMobile";
import { Sheet, SheetContent } from "@/components/ui/sheet";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  ariaLabel: string;
  children: React.ReactNode;
}

/**
 * Modal shell. Desktop renders the centered `.modal-backdrop` / `.modal`
 * shell; below 768px it renders as a bottom sheet (`.sheet-panel`) via the
 * shadcn Sheet primitive for easier one-thumb reach on mobile.
 * Callers compose `.modal-head` / `.modal-body` / `.modal-foot` inside either way.
 */
export function Modal({ open, onClose, ariaLabel, children }: ModalProps) {
  const isMobile = useIsMobile();
  const dialogRef = useRef<HTMLDivElement>(null);

  // Desktop dialog focus management (ODY-118 F1): move focus into the dialog on
  // open, trap Tab within it, and restore focus to the trigger on close — so a
  // keyboard user can't end up focused on the page behind the overlay. The
  // mobile path uses the shadcn Sheet, which handles this itself.
  useEffect(() => {
    if (!open || isMobile) return;
    const dialog = dialogRef.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const getFocusable = () =>
      dialog
        ? Array.from(
            dialog.querySelectorAll<HTMLElement>(
              'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
            )
          )
        : [];

    // Focus the first control, or the dialog container as a fallback.
    (getFocusable()[0] ?? dialog)?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const items = getFocusable();
      if (items.length === 0) {
        e.preventDefault();
        dialog?.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === dialog)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      // Return focus to whatever opened the dialog.
      previouslyFocused?.focus?.();
    };
  }, [open, onClose, isMobile]);

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
        <SheetContent side="bottom" showCloseButton={false} className="sheet-panel" aria-label={ariaLabel}>
          {children}
        </SheetContent>
      </Sheet>
    );
  }

  if (!open) return null;

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-label={ariaLabel} ref={dialogRef} tabIndex={-1}>
        {children}
      </div>
    </div>
  );
}
