"use server";

import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/prisma/db";

async function getDbUser() {
  const user = await currentUser();
  if (!user) throw new Error("Unauthorized");
  let dbUser = await db.user.findUnique({ where: { clerkId: user.id } });
  if (!dbUser) {
    dbUser = await db.user.create({
      data: {
        clerkId: user.id,
        email: user.emailAddresses[0]?.emailAddress ?? "",
        name: `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || "Traveler",
        avatarUrl: user.imageUrl ?? null,
      },
    });
  }
  return dbUser;
}

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
