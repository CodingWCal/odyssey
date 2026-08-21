import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma/db";

type ClerkNameFields = { firstName: string | null; lastName: string | null };

/** True when Clerk has no first/last name (email sign-ups without Name fields). */
export function clerkUserNeedsName(user: ClerkNameFields): boolean {
  return !`${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();
}

function displayNameFromClerk(user: ClerkNameFields): string {
  return `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || "Traveler";
}

/**
 * Resolve the Clerk-authenticated user to its row in our database, creating it
 * on first sight. Resilient to the case where a row with the same email already
 * exists under a *stale* clerkId (e.g. a re-created Clerk account): rather than
 * failing on the unique-email constraint (P2002), it relinks that row to the
 * current clerkId. This is the single source of truth for user sync.
 *
 * Also re-syncs the stored name whenever it's drifted from Clerk's — not just
 * the literal "Traveler" placeholder (ODY-044), but any stale value: an invite
 * placeholder named from the email prefix (e.g. "mandy.wong", set before the
 * invitee ever signs in — see members/actions.ts), a name set later in Clerk,
 * etc. `User.name` has exactly one other writer (onboarding/actions.ts), which
 * mirrors into Clerk too, so Clerk's name is always the source of truth here —
 * nothing else can legitimately diverge from it.
 *
 * Note the one real limit: this only runs for *this* signed-in user each call,
 * so a stale name for a *different* trip member only self-heals the next time
 * that member loads a page (there's no session to pull their fresh Clerk name
 * from otherwise). If a name looks wrong on someone else's screen, having that
 * member sign in once (or just load any page) fixes it everywhere they appear.
 */
export async function getOrCreateDbUser() {
  const user = await currentUser();
  if (!user) throw new Error("Unauthorized");

  const email = user.emailAddresses[0]?.emailAddress ?? "";
  const name = displayNameFromClerk(user);
  const avatarUrl = user.imageUrl ?? null;

  const byClerk = await db.user.findUnique({ where: { clerkId: user.id } });
  if (byClerk) {
    if (name !== "Traveler" && byClerk.name !== name) {
      return db.user.update({
        where: { id: byClerk.id },
        data: { name, avatarUrl },
      });
    }
    return byClerk;
  }

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
