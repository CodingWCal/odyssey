import { Icons, type EventTypeKey } from "./Icons";

// Event type pill — `.badge.t-{type}` per the design's badge styles.
export function TypeBadge({ type }: { type: EventTypeKey }) {
  const Icon = Icons[type] ?? Icons.misc;
  return (
    <span className={`badge t-${type}`}>
      <Icon size={11} />
      {type}
    </span>
  );
}
