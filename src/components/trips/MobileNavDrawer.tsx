"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icons } from "@/components/shared/Icons";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { MORE_NAV_ITEMS } from "./navItems";

interface MobileNavDrawerProps {
  tripId: string;
}

/** Hamburger drawer for the trip sections that don't fit the mobile bottom tab bar (ODY-059). */
export function MobileNavDrawer({ tripId }: MobileNavDrawerProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <>
      <button
        type="button"
        className="menu-trigger"
        aria-label="More trip sections"
        onClick={() => setOpen(true)}
      >
        <Icons.menu size={18} />
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="nav-drawer" aria-label="More trip sections">
          <span className="nav-drawer-label">More</span>
          <nav className="nav" aria-label="More trip sections">
            {MORE_NAV_ITEMS.map(({ href, label, Icon }) => {
              const full = `/trips/${tripId}/${href}`;
              const active = pathname === full || pathname.startsWith(full + "/");
              return (
                <Link
                  key={href}
                  href={full}
                  className={active ? "active" : ""}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setOpen(false)}
                >
                  <span className="icon"><Icon size={15} /></span>
                  {label}
                </Link>
              );
            })}
          </nav>
        </SheetContent>
      </Sheet>
    </>
  );
}
