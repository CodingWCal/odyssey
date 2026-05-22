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
});

export type CreateTripInput = z.infer<typeof createTripSchema>;
export type UpdateTripInput = z.infer<typeof updateTripSchema>;
export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type InviteCollaboratorInput = z.infer<typeof inviteCollaboratorSchema>;
