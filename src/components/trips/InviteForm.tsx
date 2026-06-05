"use client";

import { useState, useTransition } from "react";
import { inviteCollaborator } from "@/app/trips/[tripId]/members/actions";
import { Icons } from "@/components/shared/Icons";

interface InviteFormProps {
  tripId: string;
}

export function InviteForm({ tripId }: InviteFormProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"editor" | "viewer">("editor");
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    startTransition(async () => {
      try {
        const res = await inviteCollaborator({ email, tripId, role });
        const who = email;
        if (res.alreadyMember) {
          setMessage(`${who} is already on this trip.`);
        } else if (res.emailSent) {
          setMessage(`✓ Invitation email sent to ${who}.`);
        } else if (res.existingUser) {
          setMessage(`✓ Added ${who} — they'll see the trip next time they sign in.`);
        } else {
          setMessage(`✓ Added ${who}, but the email couldn't be sent. Share the link manually.`);
        }
        setEmail("");
        setTimeout(() => setMessage(""), 4000);
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
          <select id="inv-role" className="input" value={role} onChange={(e) => setRole(e.target.value as "editor" | "viewer")}>
            <option value="editor">Editor</option>
            <option value="viewer">Viewer</option>
          </select>
        </div>
        <button type="submit" className="btn btn-primary" style={{ height: 42 }} disabled={isPending || !email}>
          <Icons.plus size={14} /> {isPending ? "Sending…" : "Send invite"}
        </button>
      </form>
      {message && (
        <div className="invite-success">{message}</div>
      )}
      {error && <p style={{ fontSize: 13, color: "var(--coral)", marginTop: 12 }}>{error}</p>}
    </>
  );
}
