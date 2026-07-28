import Link from "next/link";
import { Icons } from "@/components/shared/Icons";
import { MobileNavDrawer } from "./MobileNavDrawer";

interface MobileTripHeaderProps {
  title: string;
  tripId: string;
}

/** Mobile-only sticky bar with a way back to the trip list (the sidebar's "All trips" link is hidden below 768px) and the overflow-tabs drawer trigger (ODY-059). */
export function MobileTripHeader({ title, tripId }: MobileTripHeaderProps) {
  return (
    <div className="mobile-trip-header">
      <Link href="/dashboard" className="back" aria-label="Back to all trips">
        <Icons.arrowLeft size={18} />
      </Link>
      <span className="title">{title}</span>
      <MobileNavDrawer tripId={tripId} />
    </div>
  );
}
