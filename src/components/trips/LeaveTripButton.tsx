"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { leaveTrip } from "@/app/trips/[tripId]/members/actions";
import { toast } from "@/components/shared/Toast";

/** Self-remove for non-owners (ODY-084). */
export function LeaveTripButton({ tripId }: { tripId: string }) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();

  function handleLeave() {
    if (!window.confirm("Leave this trip? You can rejoin only if someone invites you again.")) return;
    startTransition(async () => {
      try {
        await leaveTrip(tripId);
        router.replace("/dashboard");
      } catch {
        toast("Couldn't leave the trip — try again.");
      }
    });
  }

  return (
    <div className="leave-trip">
      <button type="button" className="btn btn-ghost leave-trip-btn" onClick={handleLeave} disabled={busy}>
        {busy ? "Leaving…" : "Leave trip"}
      </button>
    </div>
  );
}
