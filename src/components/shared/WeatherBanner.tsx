import { getConditionFromCode } from "@/lib/weather";

// The old <WeatherBanner> component (last consumer of the legacy odyssey-*
// Tailwind aliases) was dead code — nothing imported it. Weather rendering
// lives in ItineraryHero; this module only fetches (ODY-012).
interface WeatherData {
  temperature: number;
  condition: string;
  forecast: { date: string; high: number; low: number; condition: string }[];
}

/** Weather is either a real reading, an explicit "outside the forecast
 * horizon" marker (so the UI shows a placeholder instead of vanishing —
 * ODY-023), or null on a transient fetch/geocode failure. */
export type WeatherResult = WeatherData | { unavailable: true } | null;

// Open-Meteo's free forecast covers roughly today .. today+15 days.
const FORECAST_HORIZON_DAYS = 15;

function utcMidnight(d: Date): Date {
  const out = new Date(d);
  out.setUTCHours(0, 0, 0, 0);
  return out;
}

/**
 * Pure horizon math for the weather banner (ODY-023) — decides whether a
 * trip is within Open-Meteo's forecast window and, if so, the clamped
 * [start, end] the request should ask for. Kept separate from the fetch so
 * the past / current / near-future / far-future cases are unit-testable
 * without the network. `now` is injectable for tests.
 */
export function planWeatherWindow(
  startDate: Date,
  endDate: Date,
  now: Date = new Date()
): { unavailable: true } | { startStr: string; endStr: string } {
  const today = utcMidnight(now);
  const horizonEnd = utcMidnight(now);
  horizonEnd.setUTCDate(horizonEnd.getUTCDate() + FORECAST_HORIZON_DAYS);

  const tripStart = utcMidnight(startDate);
  const tripEnd = utcMidnight(endDate);

  // Entirely outside the forecast window — a past trip, or one that starts
  // beyond the horizon. Signal a placeholder rather than silently vanishing.
  if (tripEnd < today || tripStart > horizonEnd) {
    return { unavailable: true };
  }

  // Request from max(tripStart, today) — so an in-progress trip shows *today's*
  // weather, not the start date's — spanning 3 days, clamped to the horizon.
  const reqStart = tripStart < today ? today : tripStart;
  const reqEnd = new Date(reqStart);
  reqEnd.setUTCDate(reqEnd.getUTCDate() + 2);
  if (reqEnd > horizonEnd) reqEnd.setTime(horizonEnd.getTime());

  return { startStr: reqStart.toISOString().split("T")[0], endStr: reqEnd.toISOString().split("T")[0] };
}

export async function fetchWeather(
  destination: string,
  startDate: Date,
  endDate: Date
): Promise<WeatherResult> {
  const window = planWeatherWindow(startDate, endDate);
  if ("unavailable" in window) return { unavailable: true };
  const { startStr, endStr } = window;

  try {
    const geoRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(destination)}&count=1&language=en&format=json`,
      { next: { revalidate: 3600 } }
    );
    const geo = await geoRes.json();
    if (!geo.results?.[0]) return null;

    const { latitude, longitude } = geo.results[0];

    const weatherRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=temperature_2m_max,temperature_2m_min,weathercode&temperature_unit=fahrenheit&timezone=auto&start_date=${startStr}&end_date=${endStr}`,
      { next: { revalidate: 3600 } }
    );
    const weather = await weatherRes.json();
    if (!weather.daily) return null;

    const { daily } = weather;
    const forecast = daily.time.map((date: string, i: number) => ({
      // `date` is a "YYYY-MM-DD" destination-local calendar day from the
      // forecast API — format in UTC so it doesn't drift a day in US
      // timezones when parsed as UTC midnight (ODY-098 pattern).
      date: new Date(date).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }),
      high: daily.temperature_2m_max[i],
      low: daily.temperature_2m_min[i],
      condition: getConditionFromCode(daily.weathercode[i]),
    }));

    return {
      temperature: daily.temperature_2m_max[0],
      condition: getConditionFromCode(daily.weathercode[0]),
      forecast: forecast.slice(0, 3),
    };
  } catch {
    return null;
  }
}
