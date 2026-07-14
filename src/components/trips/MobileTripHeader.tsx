import Link from "next/link";
import { Icons } from "@/components/shared/Icons";

interface MobileTripHeaderProps {
  title: string;
}

/** Mobile-only sticky bar with a way back to the trip list (the sidebar's "All trips" link is hidden below 768px). */
export function MobileTripHeader({ title }: MobileTripHeaderProps) {
  return (
    <div className="mobile-trip-header">
      <Link href="/dashboard" className="back" aria-label="Back to all trips">
        <Icons.arrowLeft size={18} />
      </Link>
      <span className="title">{title}</span>
    </div>
  );
}
