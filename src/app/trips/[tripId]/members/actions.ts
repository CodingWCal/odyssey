"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/prisma/db";
import { inviteCollaboratorSchema } from "@/lib/validations";
import { getOrCreateDbUser } from "@/lib/auth";

const getDbUser = getOrCreateDbUser;

export async function inviteCollaborator(data: { email: string; tripId: string }) {
  const dbUser = await getDbUser();

  const member = await db.tripMember.findFirst({
    where: { tripId: data.tripId, userId: dbUser.id },
  });
  if (!member) throw new Error("Unauthorized");

  const validated = inviteCollaboratorSchema.parse(data);

  let invitee = await db.user.findUnique({ where: { email: validated.email } });

  if (!invitee) {
    // Create a placeholder user — they'll link their Clerk account on first sign-in
    invitee = await db.user.create({
      data: {
        clerkId: `pending_${validated.email}`,
        email: validated.email,
        name: validated.email.split("@")[0],
        avatarUrl: null,
      },
    });
  }

  const existing = await db.tripMember.findFirst({
    where: { tripId: validated.tripId, userId: invitee.id },
  });

  if (!existing) {
    await db.tripMember.create({
      data: { tripId: validated.tripId, userId: invitee.id, role: "editor" },
    });
  }

  revalidatePath(`/trips/${validated.tripId}/members`);
}

export async function removeMember(memberId: string, tripId: string) {
  const dbUser = await getDbUser();

  const requester = await db.tripMember.findFirst({
    where: { tripId, userId: dbUser.id, role: "owner" },
  });
  if (!requester) throw new Error("Only owners can remove members");

  await db.tripMember.delete({ where: { id: memberId } });
  revalidatePath(`/trips/${tripId}/members`);
}
