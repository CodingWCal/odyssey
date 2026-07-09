"use client";

import { useEffect } from "react";

/** Branded route error boundary for the trip workspace (ODY-013). */
export default function TripError({
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
        The map slipped <em>out of our hands</em>
      </h2>
      <p>Something went wrong loading this part of the trip. Your plans are safe — try again.</p>
      <button onClick={reset}>Try again</button>
    </div>
  );
}
