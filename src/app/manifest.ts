import type { MetadataRoute } from "next";

/** Web app manifest (ODY mobile polish) — makes Odyssey installable to the
 * home screen with a proper name, standalone display, and paper-toned chrome
 * instead of a generic browser bookmark. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Odyssey — travel itinerary planner",
    short_name: "Odyssey",
    description:
      "A calm, collaborative workspace for trips — build day-by-day itineraries, map your route, split the budget, and plan with your crew.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#F7F1E6",
    theme_color: "#F7F1E6",
    categories: ["travel", "productivity", "lifestyle"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Maskable variant is full-bleed with the globe inside the safe zone, so
      // Android/adaptive launchers can crop it to any shape without clipping.
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/app-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
