// Avatar + overlapping AvatarStack, matching the design's `.avatar`/`.avatar-stack`.

const COLOR_CLASSES = ["bg-coral", "bg-teal", "bg-gold", "bg-slate", "bg-peri"] as const;

/** Deterministic color class from a name/id, so a person keeps the same color. */
export function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return COLOR_CLASSES[h % COLOR_CLASSES.length];
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({
  initials,
  color = "",
  size = "",
  title,
}: {
  initials: string;
  color?: string;
  size?: "" | "sm" | "lg";
  title?: string;
}) {
  return (
    <span className={`avatar ${size} ${color}`.trim()} title={title}>
      {initials}
    </span>
  );
}

export interface StackMember {
  id: string;
  name: string;
}

export function AvatarStack({ members, max = 4 }: { members: StackMember[]; max?: number }) {
  return (
    <span className="avatar-stack">
      {members.slice(0, max).map((m) => (
        <Avatar key={m.id} initials={initialsOf(m.name)} color={avatarColor(m.id)} size="sm" title={m.name} />
      ))}
    </span>
  );
}
