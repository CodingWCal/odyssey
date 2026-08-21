"use client";

import { useEffect, useRef } from "react";
import { WORLD_PATH, WORLD_VIEWBOX } from "./worldPath";

const PALETTE_VARS = ["--peri", "--teal", "--coral", "--peach", "--gold", "--slate"];

// Parse the world path into subpaths of [x,y] points (viewBox space), once.
function parseSubpaths(d: string): number[][][] {
  const out: number[][][] = [];
  for (const seg of d.split("Z")) {
    const nums = seg.match(/-?\d+(?:\.\d+)?/g);
    if (!nums || nums.length < 6) continue;
    const pts: number[][] = [];
    for (let i = 0; i + 1 < nums.length; i += 2) pts.push([Number(nums[i]), Number(nums[i + 1])]);
    out.push(pts);
  }
  return out;
}
const SUBPATHS_VB = parseSubpaths(WORLD_PATH);

/**
 * A hand-drawn world map whose coastlines behave like a water surface (ODY-011f)
 * — touch/hover drops a ripple and the contour lines nearby distort and warp
 * outward like surface-tension waves, koi-pond style, before settling. A faint
 * palette wash follows. Points are displaced per-frame; the loop idles when no
 * ripple is alive. Decorative (aria-hidden); reduced-motion holds it still.
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
    const ink = cs.getPropertyValue("--slate").trim() || "#4A6B8C";
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

    const LIFE = 4200;
    const landVB = new Path2D(WORLD_PATH);
    let w = 0;
    let h = 0;
    let subpaths: number[][][] = [];
    let landPx = new Path2D();

    type Ripple = { x: number; y: number; t0: number; color: string; amp: number; maxR: number };
    let ripples: Ripple[] = [];
    let lastX = -999;
    let lastY = -999;
    let raf = 0;
    let colorTick = 0;

    function fit() {
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      if (w === 0 || h === 0) return;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      c.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Cover-fit + zoom + a gentle tilt (uniform scale — no warp of proportions).
      const fitScale = Math.max(w / WORLD_VIEWBOX.w, h / WORLD_VIEWBOX.h) * 1.55;
      const cx = w / 2;
      const cy = h / 2;
      const fit = new DOMMatrix([
        fitScale, 0, 0, fitScale,
        (w - WORLD_VIEWBOX.w * fitScale) / 2,
        (h - WORLD_VIEWBOX.h * fitScale) / 2,
      ]);
      const m = new DOMMatrix().translateSelf(cx, cy).rotateSelf(-4).translateSelf(-cx, -cy).multiply(fit);
      landPx = new Path2D();
      landPx.addPath(landVB, m);
      // Pre-transform every coastline point into canvas px.
      const { a, b, c: mc, d: md, e, f } = m;
      subpaths = SUBPATHS_VB.map((pts) => pts.map(([x, y]) => [a * x + mc * y + e, b * x + md * y + f]));
      draw(performance.now());
    }

    function ease(age: number) {
      return 1 - Math.pow(1 - age, 1.9);
    }

    function draw(now: number) {
      c.clearRect(0, 0, w, h);

      // Faint clean color wash — one soft bloom per ripple, blended like paint.
      if (ripples.length) {
        c.save();
        c.clip(landPx);
        c.globalCompositeOperation = "multiply";
        for (const rp of ripples) {
          const age = (now - rp.t0) / LIFE;
          if (age >= 1) continue;
          const r = 40 + ease(age) * rp.maxR * 0.6;
          const g = c.createRadialGradient(rp.x, rp.y, 0, rp.x, rp.y, r);
          g.addColorStop(0, rp.color);
          g.addColorStop(1, "transparent");
          c.globalAlpha = Math.sin(age * Math.PI) * 0.12;
          c.fillStyle = g;
          c.beginPath();
          c.arc(rp.x, rp.y, r, 0, Math.PI * 2);
          c.fill();
        }
        c.globalCompositeOperation = "source-over";
        c.restore();
      }

      // Coastlines, distorted by the live ripples (surface-tension warp).
      c.strokeStyle = ink;
      c.globalAlpha = 0.34;
      c.lineWidth = 0.6;
      c.lineJoin = "round";
      c.lineCap = "round";
      c.beginPath();
      for (const sp of subpaths) {
        for (let i = 0; i < sp.length; i++) {
          const p = sp[i];
          let px = p[0];
          let py = p[1];
          for (const rp of ripples) {
            const age = (now - rp.t0) / LIFE;
            if (age >= 1) continue;
            const ex = px - rp.x;
            const ey = py - rp.y;
            const dist = Math.hypot(ex, ey) || 0.001;
            const R = ease(age) * rp.maxR;
            const off = dist - R;
            const band = 44;
            if (off < -band * 1.6 || off > band * 1.6) continue;
            const envelope = Math.exp(-(off * off) / (2 * band * band));
            const push = rp.amp * (1 - age) * envelope * Math.sin(off / 9);
            px += (ex / dist) * push;
            py += (ey / dist) * push;
          }
          if (i === 0) c.moveTo(px, py);
          else c.lineTo(px, py);
        }
      }
      c.stroke();
      c.globalAlpha = 1;
    }

    function loop() {
      const now = performance.now();
      ripples = ripples.filter((r) => now - r.t0 < LIFE);
      draw(now);
      raf = ripples.length ? requestAnimationFrame(loop) : 0;
    }

    function spawn(x: number, y: number, splash: boolean) {
      ripples.push({
        x,
        y,
        t0: performance.now(),
        color: palette[colorTick++ % palette.length],
        amp: splash ? 12 : 7,
        maxR: splash ? 230 : 175,
      });
      if (ripples.length > 14) ripples.shift();
      if (!raf) raf = requestAnimationFrame(loop);
    }

    function pos(e: PointerEvent) {
      const rect = canvas.getBoundingClientRect();
      return [e.clientX - rect.left, e.clientY - rect.top] as const;
    }
    function onMove(e: PointerEvent) {
      const [x, y] = pos(e);
      if (Math.hypot(x - lastX, y - lastY) < 40) return;
      lastX = x;
      lastY = y;
      spawn(x, y, false);
    }
    function onDown(e: PointerEvent) {
      const [x, y] = pos(e);
      lastX = x;
      lastY = y;
      spawn(x, y, true); // a firmer splash on tap/click
    }

    fit();
    if (!reduce) {
      canvas.addEventListener("pointermove", onMove);
      canvas.addEventListener("pointerdown", onDown);
    }

    let rt = 0;
    function onResize() {
      window.clearTimeout(rt);
      rt = window.setTimeout(fit, 150);
    }
    window.addEventListener("resize", onResize);

    return () => {
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerdown", onDown);
      window.removeEventListener("resize", onResize);
      if (raf) cancelAnimationFrame(raf);
      window.clearTimeout(rt);
    };
  }, []);

  return <canvas ref={canvasRef} className="ld-paintmap" aria-hidden="true" />;
}
