"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "./navItems";

interface MobileTabBarProps {
  tripId: string;
}

export function MobileTabBar({ tripId }: MobileTabBarProps) {
  const pathname = usePathname();

  return (
    <nav className="mobile-tab-bar" aria-label="Trip navigation">
      {NAV_ITEMS.map(({ href, label, Icon }) => {
        const full = `/trips/${tripId}/${href}`;
        const active = pathname === full || pathname.startsWith(full + "/");
        return (
          <Link
            key={href}
            href={full}
            className={active ? "active" : ""}
            aria-current={active ? "page" : undefined}
          >
            <Icon size={19} />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
