"use client";

import { useEffect, useState } from "react";

// A curated board — real-feeling flight codes + times, non-obvious cities.
const ROUTES = [
  { city: "Lisbon", code: "ODY 214", time: "09:45" },
  { city: "Kyoto", code: "ODY 388", time: "11:20" },
  { city: "Reykjavík", code: "ODY 061", time: "13:05" },
  { city: "Marrakech", code: "ODY 442", time: "15:30" },
  { city: "Patagonia", code: "ODY 507", time: "18:15" },
  { city: "Hanoi", code: "ODY 129", time: "20:40" },
  { city: "Oaxaca", code: "ODY 273", time: "22:10" },
];

/**
 * A split-flap departure board row (ODY-011f). The composition — code · city ·
 * time · status — reads as real airport signage, which is why the monospace
 * uppercase looks intentional rather than a generic label. The city flips
 * mechanically; decorative (aria-hidden); reduced motion swaps with no flip.
 */
export function DepartureBoard() {
  const [i, setI] = useState(0);
  const [flipping, setFlipping] = useState(false);

  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const id = setInterval(() => {
      if (reduce) {
        setI((n) => (n + 1) % ROUTES.length);
        return;
      }
      setFlipping(true);
      window.setTimeout(() => {
        setI((n) => (n + 1) % ROUTES.length);
        setFlipping(false);
      }, 260);
    }, 3000);
    return () => clearInterval(id);
  }, []);

  const r = ROUTES[i];

  return (
    <div className="ld-board" aria-hidden="true">
      <span className="ld-board-cell ld-board-dep">Dep</span>
      <span className="ld-board-cell ld-board-code">{r.code}</span>
      <span className="ld-board-cell ld-board-city">
        <span className={`ld-board-flap${flipping ? " flipping" : ""}`}>{r.city}</span>
      </span>
      <span className="ld-board-cell ld-board-time">{r.time}</span>
      <span className="ld-board-cell ld-board-status">On time</span>
    </div>
  );
}
