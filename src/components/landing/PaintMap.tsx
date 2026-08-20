"use client";

import { useEffect, useRef } from "react";

// The territory colors — the trip "paints in" with the brand palette.
const PALETTE_VARS = ["--peri", "--teal", "--coral", "--peach", "--gold", "--slate"];

/**
 * A blank dot-map that paints in with the palette as the cursor moves across it
 * (ODY-011f) — a restrained take on the watercolor-reveal idea. Colors are
 * predetermined in coherent territories (nearest-seed), so hovering *reveals* a
 * hidden map rather than scattering confetti. Canvas + pointer, decorative
 * (aria-hidden). Touch devices get a soft pre-wash (no hover); reduced-motion
 * shows it fully painted and static.
 */
export function PaintMap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const ctx = el.getContext("2d");
    if (!ctx) return;
    // Non-null aliases so the closures below stay narrowed.
    const canvas = el;
    const c = ctx;

    const cs = getComputedStyle(document.documentElement);
    const palette = PALETTE_VARS.map((v) => cs.getPropertyValue(v).trim() || "#6F66B7");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;

    const SPACING = 26;
    const BRUSH = 80;
    type Dot = { x: number; y: number; color: string; reveal: number };
    let w = 0;
    let h = 0;
    let dots: Dot[] = [];

    function build() {
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      if (w === 0 || h === 0) return;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      c.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Seed a handful of color territories across the map.
      const seeds = Array.from({ length: 6 }, (_, i) => ({
        x: Math.random() * w,
        y: Math.random() * h,
        color: palette[i % palette.length],
      }));
      const startReveal = reduce ? 1 : coarse ? 0.42 : 0;
      dots = [];
      for (let y = SPACING / 2; y < h; y += SPACING) {
        for (let x = SPACING / 2; x < w; x += SPACING) {
          let best = 0;
          let bd = Infinity;
          for (let s = 0; s < seeds.length; s++) {
            const d = (seeds[s].x - x) ** 2 + (seeds[s].y - y) ** 2;
            if (d < bd) {
              bd = d;
              best = s;
            }
          }
          dots.push({ x, y, color: seeds[best].color, reveal: startReveal });
        }
      }
      draw();
    }

    function draw() {
      c.clearRect(0, 0, w, h);
      for (const d of dots) {
        c.globalAlpha = 0.32;
        c.fillStyle = "#8a8398";
        c.beginPath();
        c.arc(d.x, d.y, 1.5, 0, Math.PI * 2);
        c.fill();
        if (d.reveal > 0.01) {
          c.globalAlpha = Math.min(0.82, d.reveal * 0.82);
          c.fillStyle = d.color;
          c.beginPath();
          c.arc(d.x, d.y, 2 + d.reveal * 4.5, 0, Math.PI * 2);
          c.fill();
        }
      }
      c.globalAlpha = 1;
    }

    let raf = 0;
    let dirty = false;
    function schedule() {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        if (dirty) {
          dirty = false;
          draw();
        }
      });
    }

    function onMove(e: PointerEvent) {
      const rect = canvas.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      for (const d of dots) {
        const dist = Math.hypot(d.x - px, d.y - py);
        if (dist < BRUSH) {
          d.reveal = Math.min(1, d.reveal + (1 - dist / BRUSH) * 0.2);
          dirty = true;
        }
      }
      schedule();
    }

    build();
    if (!reduce && !coarse) canvas.addEventListener("pointermove", onMove);

    let rt = 0;
    function onResize() {
      window.clearTimeout(rt);
      rt = window.setTimeout(build, 150);
    }
    window.addEventListener("resize", onResize);

    return () => {
      canvas.removeEventListener("pointermove", onMove);
      window.removeEventListener("resize", onResize);
      if (raf) cancelAnimationFrame(raf);
      window.clearTimeout(rt);
    };
  }, []);

  return <canvas ref={canvasRef} className="ld-paintmap" aria-hidden="true" />;
}
