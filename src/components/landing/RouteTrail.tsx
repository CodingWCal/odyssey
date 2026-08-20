"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A decorative trajectory that draws itself in when scrolled into view
 * (ODY-011f) — a route being plotted as you move down the page. Reduced-motion
 * and no-IntersectionObserver just show it already drawn.
 */
export function RouteTrail({ d, flip = false }: { d: string; flip?: boolean }) {
  const ref = useRef<SVGSVGElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { threshold: 0.35 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // End point of the path (for the arriving pin) — parsed from the last pair.
  const nums = d.match(/-?\d+(?:\.\d+)?/g) ?? [];
  const ex = nums.length >= 2 ? Number(nums[nums.length - 2]) : 0;
  const ey = nums.length >= 1 ? Number(nums[nums.length - 1]) : 0;

  return (
    <svg
      ref={ref}
      className={`ld-trail${visible ? " is-visible" : ""}${flip ? " flip" : ""}`}
      viewBox="0 0 1200 140"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <path className="ld-trail-path" d={d} />
      <circle className="ld-trail-pin" cx={ex} cy={ey} r="4" />
    </svg>
  );
}
