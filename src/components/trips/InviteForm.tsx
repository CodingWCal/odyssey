"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { inviteCollaborator } from "@/app/trips/[tripId]/members/actions";

interface InviteFormProps {
  tripId: string;
}

export function InviteForm({ tripId }: InviteFormProps) {
  const [email, setEmail] = useState("");
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
      } catch {
        setError("Something went wrong. Please try again.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="invite-email">Email Address</Label>
        <Input
          id="invite-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="friend@example.com"
          required
          className="rounded-xl"
        />
      </div>
      {success && <p className="text-sm text-odyssey-teal">Invite sent! They'll appear once they sign in.</p>}
      {error && <p className="text-sm text-odyssey-coral">{error}</p>}
      <Button
        type="submit"
        disabled={isPending || !email}
        className="w-full bg-odyssey-teal hover:bg-odyssey-teal/90 text-white rounded-xl"
      >
        {isPending ? "Sending..." : "Send Invite"}
      </Button>
    </form>
  );
}
