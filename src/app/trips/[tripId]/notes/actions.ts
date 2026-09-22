"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { db } from "@/lib/prisma/db";
import { getOrCreateDbUser, assertTripRole } from "@/lib/auth";
import { upsertNotePatchSchema } from "@/lib/validations";
import {
  applyPlainPatch,
  applyRichPatch,
  applySectionsPatch,
  assertNotePayloadSize,
  normalizeTripNoteContent,
  type TripNoteDoc,
  type TripNoteSection,
} from "@/lib/tripNotes";

const getDbUser = getOrCreateDbUser;

// Per-trip cookie recording dismissal of the ODY-126 "what else can I add
// here" notes-sections hint — same one-time, per-trip pattern as the ODY-085
// join-welcome cookie in app/trips/actions.ts. Not exported: a "use server"
// file can only export async functions, so reads go through the async
// getNotesHintDismissed below instead of exposing the cookie name directly.
const notesHintCookie = (tripId: string) => `ody-notes-hint-${tripId}`;

export async function getNotesHintDismissed(tripId: string): Promise<boolean> {
  return (await cookies()).has(notesHintCookie(tripId));
}

/**
 * Persist that a member has seen the ODY-126 notes-sections hint so it
 * doesn't nag on a later visit. Gated on membership like dismissJoinWelcome;
 * best-effort — failure just means the hint may show once more.
 */
export async function dismissNotesHint(tripId: string) {
  let dbUser;
  try {
    dbUser = await getDbUser();
  } catch {
    return;
  }
  const member = await db.tripMember.findFirst({ where: { tripId, userId: dbUser.id } });
  if (!member) return;

  (await cookies()).set(notesHintCookie(tripId), "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

/**
 * Upsert trip-level notes (ODY-051 / ODY-056 / ODY-104).
 * Plain `{ text }`, TipTap `{ doc }`, and `{ sections }` patches all write
 * the same v1 shape. The text/doc patches rebuild content from scratch, so
 * we read the existing row first and carry over whatever the current patch
 * doesn't touch — otherwise saving the pinned note would drop sections and
 * vice versa. Payload size is capped (ODY-056).
 */
export async function upsertNote(
  tripId: string,
  patch: { text: string } | { doc: object } | { sections: TripNoteSection[] }
) {
  const dbUser = await getDbUser();

  await assertTripRole(tripId, dbUser.id, "editor"); // viewers read-only (ODY-001)

  const validated = upsertNotePatchSchema.parse(patch);

  const existing = await db.note.findUnique({ where: { tripId }, select: { content: true } });
  const current = normalizeTripNoteContent(existing?.content);

  const next =
    "text" in validated
      ? applyPlainPatch(validated.text, current.sections)
      : "doc" in validated
        ? applyRichPatch(validated.doc as TripNoteDoc, current.sections)
        : applySectionsPatch(current, validated.sections);

  assertNotePayloadSize(next);

  // Prisma Json needs a plain object graph (not our branded TS types).
  const content = JSON.parse(JSON.stringify(next)) as object;

  await db.note.upsert({
    where: { tripId },
    create: { tripId, content, updatedBy: dbUser.id },
    update: { content, updatedBy: dbUser.id },
  });

  // Notes now live only on the itinerary (ODY-060) — the standalone /notes
  // route was removed, so there's a single write path and one place to refresh.
  revalidatePath(`/trips/${tripId}/itinerary`);
}
