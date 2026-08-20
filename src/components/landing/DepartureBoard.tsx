"use client";

import { useEffect, useState } from "react";

// A restrained set of evocative places — the "board" cycles these.
const PLACES = ["Lisbon", "Kyoto", "Reykjavík", "Marrakech", "Patagonia", "Hanoi", "Oaxaca"];

/**
 * A single split-flap departure tile (ODY-011f) — cycles destinations with a
 * mechanical flip, the honest version of the rotating-word idea (a travel
 * object, not spinning text). Decorative (aria-hidden); under reduced motion it
 * swaps text with no flip.
 */
export function DepartureBoard() {
  const [i, setI] = useState(0);
  const [flipping, setFlipping] = useState(false);

  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const id = setInterval(() => {
      if (reduce) {
        setI((n) => (n + 1) % PLACES.length);
        return;
      }
      setFlipping(true);
      // Swap the word at the midpoint of the flip, then settle.
      window.setTimeout(() => {
        setI((n) => (n + 1) % PLACES.length);
        setFlipping(false);
      }, 260);
    }, 2800);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="ld-board" aria-hidden="true">
      <span className="ld-board-label">Now departing</span>
      <span className="ld-board-tile">
        <span className={`ld-board-flap${flipping ? " flipping" : ""}`}>{PLACES[i]}</span>
      </span>
    </div>
  );
}
