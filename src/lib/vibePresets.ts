/**
 * Vibe → OpenStreetMap category mapping for Explore (ODY-049). Pure and
 * framework-free so it unit-tests without the server-only Overpass module.
 *
 * A traveler's vibe ("cozy cafés", "sunset views", or free text) is matched to
 * a preset naming the OSM tag filters Overpass should search and the event
 * category/label a saved place inherits. Nominatim (a geocoder) can't do this —
 * it resolves names, not categories — which is why the old MVP returned nothing;
 * Overpass is OSM's actual point-of-interest query engine.
 */
import type { EventType } from "@/types";

export interface VibePreset {
  /** Lowercase keywords; the first preset with any substring match wins. */
  keywords: string[];
  /** Overpass tag filters, e.g. `["amenity"="cafe"]`. Unioned in the query. */
  filters: string[];
  /** Event type a saved suggestion inherits (drives colour + map pin). */
  category: EventType;
  /** Human label used in the suggestion blurb. */
  label: string;
}

const PRESETS: VibePreset[] = [
  {
    keywords: ["café", "cafe", "coffee", "espresso", "tea"],
    filters: ['["amenity"="cafe"]'],
    category: "restaurant",
    label: "café",
  },
  {
    keywords: ["eat", "food", "restaurant", "dining", "dinner", "lunch", "ramen", "sushi", "noodle", "bistro", "brunch"],
    filters: ['["amenity"="restaurant"]'],
    category: "restaurant",
    label: "place to eat",
  },
  {
    keywords: ["sunset", "view", "scenic", "lookout", "viewpoint", "panorama", "skyline"],
    filters: ['["tourism"="viewpoint"]'],
    category: "activity",
    label: "viewpoint",
  },
  {
    keywords: ["museum", "gallery", "art", "exhibit", "history"],
    filters: ['["tourism"="museum"]', '["tourism"="gallery"]'],
    category: "activity",
    label: "museum or gallery",
  },
  {
    keywords: ["park", "walk", "garden", "nature", "outdoor", "green", "stroll"],
    filters: ['["leisure"="park"]', '["leisure"="garden"]'],
    category: "activity",
    label: "park or garden",
  },
  {
    keywords: ["nightlife", "bar", "pub", "drink", "club", "cocktail", "night"],
    filters: ['["amenity"~"^(bar|pub|nightclub)$"]'],
    category: "activity",
    label: "nightlife spot",
  },
  {
    keywords: ["shop", "market", "boutique", "mall", "store"],
    filters: ['["shop"~"^(mall|department_store|gift|boutique|books)$"]', '["amenity"="marketplace"]'],
    category: "activity",
    label: "place to shop",
  },
];

/** General attractions — the fallback when a vibe matches no specific preset. */
export const DEFAULT_PRESET: VibePreset = {
  keywords: [],
  filters: ['["tourism"="attraction"]'],
  category: "activity",
  label: "local highlight",
};

/** Match a vibe string to its preset; falls back to general attractions. */
export function resolveVibe(vibe: string): VibePreset {
  const v = vibe.toLowerCase();
  return PRESETS.find((p) => p.keywords.some((k) => v.includes(k))) ?? DEFAULT_PRESET;
}

/**
 * Build an Overpass QL query for the preset's filters within `radius` metres of
 * a point. Requires a `name` tag (so results are real, labelled places) and
 * asks for node/way/relation centres, capped at `limit` for a bounded response.
 */
export function buildOverpassQuery(
  filters: string[],
  lat: number,
  lng: number,
  radius: number,
  limit: number
): string {
  const body = filters
    .map((f) =>
      ["node", "way", "relation"]
        .map((el) => `  ${el}${f}["name"](around:${radius},${lat},${lng});`)
        .join("\n")
    )
    .join("\n");
  return `[out:json][timeout:25];\n(\n${body}\n);\nout center ${limit};`;
}
