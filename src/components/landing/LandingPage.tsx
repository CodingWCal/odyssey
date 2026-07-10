import Link from "next/link";
import { Globe3D } from "./Globe3D";

// Styles live in globals.css under the `ld-` prefix (ODY-011a). The only
// inline style is the per-card accent color, passed as a CSS custom property
// — the documented dynamic-value exception.
export function LandingPage() {
  return (
    <div className="ld-page">
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
        {/* Interactive globe */}
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
          <span className="ld-stars">★★★★★</span>
          <span>Loved by 4,200 travelers</span>
          <span>·</span>
          <span>Free for solo trips</span>
        </div>
      </section>

      {/* Feature cards */}
      <section className="ld-features">
        <div className="ld-features-grid">
          {[
            { color: "var(--peri)", title: "Day-by-day itinerary", body: "Drag, drop, expand, edit inline. Notes live where you'll actually find them." },
            { color: "var(--teal)", title: "The route, mapped", body: "Every event becomes a pin. Filter by day. See the whole arc of your trip." },
            { color: "var(--coral)", title: "Budget, tracked softly", body: "Categories, splits, per-person numbers. A soft ceiling — not a hard limit." },
            { color: "var(--gold)", title: "The crew, in sync", body: "Invite by email. Everyone can plan; no one steps on each other's plans." },
            { color: "var(--peach)", title: "Notes that breathe", body: "Pin a vibe at the top of the trip. Drop a thought under a day. They autosave." },
            { color: "var(--slate)", title: "Weather, ambient", body: "Today's sky in your hero banner. A quiet reminder to pack the lighter jacket." },
          ].map((f) => (
            <div key={f.title} className="ld-card">
              <div className="ld-card-icon" style={{ "--f-color": f.color } as React.CSSProperties}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10" />
                </svg>
              </div>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Quote */}
      <section className="ld-quote">
        <blockquote>
          &ldquo;It feels like holding a boarding pass and a printed map at the same time.&rdquo;
        </blockquote>
        <div className="ld-quote-attr">— Maya R., on her first Odyssey trip</div>
      </section>

      {/* Footer CTA */}
      <section className="ld-foot-cta">
        <h2>
          Where to <em className="ld-em">next</em>?
        </h2>
        <p>
          The world keeps moving. Your plans deserve a calm place to live.
        </p>
        <Link href="/sign-up" className="ld-cta-primary">
          Get early access →
        </Link>
      </section>

      {/* Footer */}
      <footer className="ld-footer">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <span className="ld-footer-name">Odyssey</span>
          <span className="ld-footer-tag">© 2026 · Made for the long way around.</span>
        </div>
        <div className="ld-footer-links">
          {["Privacy", "Terms", "Support"].map((l) => (
            <a key={l} href="#">{l}</a>
          ))}
        </div>
      </footer>
    </div>
  );
}
