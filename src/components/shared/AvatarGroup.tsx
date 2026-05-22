import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface AvatarGroupProps {
  users: { name: string; avatarUrl: string | null }[];
  max?: number;
}

export function AvatarGroup({ users, max = 4 }: AvatarGroupProps) {
  const visible = users.slice(0, max);
  const overflow = users.length - max;

  return (
    <div className="flex -space-x-2" aria-label={`${users.length} collaborators`}>
      {visible.map((user, i) => (
        <Avatar key={i} className="h-7 w-7 border-2 border-white">
          <AvatarImage src={user.avatarUrl ?? undefined} alt={user.name} />
          <AvatarFallback className="text-xs bg-odyssey-periwinkle text-white">
            {user.name.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      ))}
      {overflow > 0 && (
        <div className="h-7 w-7 rounded-full bg-odyssey-slate border-2 border-white flex items-center justify-center text-xs text-white font-medium">
          +{overflow}
        </div>
      )}
    </div>
  );
}
