"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createTrip } from "@/app/trips/actions";

export function TripForm() {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    startTransition(async () => {
      await createTrip(new FormData(form));
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="title">Trip Name</Label>
        <Input id="title" name="title" placeholder="Summer in Japan" required className="rounded-xl" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="destination">Destination</Label>
        <Input id="destination" name="destination" placeholder="Tokyo, Japan" required className="rounded-xl" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="startDate">Start Date</Label>
          <Input id="startDate" name="startDate" type="date" required className="rounded-xl" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="endDate">End Date</Label>
          <Input id="endDate" name="endDate" type="date" required className="rounded-xl" />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="totalBudget">Total Budget (optional)</Label>
        <Input id="totalBudget" name="totalBudget" type="number" min="0" step="0.01" placeholder="5000" className="rounded-xl font-mono" />
      </div>

      <div className="flex gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          className="flex-1 rounded-xl"
          onClick={() => router.back()}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isPending}
          className="flex-1 rounded-xl btn-ink"
        >
          {isPending ? "Creating..." : "Create Trip"}
        </Button>
      </div>
    </form>
  );
}
