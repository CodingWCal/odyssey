import { getConditionFromCode } from "@/lib/weather";

// The old <WeatherBanner> component (last consumer of the legacy odyssey-*
// Tailwind aliases) was dead code — nothing imported it. Weather rendering
// lives in ItineraryHero; this module only fetches (ODY-012).
interface WeatherData {
  temperature: number;
  condition: string;
  forecast: { date: string; high: number; low: number; condition: string }[];
}

export async function fetchWeather(destination: string, startDate: Date): Promise<WeatherData | null> {
  try {
    const geoRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(destination)}&count=1&language=en&format=json`,
      { next: { revalidate: 3600 } }
    );
    const geo = await geoRes.json();
    if (!geo.results?.[0]) return null;

    const { latitude, longitude } = geo.results[0];
    const startStr = startDate.toISOString().split("T")[0];
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 2);
    const endStr = endDate.toISOString().split("T")[0];

    const weatherRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=temperature_2m_max,temperature_2m_min,weathercode&temperature_unit=fahrenheit&timezone=auto&start_date=${startStr}&end_date=${endStr}`,
      { next: { revalidate: 3600 } }
    );
    const weather = await weatherRes.json();
    if (!weather.daily) return null;

    const { daily } = weather;
    const forecast = daily.time.map((date: string, i: number) => ({
      date: new Date(date).toLocaleDateString("en-US", { weekday: "short" }),
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
