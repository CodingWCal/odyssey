"use client";

import { useEffect, useRef } from "react";
import { WORLD_PATH, WORLD_VIEWBOX } from "./worldPath";

const PALETTE_VARS = ["--peri", "--teal", "--coral", "--peach", "--gold", "--slate"];

/**
 * A real world map (Natural Earth coastlines) that the cursor "explores" —
 * watercolor ripples cascade outward from the pointer and leave a soft palette
 * wash behind, all clipped to land so the paint stays on the continents
 * (ODY-011f). Canvas-based: the coastline base is cached once; only the ripples
 * and the accumulating wash redraw. Decorative (aria-hidden). Touch devices and
 * reduced-motion get a gentle static wash with no animation.
 */
export function PaintMap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const ctx = el.getContext("2d");
    if (!ctx) return;
    const canvas = el;
    const c = ctx;

    const cs = getComputedStyle(document.documentElement);
    const palette = PALETTE_VARS.map((v) => cs.getPropertyValue(v).trim() || "#6F66B7");
    const coast = (cs.getPropertyValue("--ink-3").trim() || "#8a8398");
    const landFill = (cs.getPropertyValue("--paper-3").trim() || "#efe7d7");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
    const staticMode = reduce || coarse;

    const landVB = new Path2D(WORLD_PATH);
    let w = 0;
    let h = 0;
    let landPx = new Path2D();

    // Cached static base (land fill + coastline) and the accumulating wash.
    const base = document.createElement("canvas");
    const bctx = base.getContext("2d");
    const wash = document.createElement("canvas");
    const wctx = wash.getContext("2d");

    type Ripple = { x: number; y: number; t0: number; color: string };
    let ripples: Ripple[] = [];
    let lastX = -999;
    let lastY = -999;
    let raf = 0;
    let colorTick = 0;

    function fit() {
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      if (w === 0 || h === 0 || !bctx || !wctx) return;
      for (const cv of [canvas, base, wash]) {
        cv.width = Math.round(w * dpr);
        cv.height = Math.round(h * dpr);
      }
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      wctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // "Contain" fit — whole world visible, centered.
      const scale = Math.min(w / WORLD_VIEWBOX.w, h / WORLD_VIEWBOX.h);
      const ox = (w - WORLD_VIEWBOX.w * scale) / 2;
      const oy = (h - WORLD_VIEWBOX.h * scale) / 2;
      const m = new DOMMatrix([scale, 0, 0, scale, ox, oy]);
      landPx = new Path2D();
      landPx.addPath(landVB, m);

      // Base: subtle land fill + thin coastline.
      bctx.clearRect(0, 0, w, h);
      bctx.fillStyle = landFill;
      bctx.globalAlpha = 0.7;
      bctx.fill(landPx);
      bctx.globalAlpha = 1;
      bctx.strokeStyle = coast;
      bctx.globalAlpha = 0.45;
      bctx.lineWidth = 0.8;
      bctx.lineJoin = "round";
      bctx.stroke(landPx);
      bctx.globalAlpha = 1;

      // Static modes: pre-wash the land so it isn't blank without a cursor.
      wctx.clearRect(0, 0, w, h);
      if (staticMode) {
        wctx.save();
        wctx.clip(landPx);
        for (let i = 0; i < 5; i++) {
          stampWash((0.2 + i * 0.16) * w, (0.3 + (i % 2) * 0.4) * h, palette[i % palette.length], 0.5);
        }
        wctx.restore();
      }
      render();
    }

    // Lay a soft palette dab into the wash layer (caller clips to land).
    function stampWash(x: number, y: number, color: string, strength: number) {
      if (!wctx) return;
      const r = 52;
      const g = wctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, color);
      g.addColorStop(1, "transparent");
      wctx.globalAlpha = 0.12 * strength;
      wctx.fillStyle = g;
      wctx.beginPath();
      wctx.arc(x, y, r, 0, Math.PI * 2);
      wctx.fill();
      wctx.globalAlpha = 1;
    }

    function render() {
      if (!bctx || !wctx) return;
      c.clearRect(0, 0, w, h);
      c.drawImage(base, 0, 0, w, h);
      c.drawImage(wash, 0, 0, w, h);

      if (ripples.length) {
        c.save();
        c.clip(landPx);
        const now = performance.now();
        for (const rp of ripples) {
          const age = (now - rp.t0) / 1100; // 0..1 lifespan
          if (age >= 1) continue;
          const maxR = 150;
          const ease = 1 - Math.pow(1 - age, 2);
          const alpha = (1 - age) * 0.5;
          c.strokeStyle = rp.color;
          // Two cascading rings.
          for (const k of [0, 0.35]) {
            const rr = Math.max(0, (ease - k) * maxR);
            if (rr <= 0) continue;
            c.globalAlpha = alpha * (k === 0 ? 1 : 0.6);
            c.lineWidth = 2.2 * (1 - age);
            c.beginPath();
            c.arc(rp.x, rp.y, rr, 0, Math.PI * 2);
            c.stroke();
          }
        }
        c.globalAlpha = 1;
        c.restore();
      }
    }

    function loop() {
      const now = performance.now();
      ripples = ripples.filter((r) => now - r.t0 < 1100);
      render();
      raf = ripples.length ? requestAnimationFrame(loop) : 0;
    }

    function onMove(e: PointerEvent) {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      // Spawn on movement; the land clip keeps rings + wash on the continents,
      // so ripples over ocean simply clip away (and lap onto nearby shores).
      if (Math.hypot(x - lastX, y - lastY) < 22) return;
      lastX = x;
      lastY = y;
      const color = palette[colorTick++ % palette.length];
      ripples.push({ x, y, t0: performance.now(), color });
      if (wctx) {
        wctx.save();
        wctx.clip(landPx);
        stampWash(x, y, color, 1);
        wctx.restore();
      }
      if (!raf) raf = requestAnimationFrame(loop);
    }

    fit();
    if (!staticMode) canvas.addEventListener("pointermove", onMove);

    let rt = 0;
    function onResize() {
      window.clearTimeout(rt);
      rt = window.setTimeout(fit, 150);
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
