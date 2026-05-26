import type { EventType } from "@/types";

interface TypeBadgeProps {
  type: EventType;
  className?: string;
}

export function TypeBadge({ type }: TypeBadgeProps) {
  return (
    <span className={`od-badge t-${type}`}>
      {type}
    </span>
  );
}
