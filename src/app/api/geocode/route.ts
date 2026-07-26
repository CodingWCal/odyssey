import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { GeocodeRateLimitError, searchPlaces } from "@/lib/geocode";

/**
 * Authenticated geocoding proxy (ODY-010 / ODY-055). The browser autocomplete
 * calls this instead of Nominatim directly. Rate limiting lives in
 * `src/lib/geocode.ts` so Explore / event saves share the same quota.
 */

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = req.nextUrl.searchParams.get("q") ?? "";
  if (q.trim().length < 3 || q.length > 300) {
    return NextResponse.json({ error: "Query must be 3–300 characters" }, { status: 400 });
  }

  // Optional trip-destination bias (ODY-091); ignored if too long.
  const nearRaw = req.nextUrl.searchParams.get("near") ?? "";
  const near = nearRaw.trim().length > 0 && nearRaw.length <= 200 ? nearRaw : undefined;

  try {
    const results = await searchPlaces(q, 5, { userKey: userId, near });
    return NextResponse.json(results);
  } catch (err) {
    if (err instanceof GeocodeRateLimitError) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
    throw err;
  }
}
