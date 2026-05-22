"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { TypeBadge } from "@/components/shared/TypeBadge";
import type { TripEvent } from "@/types";
import { formatCurrency } from "@/lib/utils";

const LeafletMap = dynamic(
  () => import("./LeafletMap").then((m) => m.LeafletMap),
  { ssr: false, loading: () => <div className="h-full w-full bg-odyssey-cream/50 rounded-xl animate-pulse" /> }
);

interface MapClientProps {
  events: TripEvent[];
}

export function MapClient({ events }: MapClientProps) {
  const [selectedEvent, setSelectedEvent] = useState<TripEvent | null>(null);

  return (
    <div className="h-full relative">
      <LeafletMap events={events} onPinClick={(id) => setSelectedEvent(events.find((e) => e.id === id) ?? null)} />

      <Sheet open={!!selectedEvent} onOpenChange={(o) => !o && setSelectedEvent(null)}>
        <SheetContent side="right" className="w-full sm:max-w-sm">
          {selectedEvent && (
            <>
              <SheetHeader>
                <SheetTitle className="font-heading">{selectedEvent.title}</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-3">
                <TypeBadge type={selectedEvent.type as any} />
                {selectedEvent.location && (
                  <p className="text-sm text-odyssey-slate">📍 {selectedEvent.location}</p>
                )}
                {selectedEvent.startTime && (
                  <p className="text-sm font-mono text-odyssey-ink">
                    {selectedEvent.startTime}{selectedEvent.endTime ? ` → ${selectedEvent.endTime}` : ""}
                  </p>
                )}
                {selectedEvent.cost != null && (
                  <p className="text-sm font-mono text-odyssey-teal font-semibold">
                    {formatCurrency(selectedEvent.cost)}
                  </p>
                )}
                {selectedEvent.notes && (
                  <p className="text-sm text-odyssey-slate/80">{selectedEvent.notes}</p>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
