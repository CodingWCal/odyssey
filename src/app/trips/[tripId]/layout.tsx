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
    <div className="app-shell">
      <WorkspaceSidebar trip={trip} canEdit={trip.myRole !== "viewer"} />
      <main className="main">{children}</main>
    </div>
  );
}
