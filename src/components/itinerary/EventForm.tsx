"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createEvent, updateEvent } from "@/app/trips/[tripId]/itinerary/actions";
import type { TripEvent, EventType } from "@/types";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createEventSchema, type CreateEventInput } from "@/lib/validations";

const EVENT_TYPES: EventType[] = ["flight", "hotel", "restaurant", "activity", "transport", "misc"];

interface EventFormProps {
  tripId: string;
  dayId: string;
  existing?: TripEvent;
  onSuccess?: () => void;
}

async function geocodeAddress(address: string): Promise<{ lat: number; lng: number; display: string } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`,
      { headers: { "Accept-Language": "en" } }
    );
    const data = await res.json();
    if (!data[0]) return null;
    return {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
      display: data[0].display_name,
    };
  } catch {
    return null;
  }
}

export function EventForm({ tripId, dayId, existing, onSuccess }: EventFormProps) {
  const [isPending, startTransition] = useTransition();
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geocodeStatus, setGeocodeStatus] = useState<"idle" | "found" | "not_found">(
    existing?.lat != null ? "found" : "idle"
  );

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<CreateEventInput, unknown, CreateEventInput>({
    resolver: zodResolver(createEventSchema) as any,
    defaultValues: {
      tripId,
      dayId,
      type: (existing?.type as EventType) ?? "activity",
      title: existing?.title ?? "",
      location: existing?.location ?? "",
      startTime: existing?.startTime ?? "",
      endTime: existing?.endTime ?? "",
      notes: existing?.notes ?? "",
      cost: existing?.cost ?? undefined,
      lat: existing?.lat ?? undefined,
      lng: existing?.lng ?? undefined,
    },
  });

  const typeValue = watch("type");
  const locationValue = watch("location");

  async function handleGeocode() {
    if (!locationValue?.trim()) return;
    setIsGeocoding(true);
    setGeocodeStatus("idle");
    const result = await geocodeAddress(locationValue);
    if (result) {
      setValue("lat", result.lat);
      setValue("lng", result.lng);
      setGeocodeStatus("found");
    } else {
      setGeocodeStatus("not_found");
    }
    setIsGeocoding(false);
  }

  function onSubmit(data: CreateEventInput) {
    startTransition(async () => {
      if (existing) {
        await updateEvent(existing.id, {
          type: data.type,
          title: data.title,
          location: data.location,
          startTime: data.startTime,
          endTime: data.endTime,
          notes: data.notes,
          cost: data.cost,
          lat: data.lat,
          lng: data.lng,
        });
      } else {
        await createEvent(data);
      }
      onSuccess?.();
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <input type="hidden" {...register("tripId")} />
      <input type="hidden" {...register("dayId")} />
      <input type="hidden" {...register("lat")} />
      <input type="hidden" {...register("lng")} />

      <div className="space-y-2">
        <Label htmlFor="type">Type</Label>
        <Select value={typeValue} onValueChange={(v) => setValue("type", v as EventType)}>
          <SelectTrigger className="rounded-xl capitalize">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {EVENT_TYPES.map((t) => (
              <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input id="title" {...register("title")} placeholder="Flight to Tokyo" className="rounded-xl" />
        {errors.title && <p className="text-xs text-red-500">{errors.title.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="location">Address / Location</Label>
        <div className="flex gap-2">
          <Input
            id="location"
            {...register("location")}
            placeholder="Narita International Airport, Japan"
            className="rounded-xl flex-1"
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleGeocode(); } }}
            onChange={() => setGeocodeStatus("idle")}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleGeocode}
            disabled={isGeocoding || !locationValue?.trim()}
            className="rounded-xl shrink-0 text-xs px-3"
            aria-label="Find location on map"
          >
            {isGeocoding ? "..." : "📍 Pin"}
          </Button>
        </div>
        {geocodeStatus === "found" && (
          <p className="text-xs text-odyssey-teal">✓ Location pinned on map</p>
        )}
        {geocodeStatus === "not_found" && (
          <p className="text-xs text-odyssey-coral">Couldn't find that address — try being more specific</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="startTime">Start Time</Label>
          <Input id="startTime" type="time" {...register("startTime")} className="rounded-xl font-mono" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="endTime">End Time</Label>
          <Input id="endTime" type="time" {...register("endTime")} className="rounded-xl font-mono" />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="cost">Cost (optional)</Label>
        <Input id="cost" type="number" step="0.01" min="0" {...register("cost")} placeholder="0.00" className="rounded-xl font-mono" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes (optional)</Label>
        <Textarea id="notes" {...register("notes")} placeholder="Confirmation #ABC123..." className="rounded-xl resize-none" rows={3} />
      </div>

      <Button
        type="submit"
        disabled={isPending}
        className="w-full rounded-xl bg-odyssey-teal hover:bg-odyssey-teal/90 text-white"
      >
        {isPending ? "Saving..." : existing ? "Update Event" : "Add Event"}
      </Button>
    </form>
  );
}
