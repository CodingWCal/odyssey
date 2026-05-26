const COLORS = ["var(--peri)", "var(--coral)", "var(--teal)", "var(--gold)", "var(--peach)"];

interface AvatarGroupProps {
  users: { name: string; avatarUrl: string | null }[];
  max?: number;
}

export function AvatarGroup({ users, max = 4 }: AvatarGroupProps) {
  const visible = users.slice(0, max);
  const overflow = users.length - max;

  return (
    <div className="od-avatar-stack" aria-label={`${users.length} collaborators`}>
      {visible.map((user, i) => (
        <span
          key={i}
          className="od-avatar sm"
          title={user.name}
          style={{ background: COLORS[i % COLORS.length] }}
        >
          {(user.name ?? "?").slice(0, 2).toUpperCase()}
        </span>
      ))}
      {overflow > 0 && (
        <span
          className="od-avatar sm"
          style={{ background: "var(--ink-3)" }}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}
