import Link from "next/link";

/** Branded 404 — replaces Next's bare default for bad URLs and notFound()
 * calls, matching the tone of the route error boundary. */
export default function NotFound() {
  return (
    <div className="route-error">
      <h2>
        This page <em>wandered off the map</em>
      </h2>
      <p>The link may be broken, or the trip has moved on. Let&apos;s get you back on route.</p>
      <Link href="/dashboard" className="btn btn-primary">
        Back to your trips
      </Link>
    </div>
  );
}
