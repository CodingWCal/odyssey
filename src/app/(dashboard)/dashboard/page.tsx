import { getTripsByUser } from "@/app/trips/actions";
import { TripCard } from "@/components/trips/TripCard";
import { Button } from "@/components/ui/button";
import { UserButton } from "@clerk/nextjs";
import Link from "next/link";

export default async function DashboardPage() {
  const trips = await getTripsByUser();

  return (
    <div className="min-h-screen bg-odyssey-mist">
      <header className="bg-odyssey-ink text-white px-6 py-4 flex items-center justify-between">
        <h1 className="font-heading text-2xl">Odyssey</h1>
        <div className="flex items-center gap-4">
          <Link href="/trips/new">
            <Button className="bg-odyssey-teal hover:bg-odyssey-teal/90 text-white rounded-xl text-sm">
              + New Trip
            </Button>
          </Link>
          <UserButton />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h2 className="font-heading text-3xl text-odyssey-ink">Your Trips</h2>
            <p className="text-odyssey-slate text-sm mt-1">
              {trips.length === 0 ? "No adventures yet — let's plan one." : `${trips.length} adventure${trips.length !== 1 ? "s" : ""} planned`}
            </p>
          </div>
        </div>

        {trips.length === 0 ? (
          <div className="text-center py-24 bg-white rounded-2xl border border-odyssey-cream">
            <p className="text-5xl mb-4" aria-hidden="true">✈️</p>
            <h3 className="font-heading text-2xl text-odyssey-ink mb-2">Ready for your first trip?</h3>
            <p className="text-odyssey-slate mb-6">Create your first trip and start building your itinerary.</p>
            <Link href="/trips/new">
              <Button className="bg-odyssey-teal hover:bg-odyssey-teal/90 text-white rounded-xl">
                Plan Your First Trip
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {trips.map((trip: (typeof trips)[number]) => (
              <TripCard
                key={trip.id}
                id={trip.id}
                title={trip.title}
                destination={trip.destination}
                startDate={trip.startDate}
                endDate={trip.endDate}
                coverImageUrl={trip.coverImageUrl}
                members={trip.members.map((m: (typeof trip.members)[number]) => ({ name: m.user.name, avatarUrl: m.user.avatarUrl }))}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
