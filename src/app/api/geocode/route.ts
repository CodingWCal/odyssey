import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { searchPlaces } from "@/lib/geocode";

/**
 * Authenticated geocoding proxy (ODY-010). The browser autocomplete calls this
 * instead of Nominatim directly, so OpenStreetMap sees one well-behaved server
 * client (descriptive UA, cached, rate-limited) rather than every visitor's IP.
 */

// Soft per-user rate limit: enough for fast typing with the client's 350ms
// debounce, low enough that one user can't hammer Nominatim through us.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 30;
const usage = new Map<string, { windowStart: number; count: number }>();

function rateLimited(userId: string): boolean {
  const now = Date.now();
  const entry = usage.get(userId);
  if (!entry || now - entry.windowStart >= WINDOW_MS) {
    usage.set(userId, { windowStart: now, count: 1 });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_PER_WINDOW;
}

// Opportunistic cleanup so the map doesn't grow unbounded across users.
function pruneUsage() {
  if (usage.size < 1000) return;
  const cutoff = Date.now() - WINDOW_MS;
  for (const [key, entry] of usage) {
    if (entry.windowStart < cutoff) usage.delete(key);
  }
}

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  pruneUsage();
  if (rateLimited(userId)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const q = req.nextUrl.searchParams.get("q") ?? "";
  if (q.trim().length < 3 || q.length > 300) {
    return NextResponse.json({ error: "Query must be 3–300 characters" }, { status: 400 });
  }

  const results = await searchPlaces(q, 5);
  return NextResponse.json(results);
}
