"use client";

import { useEffect, useRef } from "react";
import { WORLD_PATH, WORLD_VIEWBOX } from "./worldPath";

const PALETTE_VARS = ["--peri", "--teal", "--coral", "--peach", "--gold", "--slate"];

/**
 * A hand-drawn world map that the cursor "explores" (ODY-011f). Moving the
 * pointer drops watercolor ripples — concentric rings expanding like a stone in
 * a still pond, each leaving a faint pigment bloom that spreads and dries away
 * (so it never muddies). Everything is clipped to land so paint stays on the
 * continents. The coastline is sketched with a few offset passes for a
 * pen-on-paper feel, and the map is tilted a touch so it reads as drawn on the
 * page. Canvas-based, base cached; decorative (aria-hidden). Touch and
 * reduced-motion get a still, gently washed map.
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
    const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
    const staticMode = reduce || coarse;

    const LIFE = 4400; // ripple lifespan — slow, koi-pond calm
    const landVB = new Path2D(WORLD_PATH);
    let w = 0;
    let h = 0;
    let landPx = new Path2D();

    const base = document.createElement("canvas");
    const bctx = base.getContext("2d");

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
      if (w === 0 || h === 0 || !bctx) return;
      canvas.width = base.width = Math.round(w * dpr);
      canvas.height = base.height = Math.round(h * dpr);
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      bctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Cover-fit + zoom (uniform scale — no stretch/warp), so the map fills
      // and crops in rather than showing the whole textbook rectangle. The CSS
      // edge-fade mask dissolves the crop into the page.
      const fitScale = Math.max(w / WORLD_VIEWBOX.w, h / WORLD_VIEWBOX.h) * 1.2;
      const cx = w / 2;
      const cy = h / 2;
      const fit = new DOMMatrix([
        fitScale, 0, 0, fitScale,
        (w - WORLD_VIEWBOX.w * fitScale) / 2,
        (h - WORLD_VIEWBOX.h * fitScale) / 2,
      ]);
      const flair = new DOMMatrix().translateSelf(cx, cy).rotateSelf(-4).translateSelf(-cx, -cy);
      landPx = new Path2D();
      landPx.addPath(landVB, flair.multiply(fit));

      // Hand-drawn coastline: a few faint offset passes build a sketched line.
      bctx.clearRect(0, 0, w, h);
      bctx.strokeStyle = ink;
      bctx.lineJoin = "round";
      bctx.lineCap = "round";
      const passes = [
        { dx: 0, dy: 0, a: 0.32, lw: 0.8 },
        { dx: 0.6, dy: -0.5, a: 0.14, lw: 0.7 },
        { dx: -0.5, dy: 0.6, a: 0.12, lw: 0.7 },
      ];
      for (const p of passes) {
        bctx.save();
        bctx.translate(p.dx, p.dy);
        bctx.globalAlpha = p.a;
        bctx.lineWidth = p.lw;
        bctx.stroke(landPx);
        bctx.restore();
      }
      bctx.globalAlpha = 1;

      if (staticMode) {
        // A few faint static blooms so the map isn't blank without a cursor.
        renderBase();
        c.save();
        c.clip(landPx);
        c.globalCompositeOperation = "multiply";
        for (let i = 0; i < 6; i++) {
          bloom((0.18 + i * 0.13) * w, (0.32 + (i % 3) * 0.22) * h, palette[i % palette.length], 0.1);
        }
        c.globalCompositeOperation = "source-over";
        c.restore();
      } else {
        renderBase();
      }
    }

    function renderBase() {
      c.clearRect(0, 0, w, h);
      c.drawImage(base, 0, 0, w, h);
    }

    // A soft watercolor pigment bloom at (x,y). Caller clips to land and sets
    // the multiply blend so overlapping colors mix like wet pigment.
    function bloom(x: number, y: number, color: string, alpha: number) {
      const r = 84;
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, color);
      g.addColorStop(0.4, color);
      g.addColorStop(1, "transparent");
      c.globalAlpha = alpha;
      c.fillStyle = g;
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.fill();
      c.globalAlpha = 1;
    }

    function render() {
      renderBase();
      if (!ripples.length) return;
      const now = performance.now();
      c.save();
      c.clip(landPx);

      // Pass 1 — watercolor pigment blooms, multiplied so they blend like paint.
      c.globalCompositeOperation = "multiply";
      for (const rp of ripples) {
        const age = (now - rp.t0) / LIFE;
        if (age >= 1) continue;
        bloom(rp.x, rp.y, rp.color, Math.sin(age * Math.PI) * 0.14);
      }
      c.globalCompositeOperation = "source-over";

      // Pass 2 — an expanding water wave: several concentric crests radiating
      // out (a radial gradient of soft rings), like a stone dropped in a pond.
      const maxR = 172;
      const crests = 4;
      const half = 0.055;
      for (const rp of ripples) {
        const age = (now - rp.t0) / LIFE;
        if (age >= 1) continue;
        const R = (1 - Math.pow(1 - age, 1.9)) * maxR;
        if (R < 3) continue;
        const g = c.createRadialGradient(rp.x, rp.y, 0, rp.x, rp.y, R);
        g.addColorStop(0, "transparent");
        for (let i = 0; i < crests; i++) {
          const p = (i + 0.5) / crests; // crest centre (0..1 of the radius)
          g.addColorStop(p - half, "transparent");
          g.addColorStop(p, rp.color);
          g.addColorStop(p + half, "transparent");
        }
        g.addColorStop(1, "transparent");
        // Outer crests thin as the wave loses energy; whole thing fades with age.
        c.globalAlpha = (1 - age) * 0.3;
        c.fillStyle = g;
        c.beginPath();
        c.arc(rp.x, rp.y, R, 0, Math.PI * 2);
        c.fill();
      }
      c.globalAlpha = 1;
      c.restore();
    }

    function loop() {
      const now = performance.now();
      ripples = ripples.filter((r) => now - r.t0 < LIFE);
      render();
      raf = ripples.length ? requestAnimationFrame(loop) : 0;
    }

    function onMove(e: PointerEvent) {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if (Math.hypot(x - lastX, y - lastY) < 42) return;
      lastX = x;
      lastY = y;
      ripples.push({ x, y, t0: performance.now(), color: palette[colorTick++ % palette.length] });
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
