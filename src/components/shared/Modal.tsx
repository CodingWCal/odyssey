"use client";

import { useEffect } from "react";
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

  useEffect(() => {
    if (!open || isMobile) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
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
      <div className="modal" role="dialog" aria-modal="true" aria-label={ariaLabel}>
        {children}
      </div>
    </div>
  );
}
