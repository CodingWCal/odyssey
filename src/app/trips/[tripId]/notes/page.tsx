import { getTripById } from "@/app/trips/actions";
import { db } from "@/lib/prisma/db";
import { TiptapEditor } from "@/components/notes/TiptapEditor";
import { normalizeTripNoteContent } from "@/lib/tripNotes";
import { notFound } from "next/navigation";

interface Props {
  params: Promise<{ tripId: string }>;
}

export default async function NotesPage({ params }: Props) {
  const { tripId } = await params;
  const trip = await getTripById(tripId);
  if (!trip) notFound();

  const note = await db.note.findUnique({
    where: { tripId },
    include: { user: { select: { name: true } } },
  });
  const normalized = normalizeTripNoteContent(note?.content);

  return (
    <div className="canvas canvas-narrow">
      <div className="notes-head">
        <h1>
          Trip <em>notes</em>
        </h1>
        <p className="sub">
          {trip.myRole === "viewer"
            ? "Shared pad for the whole crew. You have view-only access."
            : "Shared pad for the whole crew. Autosaves on blur."}
        </p>
      </div>

      <div className="notes-shell">
        <TiptapEditor
          tripId={tripId}
          initialContent={normalized.doc}
          lastUpdated={note?.updatedAt ?? null}
          lastUpdatedBy={note?.user?.name ?? null}
          readOnly={trip.myRole === "viewer"}
        />
      </div>
    </div>
  );
}
