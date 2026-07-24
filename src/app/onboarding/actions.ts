"use server";

import { auth, clerkClient, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/prisma/db";
import { updateDisplayNameSchema } from "@/lib/validations";

/**
 * Save the traveler's display name to Clerk and our User row (ODY-044).
 * Used by the post-signup fallback when Clerk Name fields aren't required yet.
 */
export async function saveDisplayName(formData: FormData) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const validated = updateDisplayNameSchema.parse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName") || "",
  });

  const firstName = validated.firstName;
  const lastName = validated.lastName?.trim() || "";
  const fullName = `${firstName}${lastName ? ` ${lastName}` : ""}`;

  const client = await clerkClient();
  await client.users.updateUser(userId, {
    firstName,
    lastName: lastName || undefined,
  });

  const existing = await db.user.findUnique({ where: { clerkId: userId } });
  if (existing) {
    await db.user.update({ where: { id: existing.id }, data: { name: fullName } });
  } else {
    const user = await currentUser();
    const email = user?.emailAddresses[0]?.emailAddress ?? "";
    await db.user.create({
      data: {
        clerkId: userId,
        email,
        name: fullName,
        avatarUrl: user?.imageUrl ?? null,
      },
    });
  }

  redirect("/dashboard");
}
