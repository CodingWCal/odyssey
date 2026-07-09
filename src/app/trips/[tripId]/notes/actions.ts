"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/prisma/db";
import { getOrCreateDbUser, assertTripRole } from "@/lib/auth";

const getDbUser = getOrCreateDbUser;

export async function upsertNote(tripId: string, content: object) {
  const dbUser = await getDbUser();

  await assertTripRole(tripId, dbUser.id, "editor"); // viewers read-only (ODY-001)

  await db.note.upsert({
    where: { tripId },
    create: { tripId, content, updatedBy: dbUser.id },
    update: { content, updatedBy: dbUser.id },
  });

  revalidatePath(`/trips/${tripId}/notes`);
}
