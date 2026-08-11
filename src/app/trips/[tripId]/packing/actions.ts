"use server";

import { revalidatePath } from "next/cache";
import { assertTripRole, getOrCreateDbUser } from "@/lib/auth";
import { db } from "@/lib/prisma/db";
import { assignChecklistItemSchema, checklistItemIdSchema, createChecklistItemSchema } from "@/lib/validations";
import { visiblePackingWhere } from "@/lib/packing";
import { parseChecklistLines } from "@/lib/checklist";
import { applySectionsPatch, normalizeTripNoteContent } from "@/lib/tripNotes";

const pathFor = (tripId: string) => `/trips/${tripId}/packing`;

async function visibleItem(tripId: string, itemId: string, userId: string) {
  return db.checklistItem.findFirst({ where: { id: itemId, ...visiblePackingWhere(tripId, userId) } });
}

export async function addChecklistItem(input: { tripId: string; label: string; scope: "group" | "personal" }) {
  const user = await getOrCreateDbUser();
  await assertTripRole(input.tripId, user.id, "editor");
  const data = createChecklistItemSchema.parse(input);
  const last = await db.checklistItem.aggregate({ where: { tripId: data.tripId, ownerId: data.scope === "personal" ? user.id : null }, _max: { orderIndex: true } });
  await db.checklistItem.create({ data: { tripId: data.tripId, label: data.label, ownerId: data.scope === "personal" ? user.id : null, orderIndex: (last._max.orderIndex ?? -1) + 1 } });
  revalidatePath(pathFor(data.tripId));
}

export async function toggleChecklistItem(input: { tripId: string; itemId: string }) {
  const user = await getOrCreateDbUser();
  await assertTripRole(input.tripId, user.id, "editor");
  const data = checklistItemIdSchema.parse(input);
  const item = await visibleItem(data.tripId, data.itemId, user.id);
  if (!item) throw new Error("Not found");
  await db.checklistItem.update({ where: { id: item.id }, data: { done: !item.done } });
  revalidatePath(pathFor(data.tripId));
}

export async function removeChecklistItem(input: { tripId: string; itemId: string }) {
  const user = await getOrCreateDbUser();
  await assertTripRole(input.tripId, user.id, "editor");
  const data = checklistItemIdSchema.parse(input);
  const item = await visibleItem(data.tripId, data.itemId, user.id);
  if (!item) throw new Error("Not found");
  await db.checklistItem.delete({ where: { id: item.id } });
  revalidatePath(pathFor(data.tripId));
}

export async function assignChecklistItem(input: { tripId: string; itemId: string; assigneeId: string | null }) {
  const user = await getOrCreateDbUser();
  await assertTripRole(input.tripId, user.id, "editor");
  const data = assignChecklistItemSchema.parse(input);
  const item = await db.checklistItem.findFirst({ where: { id: data.itemId, tripId: data.tripId, ownerId: null } });
  if (!item) throw new Error("Not found");
  if (data.assigneeId) {
    const member = await db.tripMember.findFirst({ where: { tripId: data.tripId, userId: data.assigneeId } });
    if (!member) throw new Error("Invalid assignee");
  }
  await db.checklistItem.update({ where: { id: item.id }, data: { assigneeId: data.assigneeId } });
  revalidatePath(pathFor(data.tripId));
}

/** One-time handoff from ODY-104's free-text Packing List section. */
export async function importLegacyPackingList(tripId: string) {
  const user = await getOrCreateDbUser();
  await assertTripRole(tripId, user.id, "editor");
  const note = await db.note.findUnique({ where: { tripId } });
  if (!note) return 0;
  const content = normalizeTripNoteContent(note.content);
  const section = content.sections.find((s) => s.title === "Packing List");
  if (!section?.text.trim()) return 0;
  const labels = parseChecklistLines(section.text).map((line) => line.text.trim()).filter(Boolean).slice(0, 100);
  if (!labels.length) return 0;
  const last = await db.checklistItem.aggregate({ where: { tripId, ownerId: null }, _max: { orderIndex: true } });
  const importedContent = JSON.parse(JSON.stringify(applySectionsPatch(
    content,
    content.sections.map((s) => s === section ? { ...s, title: "Packing List (imported)" } : s)
  ))) as object;
  await db.$transaction([
    db.checklistItem.createMany({ data: labels.map((label, i) => ({ tripId, label: label.slice(0, 160), done: false, orderIndex: (last._max.orderIndex ?? -1) + i + 1 })) }),
    db.note.update({ where: { tripId }, data: { content: importedContent, updatedBy: user.id } }),
  ]);
  revalidatePath(pathFor(tripId));
  revalidatePath(`/trips/${tripId}/itinerary`);
  return labels.length;
}
