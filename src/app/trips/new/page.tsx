import { TripForm } from "@/components/trips/TripForm";
import Link from "next/link";

export default function NewTripPage() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--paper)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px" }}>
      <div style={{ width: "100%", maxWidth: 560 }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div className="brand" style={{ justifyContent: "center", marginBottom: 20 }}>
            <span className="brand-mark" aria-hidden="true" />
            <span className="brand-name">Odyssey</span>
          </div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 40, margin: "0 0 8px", color: "var(--ink)" }}>
            Plan a new <em style={{ fontStyle: "italic", color: "var(--peri)" }}>trip</em>
          </h1>
          <p style={{ color: "var(--ink-2)", fontSize: 14, margin: 0 }}>Where are we going?</p>
        </div>

        {/* Form card */}
        <div style={{
          background: "var(--paper-2)", border: "1px solid var(--rule)",
          borderRadius: "var(--radius-xl)", padding: "32px 32px 28px",
          boxShadow: "var(--shadow-2)",
        }}>
          <TripForm />
        </div>

        <div style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: "var(--ink-3)" }}>
          <Link href="/dashboard" style={{ color: "var(--ink-3)" }}>← Back to dashboard</Link>
        </div>
      </div>
    </div>
  );
}
