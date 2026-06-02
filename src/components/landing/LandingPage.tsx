import Link from "next/link";
import { Globe3D } from "./Globe3D";

export function LandingPage() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--paper)", fontFamily: "var(--font-body)" }}>
      {/* Nav */}
      <nav style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "18px 48px", borderBottom: "1px solid var(--rule)",
        background: "var(--paper-2)", position: "sticky", top: 0, zIndex: 50,
      }}>
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <span className="brand-name">Odyssey</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Link href="/sign-in" style={{ fontSize: 13.5, color: "var(--ink-2)" }}>Sign in</Link>
          <Link href="/sign-up" className="od-btn-cta" style={{ textDecoration: "none" }}>
            Get started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section style={{
        maxWidth: 820, margin: "0 auto", padding: "56px 48px 60px",
        textAlign: "center",
      }}>
        {/* Interactive globe */}
        <Globe3D size={300} />

        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          fontSize: 12, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase",
          color: "var(--peri)", background: "var(--peri-soft)", padding: "6px 14px",
          borderRadius: 999, margin: "8px 0 28px",
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: "50%", background: "var(--peri)",
            animation: "pulse 2s infinite",
          }} />
          Now in beta · trips of every shape
        </div>

        <h1 style={{
          fontFamily: "var(--font-display)", fontSize: "clamp(48px, 7vw, 80px)",
          fontWeight: 400, lineHeight: 1.0, margin: "0 0 24px", color: "var(--ink)",
        }}>
          The plan is part of the <em style={{ fontStyle: "italic", color: "var(--peri)" }}>adventure</em>.
        </h1>

        <p style={{
          fontSize: 18, color: "var(--ink-2)", lineHeight: 1.6,
          maxWidth: 580, margin: "0 auto 36px",
        }}>
          Odyssey is the calm, joy-inducing workspace for trips — solo escapes, group adventures, weekends that turn into something more. One place to hold all of it.
        </p>

        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Link
            href="/sign-up"
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "14px 28px", borderRadius: 12,
              background: "var(--ink)", color: "var(--paper)",
              fontWeight: 600, fontSize: 15, textDecoration: "none",
              transition: "background .15s ease",
            }}
          >
            Start planning
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </Link>
          <Link
            href="/sign-in"
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "14px 28px", borderRadius: 12,
              background: "transparent", color: "var(--ink-2)",
              fontWeight: 500, fontSize: 15, textDecoration: "none",
              border: "1px solid var(--rule-2)",
              transition: "all .15s ease",
            }}
          >
            Sign in →
          </Link>
        </div>

        <div style={{ marginTop: 20, fontSize: 12, color: "var(--ink-3)", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
          <span style={{ letterSpacing: 2, color: "var(--gold)" }}>★★★★★</span>
          <span>Loved by 4,200 travelers</span>
          <span>·</span>
          <span>Free for solo trips</span>
        </div>
      </section>

      {/* Feature cards */}
      <section style={{
        maxWidth: 1040, margin: "0 auto", padding: "0 48px 80px",
      }}>
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 18,
        }}>
          {[
            { color: "var(--peri)", title: "Day-by-day itinerary", body: "Drag, drop, expand, edit inline. Notes live where you'll actually find them." },
            { color: "var(--teal)", title: "The route, mapped", body: "Every event becomes a pin. Filter by day. See the whole arc of your trip." },
            { color: "var(--coral)", title: "Budget, tracked softly", body: "Categories, splits, per-person numbers. A soft ceiling — not a hard limit." },
            { color: "var(--gold)", title: "The crew, in sync", body: "Invite by email. Everyone can plan; no one steps on each other's plans." },
            { color: "var(--peach)", title: "Notes that breathe", body: "Pin a vibe at the top of the trip. Drop a thought under a day. They autosave." },
            { color: "var(--slate)", title: "Weather, ambient", body: "Today's sky in your hero banner. A quiet reminder to pack the lighter jacket." },
          ].map((f) => (
            <div
              key={f.title}
              style={{
                background: "var(--paper-2)", border: "1px solid var(--rule)",
                borderRadius: "var(--radius-xl)", padding: "24px 24px 22px",
              }}
            >
              <div style={{
                width: 38, height: 38, borderRadius: 11, marginBottom: 16,
                background: `color-mix(in srgb, ${f.color} 12%, transparent)`,
                color: f.color,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10" />
                </svg>
              </div>
              <h3 style={{ fontFamily: "var(--font-display)", fontSize: 22, margin: "0 0 8px", color: "var(--ink)" }}>
                {f.title}
              </h3>
              <p style={{ fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.6, margin: 0 }}>{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Quote */}
      <section style={{
        maxWidth: 680, margin: "0 auto", padding: "60px 48px",
        textAlign: "center", borderTop: "1px solid var(--rule)",
      }}>
        <blockquote style={{
          fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 400,
          fontStyle: "italic", color: "var(--ink)", margin: "0 0 16px",
          lineHeight: 1.3,
        }}>
          &ldquo;It feels like holding a boarding pass and a printed map at the same time.&rdquo;
        </blockquote>
        <div style={{ fontSize: 13, color: "var(--ink-3)" }}>— Maya R., on her first Odyssey trip</div>
      </section>

      {/* Footer CTA */}
      <section style={{
        textAlign: "center", padding: "60px 48px 80px",
        background: "var(--paper-2)", borderTop: "1px solid var(--rule)",
      }}>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 48, margin: "0 0 12px" }}>
          Where to <em style={{ fontStyle: "italic", color: "var(--peri)" }}>next</em>?
        </h2>
        <p style={{ color: "var(--ink-2)", fontSize: 16, margin: "0 0 28px" }}>
          The world keeps moving. Your plans deserve a calm place to live.
        </p>
        <Link
          href="/sign-up"
          style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "14px 28px", borderRadius: 12,
            background: "var(--ink)", color: "var(--paper)",
            fontWeight: 600, fontSize: 15, textDecoration: "none",
          }}
        >
          Get early access →
        </Link>
      </section>

      {/* Footer */}
      <footer style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "18px 48px", borderTop: "1px solid var(--rule)",
        fontSize: 12, color: "var(--ink-3)",
      }}>
        <div className="brand" style={{ gap: 8 }}>
          <span className="brand-mark" style={{ width: 20, height: 20 }} aria-hidden="true" />
          <span style={{ fontFamily: "var(--font-display)", fontSize: 16 }}>Odyssey</span>
          <span style={{ marginLeft: 8 }}>© 2026 · Made for the long way around.</span>
        </div>
        <div style={{ display: "flex", gap: 20 }}>
          {["Privacy", "Terms", "Support"].map((l) => (
            <a key={l} href="#" style={{ color: "var(--ink-3)" }}>{l}</a>
          ))}
        </div>
      </footer>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: .4; transform: scale(.85); }
        }
      `}</style>
    </div>
  );
}
