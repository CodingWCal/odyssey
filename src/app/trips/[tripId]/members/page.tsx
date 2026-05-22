import { getTripById } from "@/app/trips/actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { notFound } from "next/navigation";
import { InviteForm } from "@/components/trips/InviteForm";

interface Props {
  params: Promise<{ tripId: string }>;
}

export default async function MembersPage({ params }: Props) {
  const { tripId } = await params;
  const trip = await getTripById(tripId);
  if (!trip) notFound();

  return (
    <div className="px-6 py-8 md:pb-8 pb-24 max-w-2xl">
      <div className="mb-6">
        <h1 className="font-heading text-3xl text-odyssey-ink">Members</h1>
        <p className="text-odyssey-slate text-sm mt-1">{trip.members.length} traveler{trip.members.length !== 1 ? "s" : ""}</p>
      </div>

      <div className="bg-white rounded-2xl border border-odyssey-cream overflow-hidden mb-6">
        {trip.members.map((member: (typeof trip.members)[number]) => (
          <div key={member.id} className="flex items-center gap-3 px-4 py-3 border-b border-odyssey-cream last:border-0">
            <Avatar className="h-9 w-9">
              <AvatarImage src={member.user.avatarUrl ?? undefined} alt={member.user.name} />
              <AvatarFallback className="bg-odyssey-periwinkle text-white text-sm">
                {member.user.name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-odyssey-ink">{member.user.name}</p>
              <p className="text-xs text-odyssey-slate truncate">{member.user.email}</p>
            </div>
            <Badge
              variant="outline"
              className={member.role === "owner" ? "border-odyssey-teal text-odyssey-teal" : "border-odyssey-slate text-odyssey-slate"}
            >
              {member.role}
            </Badge>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-odyssey-cream p-5">
        <h2 className="font-heading text-lg text-odyssey-ink mb-4">Invite by Email</h2>
        <InviteForm tripId={tripId} />
      </div>
    </div>
  );
}
