import type { Metadata } from "next";
import { getTripById } from "@/app/trips/actions";
import { db } from "@/lib/prisma/db";
import { WorkspaceSidebar } from "@/components/trips/WorkspaceSidebar";
import { MobileTabBar } from "@/components/trips/MobileTabBar";
import { MobileTripHeader } from "@/components/trips/MobileTripHeader";
import { clerkUserNeedsName } from "@/lib/auth";
import { currentUser } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";

interface WorkspaceLayoutProps {
  children: React.ReactNode;
  params: Promise<{ tripId: string }>;
}

/** Contextual tab title, e.g. "Tokyo — Odyssey" (ODY-026). Lightweight
 * title-only lookup; a trip title behind a UUID isn't sensitive and page
 * content stays access-gated, so this stays auth-free to avoid throwing in
 * metadata. Falls back to the root default on any miss. */
export async function generateMetadata({ params }: { params: Promise<{ tripId: string }> }): Promise<Metadata> {
  try {
    const { tripId } = await params;
    const trip = await db.trip.findUnique({ where: { id: tripId }, select: { title: true } });
    return trip?.title ? { title: trip.title } : {};
  } catch {
    return {};
  }
}

export default async function WorkspaceLayout({ children, params }: WorkspaceLayoutProps) {
  const user = await currentUser();
  if (user && clerkUserNeedsName(user)) redirect("/onboarding/name");

  const { tripId } = await params;
  const trip = await getTripById(tripId);
  if (!trip) notFound();

  // Trip-state signals that decide which non-core tabs the desktop sidebar
  // reveals up front vs. tucks under "More" (ODY-075).
  const navState = {
    hasPoll: trip.availabilityPoll !== null,
    hasPlaces: trip._count.places > 0,
    memberCount: trip.members.length,
    hasPackingItems: trip._count.checklistItems > 0,
  };

  return (
    <div className="app-shell">
      <WorkspaceSidebar trip={trip} canEdit={trip.myRole !== "viewer"} navState={navState} />
      <MobileTripHeader title={trip.title} tripId={trip.id} />
      <main className="main">{children}</main>
      <MobileTabBar tripId={trip.id} />
    </div>
  );
}
