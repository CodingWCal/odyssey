"use client";

import { useState, useTransition } from "react";
import { inviteCollaborator } from "@/app/trips/[tripId]/members/actions";
import { Icons } from "@/components/shared/Icons";

interface InviteFormProps {
  tripId: string;
}

export function InviteForm({ tripId }: InviteFormProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("editor");
  const [isPending, startTransition] = useTransition();
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess(false);
    startTransition(async () => {
      try {
        await inviteCollaborator({ email, tripId });
        setSuccess(true);
        setEmail("");
        setTimeout(() => setSuccess(false), 2400);
      } catch {
        setError("Something went wrong. Please try again.");
      }
    });
  }

  return (
    <>
      <form className="invite-row" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="inv-email">Email</label>
          <input
            id="inv-email"
            type="email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="friend@email.com"
            required
          />
        </div>
        <div className="field">
          <label htmlFor="inv-role">Role</label>
          <select id="inv-role" className="input" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="editor">Editor</option>
            <option value="viewer">Viewer</option>
          </select>
        </div>
        <button type="submit" className="btn btn-primary" style={{ height: 42 }} disabled={isPending || !email}>
          <Icons.plus size={14} /> {isPending ? "Sending…" : "Send invite"}
        </button>
      </form>
      {success && (
        <div className="invite-success">✓ Invite sent — they&apos;ll join once they sign in.</div>
      )}
      {error && <p style={{ fontSize: 13, color: "var(--coral)", marginTop: 12 }}>{error}</p>}
    </>
  );
}
