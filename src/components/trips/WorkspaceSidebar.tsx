"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import type { Trip } from "@/types";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "itinerary", label: "Itinerary", icon: "🗓" },
  { href: "map", label: "Map", icon: "🗺" },
  { href: "budget", label: "Budget", icon: "💰" },
  { href: "notes", label: "Notes", icon: "📝" },
  { href: "members", label: "Members", icon: "👥" },
];

interface WorkspaceSidebarProps {
  trip: Pick<Trip, "id" | "title" | "destination">;
}

export function WorkspaceSidebar({ trip }: WorkspaceSidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-60 bg-odyssey-ink text-white shrink-0 h-full">
        <div className="p-5 border-b border-white/10">
          <Link href="/dashboard" className="text-xs text-white/50 hover:text-white/80 transition-colors mb-3 block">
            ← All trips
          </Link>
          <h2 className="font-heading text-lg leading-tight text-white">{trip.title}</h2>
          <p className="text-xs text-white/50 mt-0.5">{trip.destination}</p>
        </div>

        <nav className="flex-1 p-3" aria-label="Trip navigation">
          {NAV_ITEMS.map((item) => {
            const href = `/trips/${trip.id}/${item.href}`;
            const active = pathname === href;
            return (
              <Link
                key={item.href}
                href={href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors mb-1",
                  active
                    ? "bg-odyssey-teal text-white"
                    : "text-white/70 hover:text-white hover:bg-white/10"
                )}
                aria-current={active ? "page" : undefined}
              >
                <span aria-hidden="true">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10">
          <UserButton />
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-odyssey-slate flex border-t border-white/10"
        aria-label="Trip navigation"
      >
        {NAV_ITEMS.map((item) => {
          const href = `/trips/${trip.id}/${item.href}`;
          const active = pathname === href;
          return (
            <Link
              key={item.href}
              href={href}
              className={cn(
                "flex-1 flex flex-col items-center py-2 text-xs transition-colors",
                active ? "text-odyssey-teal" : "text-white/60"
              )}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
            >
              <span className="text-lg" aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
