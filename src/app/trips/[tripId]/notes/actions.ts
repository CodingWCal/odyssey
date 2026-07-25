"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/prisma/db";
import { getOrCreateDbUser, assertTripRole } from "@/lib/auth";

const getDbUser = getOrCreateDbUser;

/** Soft cap on Note.content JSON size (ODY-056). */
const NOTE_JSON_MAX = 100_000;

export async function upsertNote(tripId: string, content: object) {
  const dbUser = await getDbUser();

  await assertTripRole(tripId, dbUser.id, "editor"); // viewers read-only (ODY-001)

  if (!content || typeof content !== "object" || Array.isArray(content)) {
    throw new Error("Invalid notes");
  }
  if (JSON.stringify(content).length > NOTE_JSON_MAX) {
    throw new Error("Notes are too long");
  }

  await db.note.upsert({
    where: { tripId },
    create: { tripId, content, updatedBy: dbUser.id },
    update: { content, updatedBy: dbUser.id },
  });

  revalidatePath(`/trips/${tripId}/notes`);
}
