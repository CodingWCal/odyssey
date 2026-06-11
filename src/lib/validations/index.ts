import { z } from "zod";

export const createTripSchema = z.object({
  title: z.string().min(1, "Title is required").max(100),
  destination: z.string().min(1, "Destination is required").max(200),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  coverImageUrl: z.string().url().optional().or(z.literal("")),
  totalBudget: z.coerce.number().min(0).optional(),
});

export const updateTripSchema = createTripSchema.partial();

export const createTripWizardSchema = z.object({
  title: z.string().min(1, "Trip name is required").max(100),
  destination: z.string().min(1, "Destination is required").max(200),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
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
  cost: z.coerce.number().min(0).optional(),
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
  destLocation: z.string().max(300).optional().or(z.literal("")),
  destLat: z.coerce.number().optional(),
  destLng: z.coerce.number().optional(),
});

export const updateEventSchema = createEventSchema.partial().omit({ dayId: true, tripId: true });

export const createExpenseSchema = z.object({
  tripId: z.string().min(1),
  eventId: z.string().optional().or(z.literal("")),
  label: z.string().min(1, "Label is required").max(200),
  amount: z.coerce.number().min(0.01, "Amount must be greater than 0"),
  category: z.enum(["flights", "lodging", "food", "transport", "activities", "misc"]),
});

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
        weight: z.coerce.number().min(0),
      })
    )
    .min(1),
});

export const createPollSchema = z.object({
  tripId: z.string().min(1),
  rangeStart: z.string().min(1),
  rangeEnd: z.string().min(1),
  enabledBlocks: z.array(z.enum(["all_day", "morning", "afternoon", "evening"])).min(1),
  desiredLengthDays: z.coerce.number().int().min(1).optional(),
});

export const setSlotsSchema = z.object({
  tripId: z.string().min(1),
  slots: z.array(
    z.object({
      date: z.string().min(1),
      block: z.enum(["all_day", "morning", "afternoon", "evening"]),
      status: z.enum(["available", "maybe", "unavailable"]),
    })
  ),
});

export const applyWindowSchema = z.object({
  tripId: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
});

export type CreateTripInput = z.infer<typeof createTripSchema>;
export type UpdateTripInput = z.infer<typeof updateTripSchema>;
export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type InviteCollaboratorInput = z.infer<typeof inviteCollaboratorSchema>;
export type UpdateSplitInput = z.infer<typeof updateSplitSchema>;
export type CreateTripWizardInput = z.infer<typeof createTripWizardSchema>;
export type CreatePollInput = z.infer<typeof createPollSchema>;
export type SetSlotsInput = z.infer<typeof setSlotsSchema>;
export type ApplyWindowInput = z.infer<typeof applyWindowSchema>;
