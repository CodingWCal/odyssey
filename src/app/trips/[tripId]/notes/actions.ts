"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/prisma/db";
import { getOrCreateDbUser, assertTripRole } from "@/lib/auth";
import { upsertNotePatchSchema } from "@/lib/validations";
import {
  applyPlainPatch,
  applyRichPatch,
  assertNotePayloadSize,
  type TripNoteDoc,
} from "@/lib/tripNotes";

const getDbUser = getOrCreateDbUser;

/**
 * Upsert trip-level notes (ODY-051).
 * Plain `{ text }` and TipTap `{ doc }` patches write one v1 shape so
 * neither surface blanks the other (text + TipTap doc stay in sync).
 */
export async function upsertNote(
  tripId: string,
  patch: { text: string } | { doc: object }
) {
  const dbUser = await getDbUser();

  await assertTripRole(tripId, dbUser.id, "editor"); // viewers read-only (ODY-001)

  const validated = upsertNotePatchSchema.parse(patch);

  const next =
    "text" in validated
      ? applyPlainPatch(validated.text)
      : applyRichPatch(validated.doc as TripNoteDoc);

  assertNotePayloadSize(next);

  // Prisma Json needs a plain object graph (not our branded TS types).
  const content = JSON.parse(JSON.stringify(next)) as object;

  await db.note.upsert({
    where: { tripId },
    create: { tripId, content, updatedBy: dbUser.id },
    update: { content, updatedBy: dbUser.id },
  });

  revalidatePath(`/trips/${tripId}/notes`);
  revalidatePath(`/trips/${tripId}/itinerary`);
}
