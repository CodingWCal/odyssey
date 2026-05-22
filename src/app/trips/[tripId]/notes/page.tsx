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
    <div className="px-6 py-8 md:pb-8 pb-24 max-w-3xl">
      <div className="mb-6">
        <h1 className="font-heading text-3xl text-odyssey-ink">Notes</h1>
        <p className="text-odyssey-slate text-sm mt-1">Shared pad for the whole crew. Autosaves on blur.</p>
      </div>

      <TiptapEditor
        tripId={tripId}
        initialContent={note?.content as object | null}
        lastUpdated={note?.updatedAt ?? null}
        lastUpdatedBy={note?.user?.name ?? null}
      />
    </div>
  );
}
