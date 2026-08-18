import { getTripsByUser } from "@/app/trips/actions";
import { db } from "@/lib/prisma/db";
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { DashboardClient } from "@/components/trips/DashboardClient";
import type { DashTrip } from "@/components/trips/TripCard";
import { resolveCover } from "@/components/trips/cover";
import { clerkUserNeedsName, getOrCreateDbUser } from "@/lib/auth";
import type { Metadata } from "next";

// Renders as "Your trips — Odyssey" via the root title template (ODY-026).
export const metadata: Metadata = { title: "Your trips" };

function fmtDate(d: Date) {
  // Trip dates are UTC-midnight (ODY-003) — format in UTC so US timezones
  // never see an off-by-one (ODY-098).
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function daysBetween(a: Date, b: Date) {
  return Math.max(1, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000) + 1);
}

export default async function DashboardPage() {
  const user = await currentUser();
  // ODY-044: email sign-ups without a Clerk name land here as "Traveler".
  if (user && clerkUserNeedsName(user)) redirect("/onboarding/name");

  const [trips, dbUser] = await Promise.all([getTripsByUser(), getOrCreateDbUser()]);
  const firstName = user?.firstName ?? "traveler";

  const ids = trips.map((t: (typeof trips)[number]) => t.id);
  const spendRows = ids.length
    ? await db.expense.groupBy({ by: ["tripId"], where: { tripId: { in: ids } }, _sum: { amount: true } })
    : [];
  const spentByTrip = new Map<string, number>(
    spendRows.map((r: (typeof spendRows)[number]) => [r.tripId, r._sum.amount ?? 0])
  );

  const now = new Date();

  const dashTrips: DashTrip[] = trips.map((t: (typeof trips)[number]) => {
    const start = new Date(t.startDate);
    const end = new Date(t.endDate);
    const endOfDay = new Date(end);
    endOfDay.setHours(23, 59, 59, 999);

    let status: DashTrip["status"];
    let countdown: string;
    if (start <= now && now <= endOfDay) {
      status = "live";
      countdown = "In progress";
    } else if (start > now) {
      status = "upcoming";
      const d = Math.ceil((start.getTime() - now.getTime()) / 86400000);
      countdown = d <= 1 ? "Starts tomorrow" : `In ${d} days`;
    } else {
      status = "past";
      countdown = "Wrapped";
    }

    return {
      id: t.id,
      title: t.title,
      destination: t.destination,
      startStr: fmtDate(start),
      endStr: fmtDate(end),
      days: daysBetween(start, end),
      spent: spentByTrip.get(t.id) ?? 0,
      cost: t.totalBudget ?? 0,
      currency: t.currency ?? "USD",
      status,
      countdown,
      cover: resolveCover(t.coverImageUrl, t.id),
      members: t.members.map((m: (typeof t.members)[number]) => ({ id: m.id, name: m.user?.name ?? "Traveler" })),
      archived: t.archivedAt != null,
      isOwner: t.ownerId === dbUser.id,
    };
  });

  return <DashboardClient firstName={firstName} trips={dashTrips} />;
}
