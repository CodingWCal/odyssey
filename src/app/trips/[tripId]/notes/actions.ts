"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/prisma/db";
import { getOrCreateDbUser } from "@/lib/auth";

const getDbUser = getOrCreateDbUser;

export async function upsertNote(tripId: string, content: object) {
  const dbUser = await getDbUser();

  const member = await db.tripMember.findFirst({ where: { tripId, userId: dbUser.id } });
  if (!member) throw new Error("Unauthorized");

  await db.note.upsert({
    where: { tripId },
    create: { tripId, content, updatedBy: dbUser.id },
    update: { content, updatedBy: dbUser.id },
  });

  revalidatePath(`/trips/${tripId}/notes`);
}
