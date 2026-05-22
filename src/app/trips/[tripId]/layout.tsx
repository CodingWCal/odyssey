import { getTripById } from "@/app/trips/actions";
import { WorkspaceSidebar } from "@/components/trips/WorkspaceSidebar";
import { notFound } from "next/navigation";

interface WorkspaceLayoutProps {
  children: React.ReactNode;
  params: Promise<{ tripId: string }>;
}

export default async function WorkspaceLayout({ children, params }: WorkspaceLayoutProps) {
  const { tripId } = await params;
  const trip = await getTripById(tripId);
  if (!trip) notFound();

  return (
    <div className="flex h-screen overflow-hidden bg-odyssey-mist">
      <WorkspaceSidebar trip={trip} />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
