import { z } from "zod";

/**
 * Strict "YYYY-MM-DD" calendar date. The round-trip check rejects strings that
 * parse but roll over (e.g. "2026-02-30" → Mar 2), which would otherwise store
 * an unintended date — every date field in the app sends this exact format
 * (native date inputs / toISOString().slice(0, 10)).
 */
const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected a YYYY-MM-DD date")
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }, "Not a real calendar date");

export const createTripSchema = z.object({
  title: z.string().min(1, "Title is required").max(100),
  destination: z.string().min(1, "Destination is required").max(200),
  startDate: dateString,
  endDate: dateString,
  coverImageUrl: z.string().url().optional().or(z.literal("")),
  totalBudget: z.coerce.number().min(0).optional(),
});

export const updateTripSchema = createTripSchema.partial().extend({
  // Display-only 12h/24h preference (ODY-041).
  timeFormat: z.enum(["12h", "24h"]).optional(),
  // Cover mood index stored as "grad:<n>" (ODY-047).
  coverIndex: z.coerce.number().int().min(0).max(7).optional(),
  // Trip base currency, ISO 4217 (ODY-024). 3 uppercase letters; formatting
  // only, no FX. Kept as a format check rather than a hardcoded enum so the
  // picker's list can grow without a schema edit.
  currency: z.string().regex(/^[A-Z]{3}$/, "Expected a 3-letter currency code").optional(),
});

export const createTripWizardSchema = z.object({
  title: z.string().min(1, "Trip name is required").max(100),
  destination: z.string().min(1, "Destination is required").max(200),
  startDate: dateString,
  endDate: dateString,
  totalBudget: z.coerce.number().min(0).optional(),
  coverIndex: z.coerce.number().int().min(0).max(7).optional(),
  invites: z.array(z.string().email()).optional(),
});

export const createEventSchema = z.object({
  dayId: z.string().min(1),
  tripId: z.string().min(1),
  type: z.enum(["flight", "hotel", "restaurant", "activity", "transport", "misc"]),
  title: z.string().min(1, "Title is required").max(200),
  location: z.string().max(300).optional().or(z.literal("")),
  startTime: z.string().optional().or(z.literal("")),
  endTime: z.string().optional().or(z.literal("")),
  notes: z.string().max(2000).optional().or(z.literal("")),
  cost: z.coerce.number().finite().min(0).max(10_000_000).optional(),
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
  destLocation: z.string().max(300).optional().or(z.literal("")),
  destLat: z.coerce.number().optional(),
  destLng: z.coerce.number().optional(),
});

export const updateEventSchema = createEventSchema.partial().omit({ dayId: true, tripId: true });

/** One person's resolved share of an expense (ODY-094). */
const expenseShareSchema = z.object({
  userId: z.string().min(1),
  amountCents: z.number().int().min(0),
});

/** Shares (if provided) must reconcile to the expense total, to the cent. */
function sharesReconcile(data: { amount: number; shares?: { amountCents: number }[] }) {
  if (!data.shares) return true;
  const totalCents = Math.round(data.amount * 100);
  const sum = data.shares.reduce((s, x) => s + x.amountCents, 0);
  return sum === totalCents;
}
const SHARES_RECONCILE_ISSUE = { message: "Split amounts must add up to the total", path: ["shares"] };

export const createExpenseSchema = z
  .object({
    tripId: z.string().min(1),
    eventId: z.string().optional().or(z.literal("")),
    label: z.string().min(1, "Label is required").max(200),
    amount: z.coerce.number().finite().min(0.01, "Amount must be greater than 0").max(10_000_000),
    category: z.enum(["flights", "lodging", "food", "transport", "activities", "misc"]),
    /** Who actually paid (ODY-094) — defaults to the logger (addedBy) if omitted. */
    paidBy: z.string().min(1).optional(),
    splitMode: z.enum(["equal", "exact"]).optional(),
    /** Resolved per-person amounts; omit to fall back to legacy trip-wide split. */
    shares: z.array(expenseShareSchema).min(1).max(50).optional(),
  })
  .refine(sharesReconcile, SHARES_RECONCILE_ISSUE);

/** Partial expense edit (ODY-054) — same money/category rules as create. */
export const updateExpenseSchema = z
  .object({
    label: z.string().min(1, "Label is required").max(200),
    amount: z.coerce.number().finite().min(0.01, "Amount must be greater than 0").max(10_000_000),
    category: z.enum(["flights", "lodging", "food", "transport", "activities", "misc"]),
    eventId: z.string().optional().or(z.literal("")),
    paidBy: z.string().min(1).optional(),
    splitMode: z.enum(["equal", "exact"]).optional(),
    shares: z.array(expenseShareSchema).min(1).max(50).optional(),
  })
  .refine(sharesReconcile, SHARES_RECONCILE_ISSUE);

export const inviteCollaboratorSchema = z.object({
  email: z.string().email("Invalid email address"),
  tripId: z.string().min(1),
  role: z.enum(["editor", "viewer"]).optional(),
});

export const updateSplitSchema = z.object({
  tripId: z.string().min(1),
  weights: z
    .array(
      z.object({
        memberId: z.string().min(1),
        weight: z.coerce.number().finite().min(0).max(100),
      })
    )
    .min(1),
});

/** Record a settle-up payment outside the expense ledger (ODY-107). */
export const recordSettlementSchema = z
  .object({
    tripId: z.string().min(1),
    fromUserId: z.string().min(1),
    toUserId: z.string().min(1),
    amountCents: z.number().int().min(1).max(100_000_000),
    note: z.string().max(200).optional(),
  })
  .refine((d) => d.fromUserId !== d.toUserId, { message: "Can't settle with yourself", path: ["toUserId"] });

export const updateBudgetSchema = z.object({
  tripId: z.string().min(1),
  totalBudget: z.coerce.number().finite().min(0).max(10_000_000),
});

export const createPollSchema = z.object({
  tripId: z.string().min(1),
  rangeStart: dateString,
  rangeEnd: dateString,
  enabledBlocks: z.array(z.enum(["all_day", "morning", "afternoon", "evening"])).min(1),
  desiredLengthDays: z.coerce.number().int().min(1).optional(),
});

export const setSlotsSchema = z.object({
  tripId: z.string().min(1),
  // Cap the batch: a poll spans at most a few months × 4 blocks. 2000 is a
  // generous ceiling that prevents a member from forcing an enormous
  // upsert transaction (DoS).
  slots: z
    .array(
      z.object({
        date: dateString,
        block: z.enum(["all_day", "morning", "afternoon", "evening"]),
        status: z.enum(["available", "maybe", "unavailable"]),
      })
    )
    .max(2000),
});

// Clear a single availability slot back to "unset" (ODY-113). Always scoped
// to the caller's own userId server-side — never accepted from the client.
export const deleteSlotSchema = z.object({
  tripId: z.string().min(1),
  date: dateString,
  block: z.enum(["all_day", "morning", "afternoon", "evening"]),
});

export const applyWindowSchema = z.object({
  tripId: z.string().min(1),
  startDate: dateString,
  endDate: dateString,
});

/** Post-signup display name (ODY-044). */
export const updateDisplayNameSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(50),
  lastName: z.string().trim().max(50).optional().or(z.literal("")),
});

/** Candidate place in a trip collection (ODY-045). */
export const createPlaceSchema = z.object({
  tripId: z.string().min(1),
  category: z.enum(["flight", "hotel", "restaurant", "activity", "transport", "misc"]),
  title: z.string().min(1, "Title is required").max(200),
  location: z.string().max(300).optional().or(z.literal("")),
  notes: z.string().max(2000).optional().or(z.literal("")),
  lat: z.coerce.number().finite().optional(),
  lng: z.coerce.number().finite().optional(),
});

export const updatePlaceSchema = createPlaceSchema.omit({ tripId: true }).partial().extend({
  id: z.string().min(1),
});

/** Vibe search for Explore (ODY-049). */
export const exploreVibeSchema = z.object({
  tripId: z.string().min(1),
  vibe: z.string().trim().min(2, "Pick or type a vibe").max(80),
});

export const createChecklistItemSchema = z.object({
  tripId: z.string().min(1),
  label: z.string().trim().min(1, "Add an item first").max(160),
  scope: z.enum(["group", "personal"]),
});

export const checklistItemIdSchema = z.object({
  tripId: z.string().min(1),
  itemId: z.string().min(1),
});

export const assignChecklistItemSchema = checklistItemIdSchema.extend({
  assigneeId: z.string().min(1).nullable(),
});

/** Trip notes upsert patch (ODY-051) — plain OR TipTap doc, not both required. */
const NOTE_TEXT_MAX = 20_000;
/** Shared notes sections (ODY-104). */
const NOTE_SECTIONS_MAX = 20;
const NOTE_SECTION_TITLE_MAX = 80;
const noteSectionSchema = z.object({
  id: z.string().min(1).max(64),
  title: z.string().max(NOTE_SECTION_TITLE_MAX),
  text: z.string().max(NOTE_TEXT_MAX),
});
export const upsertNotePatchSchema = z.union([
  z.object({
    text: z.string().max(NOTE_TEXT_MAX),
  }),
  z.object({
    doc: z
      .object({ type: z.literal("doc") })
      .passthrough()
      .refine((d) => JSON.stringify(d).length <= 100_000, "Notes are too long"),
  }),
  z.object({
    sections: z.array(noteSectionSchema).max(NOTE_SECTIONS_MAX),
  }),
]);

export type CreateTripInput = z.infer<typeof createTripSchema>;
export type UpdateTripInput = z.infer<typeof updateTripSchema>;
export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
export type InviteCollaboratorInput = z.infer<typeof inviteCollaboratorSchema>;
export type UpdateSplitInput = z.infer<typeof updateSplitSchema>;
export type RecordSettlementInput = z.infer<typeof recordSettlementSchema>;
export type CreateTripWizardInput = z.infer<typeof createTripWizardSchema>;
export type CreatePollInput = z.infer<typeof createPollSchema>;
export type SetSlotsInput = z.infer<typeof setSlotsSchema>;
export type DeleteSlotInput = z.infer<typeof deleteSlotSchema>;
export type ApplyWindowInput = z.infer<typeof applyWindowSchema>;
export type UpdateDisplayNameInput = z.infer<typeof updateDisplayNameSchema>;
export type CreatePlaceInput = z.infer<typeof createPlaceSchema>;
export type UpdatePlaceInput = z.infer<typeof updatePlaceSchema>;
export type ExploreVibeInput = z.infer<typeof exploreVibeSchema>;
export type CreateChecklistItemInput = z.infer<typeof createChecklistItemSchema>;
export type UpsertNotePatchInput = z.infer<typeof upsertNotePatchSchema>;
