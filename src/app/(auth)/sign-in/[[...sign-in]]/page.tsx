"use client";
import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      background: "var(--paper)",
      padding: "24px 16px",
    }}>
      <div className="brand" style={{ marginBottom: 28 }}>
        <span className="brand-mark" aria-hidden="true" />
        <span className="brand-name">Odyssey</span>
      </div>
      <SignIn />
    </div>
  );
}
