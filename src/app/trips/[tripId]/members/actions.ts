"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { clerkClient } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma/db";
import { inviteCollaboratorSchema } from "@/lib/validations";
import { getOrCreateDbUser, assertTripRole } from "@/lib/auth";

const getDbUser = getOrCreateDbUser;

/**
 * Resolve the app's base URL from the incoming request so invite links point at
 * whatever host the app is actually served from (any port, preview, or prod
 * domain) instead of a static env value that can drift. Falls back to
 * NEXT_PUBLIC_APP_URL, then localhost.
 */
async function getAppOrigin(): Promise<string> {
  try {
    const h = await headers();
    const host = h.get("host");
    if (host) {
      const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
      return `${proto}://${host}`;
    }
  } catch {
    /* headers() unavailable — fall through */
  }
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

/**
 * Send a real Clerk invitation email for a trip. Revokes any existing pending
 * invitation for the address first, so a fresh email is actually delivered
 * (createInvitation with ignoreExisting would otherwise silently reuse the old
 * one without re-sending). Returns whether the email went out.
 */
async function sendTripInvitation(email: string, tripId: string): Promise<boolean> {
  try {
    const appUrl = await getAppOrigin();
    // Point at the public sign-up page (which renders Clerk's <SignUp> and
    // consumes the __clerk_ticket). Landing directly on the protected trip
    // route would 404 before the invitee can create their account. The trip is
    // carried via `after` so they land there once signed up.
    const after = encodeURIComponent(`/trips/${tripId}/itinerary`);
    const client = await clerkClient();

    try {
      // Paginate through ALL pending invitations — the default page size (10)
      // would otherwise hide the stale invite and no fresh email would go out
      // (ODY-006).
      const pageSize = 100;
      let offset = 0;
      const toRevoke: string[] = [];
      for (;;) {
        const page = await client.invitations.getInvitationList({
          status: "pending",
          limit: pageSize,
          offset,
        });
        for (const inv of page.data) {
          if (inv.emailAddress.toLowerCase() === email && inv.status === "pending") {
            toRevoke.push(inv.id);
          }
        }
        if (page.data.length < pageSize) break;
        offset += pageSize;
      }
      await Promise.all(toRevoke.map((id) => client.invitations.revokeInvitation(id)));
    } catch {
      /* listing/revoking is best-effort — proceed to create regardless */
    }

    await client.invitations.createInvitation({
      emailAddress: email,
      redirectUrl: `${appUrl}/sign-up?after=${after}`,
      publicMetadata: { tripId },
      ignoreExisting: true,
    });
    return true;
  } catch (err) {
    console.error("Clerk invitation failed:", err);
    return false;
  }
}

export interface InviteResult {
  ok: true;
  emailSent: boolean;
  existingUser: boolean;
  alreadyMember: boolean;
}

export async function inviteCollaborator(data: {
  email: string;
  tripId: string;
  role?: "editor" | "viewer";
}): Promise<InviteResult> {
  const dbUser = await getDbUser();

  // Inviting requires editor+ — viewers can't grow the member list (ODY-001).
  await assertTripRole(data.tripId, dbUser.id, "editor");

  const validated = inviteCollaboratorSchema.parse(data);
  const email = validated.email.toLowerCase().trim();
  const role = validated.role ?? "editor";

  let invitee = await db.user.findUnique({ where: { email } });

  // "New to the app" = no row yet, or only a placeholder awaiting first sign-in.
  const isNewToApp = !invitee || invitee.clerkId.startsWith("pending_");

  if (!invitee) {
    invitee = await db.user.create({
      data: {
        clerkId: `pending_${email}`,
        email,
        name: email.split("@")[0],
        avatarUrl: null,
      },
    });
  }

  const existing = await db.tripMember.findFirst({
    where: { tripId: validated.tripId, userId: invitee.id },
  });

  if (!existing) {
    await db.tripMember.create({
      data: { tripId: validated.tripId, userId: invitee.id, role },
    });
  }

  // Send a real invitation email via Clerk for users without an account yet.
  // Existing Clerk users can't be "invited" (they'd get a duplicate error) —
  // the trip membership above is enough; they'll see it on next sign-in.
  const emailSent = isNewToApp ? await sendTripInvitation(email, validated.tripId) : false;

  revalidatePath(`/trips/${validated.tripId}/members`);

  return {
    ok: true,
    emailSent,
    existingUser: !isNewToApp,
    alreadyMember: !!existing,
  };
}

/**
 * Re-send the invitation email to a member who hasn't signed up yet. Any trip
 * member can trigger this (mirrors who can invite).
 */
export async function resendInvite(
  memberId: string,
  tripId: string
): Promise<{ ok: true; emailSent: boolean; pending: boolean }> {
  const dbUser = await getDbUser();

  await assertTripRole(tripId, dbUser.id, "editor"); // mirrors who can invite (ODY-001)

  const target = await db.tripMember.findFirst({
    where: { id: memberId, tripId },
    include: { user: true },
  });
  if (!target) throw new Error("Member not found");

  // Only placeholder (not-yet-signed-up) users can be re-invited.
  if (!target.user.clerkId.startsWith("pending_")) {
    return { ok: true, emailSent: false, pending: false };
  }

  const emailSent = await sendTripInvitation(target.user.email, tripId);
  revalidatePath(`/trips/${tripId}/members`);
  return { ok: true, emailSent, pending: true };
}

export async function removeMember(memberId: string, tripId: string) {
  const dbUser = await getDbUser();

  const requester = await db.tripMember.findFirst({
    where: { tripId, userId: dbUser.id, role: "owner" },
  });
  if (!requester) throw new Error("Only owners can remove members");

  // Scope the delete to this trip so a member id from another trip can't be hit.
  await db.tripMember.deleteMany({ where: { id: memberId, tripId } });
  revalidatePath(`/trips/${tripId}/members`);
}
