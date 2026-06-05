"use client";

import { useState, useTransition } from "react";
import { resendInvite, removeMember } from "@/app/trips/[tripId]/members/actions";
import { Icons } from "@/components/shared/Icons";

interface MemberActionsProps {
  memberId: string;
  tripId: string;
  memberName: string;
  isPending: boolean;
  canRemove: boolean;
}

export function MemberActions({ memberId, tripId, memberName, isPending, canRemove }: MemberActionsProps) {
  const [busy, startTransition] = useTransition();
  const [note, setNote] = useState("");

  if (!isPending && !canRemove) return null;

  function handleResend() {
    setNote("");
    startTransition(async () => {
      const res = await resendInvite(memberId, tripId);
      setNote(res.emailSent ? "✓ Invite re-sent" : "Couldn't re-send");
      setTimeout(() => setNote(""), 3000);
    });
  }

  function handleRemove() {
    if (!window.confirm(`Remove ${memberName} from this trip?`)) return;
    startTransition(async () => {
      await removeMember(memberId, tripId);
    });
  }

  return (
    <div className="member-actions-row">
      {isPending && (
        <button className="resend" onClick={handleResend} disabled={busy} type="button">
          {busy ? "…" : "Resend invite"}
        </button>
      )}
      {canRemove && (
        <button className="remove" onClick={handleRemove} disabled={busy} type="button" title={`Remove ${memberName}`}>
          <Icons.trash size={13} /> Remove
        </button>
      )}
      {note && <span className="action-note">{note}</span>}
    </div>
  );
}
