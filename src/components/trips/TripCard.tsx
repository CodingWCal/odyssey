import Link from "next/link";
import { AvatarGroup } from "@/components/shared/AvatarGroup";
import { formatShortDate } from "@/lib/utils";

interface TripCardProps {
  id: string;
  title: string;
  destination: string;
  startDate: Date;
  endDate: Date;
  coverImageUrl: string | null;
  members: { name: string; avatarUrl: string | null }[];
}

const DESTINATION_GRADIENTS = [
  "from-odyssey-slate to-odyssey-periwinkle",
  "from-odyssey-teal to-odyssey-slate",
  "from-odyssey-coral to-odyssey-peach",
  "from-odyssey-periwinkle to-odyssey-teal",
];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) & 0xffffffff;
  }
  return Math.abs(hash);
}

export function TripCard({ id, title, destination, startDate, endDate, coverImageUrl, members }: TripCardProps) {
  const gradient = DESTINATION_GRADIENTS[hashString(id) % DESTINATION_GRADIENTS.length];

  return (
    <Link href={`/trips/${id}/itinerary`} className="group block">
      <div className="rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow bg-white border border-odyssey-cream">
        <div
          className={`h-32 bg-gradient-to-br ${gradient} relative`}
          style={coverImageUrl ? { backgroundImage: `url(${coverImageUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : {}}
        >
          <div className="absolute inset-0 bg-black/20" />
          <div className="absolute bottom-3 left-3">
            <p className="text-white text-xs font-medium opacity-80">{destination}</p>
          </div>
        </div>

        <div className="p-4">
          <h3 className="font-heading text-odyssey-ink text-lg leading-tight group-hover:text-odyssey-teal transition-colors">
            {title}
          </h3>
          <p className="text-xs text-odyssey-periwinkle mt-1 font-mono">
            {formatShortDate(startDate)} → {formatShortDate(endDate)}
          </p>
          <div className="mt-3 flex items-center justify-between">
            <AvatarGroup users={members} />
            <span className="text-xs text-odyssey-slate">{members.length} traveler{members.length !== 1 ? "s" : ""}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
