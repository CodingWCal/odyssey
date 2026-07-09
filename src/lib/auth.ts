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

export type TripRole = "viewer" | "editor" | "owner";

const ROLE_RANK: Record<TripRole, number> = { viewer: 0, editor: 1, owner: 2 };

/**
 * Assert the user is a member of the trip with at least `minRole`
 * (owner > editor > viewer). Viewers are read-only: every mutating server
 * action must require at least "editor" (ODY-001). Returns the membership row.
 */
export async function assertTripRole(
  tripId: string,
  userId: string,
  minRole: TripRole = "viewer"
) {
  const member = await db.tripMember.findFirst({ where: { tripId, userId } });
  const rank = ROLE_RANK[member?.role as TripRole] ?? -1;
  if (!member || rank < ROLE_RANK[minRole]) throw new Error("Unauthorized");
  return member;
}
