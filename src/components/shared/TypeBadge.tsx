import { EVENT_TYPE_BG, type EventType } from "@/types";
import { cn } from "@/lib/utils";

interface TypeBadgeProps {
  type: EventType;
  className?: string;
}

const TYPE_ICONS: Record<EventType, string> = {
  flight: "✈",
  hotel: "🏨",
  restaurant: "🍽",
  activity: "🎯",
  transport: "🚗",
  misc: "📌",
};

export function TypeBadge({ type, className }: TypeBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium capitalize",
        EVENT_TYPE_BG[type],
        className
      )}
    >
      <span aria-hidden="true">{TYPE_ICONS[type]}</span>
      {type}
    </span>
  );
}
