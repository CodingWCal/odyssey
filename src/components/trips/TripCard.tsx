import Link from "next/link";
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

const COVER_GRADIENTS = [
  "linear-gradient(135deg, #F8C49A 0%, #E8B5C9 35%, #6F66B7 75%, #2A2F58 100%)",
  "linear-gradient(135deg, #F5D9B0 0%, #E68A6D 50%, #C9533F 100%)",
  "linear-gradient(135deg, #6CA9B5 0%, #4A6B8C 45%, #2A2F58 100%)",
  "linear-gradient(155deg, #C8DCEC 0%, #7F9EC4 45%, #4A6B8C 100%)",
  "linear-gradient(140deg, #E29A6E 0%, #C9533F 50%, #6E2A2A 100%)",
  "linear-gradient(160deg, #B7C8D6 0%, #6F8AA8 40%, #3D4A66 90%)",
  "linear-gradient(135deg, #CFE3D4 0%, #82B89C 40%, #2E7D5A 90%)",
  "linear-gradient(140deg, #F5C9A8 0%, #D6A24A 45%, #8C6C2F 100%)",
];

const COVER_ACCENT = "radial-gradient(60% 70% at 80% 20%, rgba(255,255,255,.22) 0%, transparent 55%)";

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) & 0xffffffff;
  }
  return Math.abs(hash);
}

function getDays(start: Date, end: Date): number {
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
}

export function TripCard({ id, title, destination, startDate, endDate, coverImageUrl, members }: TripCardProps) {
  const gradient = COVER_GRADIENTS[hashString(id) % COVER_GRADIENTS.length];
  const days = getDays(startDate, endDate);

  // Split title for italic styling on last word
  const words = title.split(" ");
  const lastWord = words.pop();
  const rest = words.join(" ");

  return (
    <Link href={`/trips/${id}/itinerary`} className="trip-card-od" style={{ textDecoration: "none" }}>
      {/* Cover */}
      <div
        className="tc-cover"
        style={{
          backgroundImage: coverImageUrl
            ? `${COVER_ACCENT}, url(${coverImageUrl})`
            : `${COVER_ACCENT}, ${gradient}`,
          backgroundSize: coverImageUrl ? "cover" : undefined,
          backgroundPosition: coverImageUrl ? "center" : undefined,
        }}
      >
        <div className="tc-cover-bottom">
          <div className="tc-dest">{destination}</div>
          <div className="tc-days">{days} day{days !== 1 ? "s" : ""}</div>
        </div>
      </div>

      {/* Body */}
      <div className="tc-body">
        <h3 className="tc-title">
          {rest ? <>{rest} <em>{lastWord}</em></> : title}
        </h3>
        <div className="tc-dates">
          {formatShortDate(startDate)} → {formatShortDate(endDate)}
        </div>
        <div className="tc-foot">
          <div className="od-avatar-stack">
            {members.slice(0, 4).map((m, i) => (
              <span
                key={i}
                className="od-avatar sm"
                title={m.name}
                style={{ background: ["var(--peri)", "var(--coral)", "var(--teal)", "var(--gold)"][i % 4] }}
              >
                {(m.name ?? "?").slice(0, 2).toUpperCase()}
              </span>
            ))}
          </div>
          <span className="tc-travelers">{members.length} traveler{members.length !== 1 ? "s" : ""}</span>
        </div>
      </div>
    </Link>
  );
}
