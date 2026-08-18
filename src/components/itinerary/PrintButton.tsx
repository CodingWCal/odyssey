"use client";

/** Triggers the browser print dialog for the print/share itinerary (ODY-032).
 * Client-only because it calls window.print(); hidden in the printed output. */
export function PrintButton() {
  return (
    <button type="button" className="btn btn-primary sm" onClick={() => window.print()}>
      Print / Save PDF
    </button>
  );
}
