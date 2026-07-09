import { getTripById } from "@/app/trips/actions";
import { db } from "@/lib/prisma/db";
import { TiptapEditor } from "@/components/notes/TiptapEditor";
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

  return (
    <div className="canvas" style={{ maxWidth: 680 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 40, margin: "0 0 6px", color: "var(--ink)" }}>
          Trip <em style={{ fontStyle: "italic", color: "var(--peri)" }}>notes</em>
        </h1>
        <p style={{ color: "var(--ink-2)", fontSize: 13.5, margin: 0 }}>
          {trip.myRole === "viewer"
            ? "Shared pad for the whole crew. You have view-only access."
            : "Shared pad for the whole crew. Autosaves on blur."}
        </p>
      </div>

      <div style={{
        background: "var(--paper-2)", border: "1px solid var(--rule)",
        borderRadius: "var(--radius-lg)", padding: "22px 24px",
      }}>
        <TiptapEditor
          tripId={tripId}
          initialContent={note?.content as object | null}
          lastUpdated={note?.updatedAt ?? null}
          lastUpdatedBy={note?.user?.name ?? null}
          readOnly={trip.myRole === "viewer"}
        />
      </div>
    </div>
  );
}
