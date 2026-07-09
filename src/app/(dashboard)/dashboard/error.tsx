"use client";

import { useEffect } from "react";

/** Branded route error boundary for the dashboard (ODY-013). */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="route-error" role="alert">
      <h2>
        We lost the <em>itinerary for a moment</em>
      </h2>
      <p>Your trips are still here — something just hiccuped on the way. Try again.</p>
      <button onClick={reset}>Try again</button>
    </div>
  );
}
