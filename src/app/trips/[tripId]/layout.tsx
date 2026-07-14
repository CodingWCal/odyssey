import { getTripById } from "@/app/trips/actions";
import { WorkspaceSidebar } from "@/components/trips/WorkspaceSidebar";
import { MobileTabBar } from "@/components/trips/MobileTabBar";
import { MobileTripHeader } from "@/components/trips/MobileTripHeader";
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
      <MobileTripHeader title={trip.title} />
      <main className="main">{children}</main>
      <MobileTabBar tripId={trip.id} />
    </div>
  );
}
