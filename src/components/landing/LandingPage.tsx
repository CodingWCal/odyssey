import Link from "next/link";
import { Icons } from "@/components/shared/Icons";
import { Globe3D } from "./Globe3D";
import { DepartureBoard } from "./DepartureBoard";
import { PaintMap } from "./PaintMap";
import { RouteTrail } from "./RouteTrail";
import { Reveal } from "./Reveal";

// Styles live in globals.css under the `ld-` prefix (ODY-011a). The only
// inline style is the per-card accent color, passed as a CSS custom property
// — the documented dynamic-value exception.
export function LandingPage() {
  return (
    <div className="ld-page">
      {/* Printed-paper grain over the whole page (ODY-011f) — static, ~4%,
          pointer-events none. Adds analog warmth without any motion. */}
      <div className="ld-grain" aria-hidden="true" />
      {/* Nav */}
      <nav className="ld-nav">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <span className="brand-name">Odyssey</span>
        </div>
        <div className="ld-nav-links">
          <Link href="/sign-in" className="ld-nav-signin">Sign in</Link>
          <Link href="/sign-up" className="od-btn-cta ld-nav-cta">
            Get started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="ld-hero">
        {/* Plotted-route backdrop (ODY-011f) — thin map arcs; the primary one
            draws itself in on load and its destination pin arrives. Decorative,
            full-bleed line-art (can't warp), still under reduced-motion. */}
        <svg className="ld-routes" viewBox="0 0 1200 520" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
          {/* Faint background trajectories, spread across the full width. */}
          <path className="ld-route ld-route-3" d="M -40 300 C 220 360 360 170 640 240" />
          <path className="ld-route ld-route-3" d="M 640 240 C 820 300 980 150 1240 250" />
          <path className="ld-route ld-route-3" d="M 700 20 C 860 150 1010 110 1240 200" />
          <path className="ld-route ld-route-3" d="M -40 120 C 180 90 320 200 560 150" />
          <path className="ld-route ld-route-3" d="M 120 520 C 320 480 460 540 760 480" />
          <path className="ld-route ld-route-3" d="M 780 500 C 960 460 1080 520 1240 470" />
          <circle className="ld-node ld-node-sm" cx="640" cy="240" r="1.8" />
          <circle className="ld-node ld-node-sm" cx="560" cy="150" r="1.8" />
          <circle className="ld-node ld-node-sm" cx="760" cy="480" r="1.8" />
          {/* Secondary dashed routes — dots flow along these. */}
          <path className="ld-route ld-route-2" d="M -20 90 C 320 240 640 120 1010 300" />
          <path className="ld-route ld-route-2" d="M 260 30 C 520 200 820 110 1240 330" />
          <path className="ld-route ld-route-2" d="M -40 380 C 260 320 520 440 820 360 S 1120 400 1240 360" />
          <path className="ld-route ld-route-3" d="M -40 200 C 300 260 560 140 900 210 S 1160 180 1240 200" />
          <path className="ld-route ld-route-3" d="M 160 -20 C 360 120 640 60 900 180" />
          <circle className="ld-node ld-node-sm" cx="900" cy="180" r="1.8" />
          <circle className="ld-node ld-node-sm" cx="820" cy="360" r="1.8" />
          {/* Primary route (draws in) + its arriving destination pin. */}
          <path className="ld-route ld-route-1" d="M 190 430 C 400 300 660 360 1010 150" />
          <circle className="ld-node-ring" cx="190" cy="430" r="6" />
          <circle className="ld-node" cx="190" cy="430" r="2.5" />
          <g className="ld-node-dest">
            <circle className="ld-node-ring" cx="1010" cy="150" r="6" />
            <circle className="ld-node" cx="1010" cy="150" r="2.5" />
          </g>
        </svg>

        {/* Interactive globe (drag to spin). */}
        <Globe3D size={300} />

        <div className="ld-badge">
          <span className="ld-badge-dot" />
          Now in beta · trips of every shape
        </div>

        <h1 className="ld-h1">
          The plan is part of the <em className="ld-em">adventure</em>.
        </h1>

        <p className="ld-sub">
          Odyssey is the calm, joy-inducing workspace for trips — solo escapes, group adventures, weekends that turn into something more. One place to hold all of it.
        </p>

        <div className="ld-cta-row">
          <Link href="/sign-up" className="ld-cta-primary">
            Start planning
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </Link>
          <Link href="/sign-in" className="ld-cta-ghost">
            Sign in →
          </Link>
        </div>

        <div className="ld-social">
          <DepartureBoard />
        </div>
      </section>

      {/* Boarding-pass ticket — the brand's core metaphor as one real object
          (ODY-011f). Static markup; a subtle straighten-on-hover only. */}
      <section className="ld-ticket-band">
        <Reveal>
          <article className="ld-ticket" aria-label="A trip, as a boarding pass">
            <div className="bp-main">
              <div className="bp-row bp-row-top">
                <span className="bp-brand">Odyssey</span>
                <span className="bp-code">ODY · 2026</span>
              </div>
              <div className="bp-route">
                <span className="bp-place">Home</span>
                <span className="bp-arrow" aria-hidden="true">→</span>
                <span className="bp-place">Anywhere</span>
              </div>
              <div className="bp-grid">
                <div className="bp-cell"><span className="bp-k">Passenger</span><span className="bp-v">You &amp; the crew</span></div>
                <div className="bp-cell"><span className="bp-k">Departs</span><span className="bp-v">When you&rsquo;re ready</span></div>
                <div className="bp-cell"><span className="bp-k">Duration</span><span className="bp-v">The long way</span></div>
              </div>
            </div>
            <div className="bp-perf" aria-hidden="true">
              <span className="bp-notch bp-notch-top" />
              <span className="bp-notch bp-notch-bottom" />
            </div>
            <div className="bp-stub">
              <span className="bp-k">Gate</span>
              <span className="bp-gate">07</span>
              <span className="bp-barcode" aria-hidden="true" />
              <span className="bp-code">Seat 2A</span>
            </div>
          </article>
        </Reveal>
      </section>

      {/* Trajectory that plots itself in as you scroll here. */}
      <RouteTrail d="M 40 90 C 320 20 560 120 840 50 S 1080 70 1170 60" />

      {/* Feature cards */}
      <section className="ld-features">
        <div className="ld-features-grid">
          {[
            { color: "var(--peri)", Icon: Icons.itinerary, title: "Day-by-day itinerary", body: "Drag, drop, expand, edit inline. Notes live where you'll actually find them." },
            { color: "var(--teal)", Icon: Icons.map, title: "The route, mapped", body: "Every event becomes a pin. Filter by day. See the whole arc of your trip." },
            { color: "var(--coral)", Icon: Icons.budget, title: "Budget, tracked softly", body: "Categories, splits, per-person numbers. A soft ceiling — not a hard limit." },
            { color: "var(--gold)", Icon: Icons.members, title: "The crew, in sync", body: "Invite by email. Everyone can plan; no one steps on each other's plans." },
            { color: "var(--peach)", Icon: Icons.note, title: "Notes that breathe", body: "Pin a vibe at the top of the trip. Drop a thought under a day. They autosave." },
            { color: "var(--slate)", Icon: Icons.weather, title: "Weather, ambient", body: "Today's sky in your hero banner. A quiet reminder to pack the lighter jacket." },
          ].map((f, i) => (
            <Reveal key={f.title} delay={i * 70}>
              <div className="ld-card">
                <div className="ld-card-icon" style={{ "--f-color": f.color } as React.CSSProperties}>
                  <f.Icon size={18} />
                </div>
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Return leg — draws in from the other direction. */}
      <RouteTrail flip d="M 1160 100 C 880 30 600 120 300 50 S 90 80 30 70" />

      {/* Paint-in map — a real world map the cursor explores with watercolor
          ripples (ODY-011f). */}
      <section className="ld-paint-band">
        <Reveal className="ld-paint-copy">
          <h2>Every trip starts <em className="ld-em">blank</em>.</h2>
          <p>Then you fill it in — one plan, one pin, one day at a time.</p>
          <span className="ld-paint-hint">Move across the map — or tap — to ripple the water</span>
        </Reveal>
        <PaintMap />
      </section>

      {/* Footer CTA */}
      <section className="ld-foot-cta">
        <Reveal>
          <h2>
            Where to <em className="ld-em">next</em>?
          </h2>
          <p>
            The world keeps moving. Your plans deserve a calm place to live.
          </p>
          <Link href="/sign-up" className="ld-cta-primary">
            Get early access →
          </Link>
        </Reveal>
      </section>

      {/* Footer */}
      <footer className="ld-footer">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <span className="ld-footer-name">Odyssey</span>
          <span className="ld-footer-tag">© 2026 · Made for the long way around.</span>
        </div>
      </footer>
    </div>
  );
}
