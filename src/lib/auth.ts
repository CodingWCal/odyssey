import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma/db";

/**
 * Resolve the Clerk-authenticated user to its row in our database, creating it
 * on first sight. Resilient to the case where a row with the same email already
 * exists under a *stale* clerkId (e.g. a re-created Clerk account): rather than
 * failing on the unique-email constraint (P2002), it relinks that row to the
 * current clerkId. This is the single source of truth for user sync.
 */
export async function getOrCreateDbUser() {
  const user = await currentUser();
  if (!user) throw new Error("Unauthorized");

  const byClerk = await db.user.findUnique({ where: { clerkId: user.id } });
  if (byClerk) return byClerk;

  const email = user.emailAddresses[0]?.emailAddress ?? "";
  const name = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || "Traveler";
  const avatarUrl = user.imageUrl ?? null;

  if (email) {
    const byEmail = await db.user.findUnique({ where: { email } });
    if (byEmail) {
      return db.user.update({
        where: { id: byEmail.id },
        data: { clerkId: user.id, name, avatarUrl },
      });
    }
  }

  return db.user.create({
    data: { clerkId: user.id, email, name, avatarUrl },
  });
}
