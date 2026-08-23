"use client";

import { useEffect } from "react";
import "./globals.css";

/** Last-resort boundary for errors thrown in the root layout itself. Renders
 * its own <html>/<body> (it replaces the whole tree) with a branded fallback.
 * The design-token styles still apply via globals.css; custom fonts fall back
 * gracefully since this bypasses the font-variable setup in RootLayout. */
export default function GlobalError({
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
    <html lang="en">
      <body>
        <div className="route-error" role="alert">
          <h2>
            Something <em>knocked us off course</em>
          </h2>
          <p>An unexpected error interrupted the app. Your trips are safe — try again.</p>
          <button onClick={reset}>Try again</button>
        </div>
      </body>
    </html>
  );
}
