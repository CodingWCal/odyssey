"use client";

import { useState, useTransition } from "react";
import { TypeBadge } from "@/components/shared/TypeBadge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { EventForm } from "./EventForm";
import { deleteEvent } from "@/app/trips/[tripId]/itinerary/actions";
import type { TripEvent } from "@/types";
import { formatCurrency } from "@/lib/utils";

interface EventBlockProps {
  event: TripEvent;
  tripId: string;
  dragHandle?: React.ReactNode;
}

export function EventBlock({ event, tripId, dragHandle }: EventBlockProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      await deleteEvent(event.id);
      setOpen(false);
    });
  }

  return (
    <div className="group flex items-start gap-3 bg-white rounded-xl border border-odyssey-cream p-3 shadow-sm hover:shadow-md transition-shadow">
      {dragHandle && <div className="mt-1 cursor-grab active:cursor-grabbing text-odyssey-slate/40 hover:text-odyssey-slate">{dragHandle}</div>}

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <TypeBadge type={event.type as any} />
            <h4 className="font-medium text-odyssey-ink text-sm">{event.title}</h4>
          </div>
          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger render={<Button variant="ghost" size="sm" className="h-7 text-xs text-odyssey-slate" />}>
                Edit
              </SheetTrigger>
              <SheetContent className="w-full sm:max-w-md">
                <SheetHeader>
                  <SheetTitle className="font-heading">Edit Event</SheetTitle>
                </SheetHeader>
                <div className="mt-4">
                  <EventForm
                    tripId={tripId}
                    dayId={event.dayId}
                    existing={event}
                    onSuccess={() => setOpen(false)}
                  />
                  <Button
                    variant="destructive"
                    size="sm"
                    className="mt-4 w-full rounded-xl"
                    onClick={handleDelete}
                    disabled={isPending}
                  >
                    {isPending ? "Deleting..." : "Delete Event"}
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        {(event.startTime || event.location) && (
          <div className="flex items-center gap-3 mt-1 text-xs text-odyssey-slate flex-wrap">
            {event.startTime && (
              <span className="font-mono">
                {event.startTime}{event.endTime ? ` → ${event.endTime}` : ""}
              </span>
            )}
            {event.location && <span>📍 {event.location}</span>}
            {event.cost != null && (
              <span className="font-mono text-odyssey-teal">{formatCurrency(event.cost)}</span>
            )}
          </div>
        )}

        {event.notes && (
          <p className="text-xs text-odyssey-slate/80 mt-1 line-clamp-2">{event.notes}</p>
        )}
      </div>
    </div>
  );
}
