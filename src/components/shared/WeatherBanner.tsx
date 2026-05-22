interface WeatherData {
  temperature: number;
  condition: string;
  forecast: { date: string; high: number; low: number; condition: string }[];
}

const CONDITION_ICONS: Record<string, string> = {
  clear: "☀️",
  cloudy: "☁️",
  rain: "🌧️",
  snow: "❄️",
  storm: "⛈️",
  fog: "🌫️",
  wind: "💨",
  default: "🌤️",
};

function getConditionFromCode(code: number): string {
  if (code === 0) return "clear";
  if (code <= 3) return "cloudy";
  if (code <= 48) return "fog";
  if (code <= 67) return "rain";
  if (code <= 77) return "snow";
  if (code <= 82) return "rain";
  if (code <= 99) return "storm";
  return "default";
}

function getIcon(condition: string) {
  return CONDITION_ICONS[condition] ?? CONDITION_ICONS.default;
}

interface WeatherBannerProps {
  weather: WeatherData | null;
  destination: string;
}

export function WeatherBanner({ weather, destination }: WeatherBannerProps) {
  if (!weather) return null;

  return (
    <div className="bg-gradient-to-r from-odyssey-slate/10 to-odyssey-teal/10 border border-odyssey-slate/20 rounded-xl px-4 py-3 mb-4 flex items-center gap-6 flex-wrap">
      <div className="flex items-center gap-2">
        <span className="text-2xl" aria-hidden="true">{getIcon(weather.condition)}</span>
        <div>
          <p className="text-sm font-semibold text-odyssey-ink">{destination}</p>
          <p className="text-xs text-odyssey-slate">{Math.round(weather.temperature)}°F · {weather.condition}</p>
        </div>
      </div>
      <div className="flex gap-3">
        {weather.forecast.map((f) => (
          <div key={f.date} className="text-center">
            <p className="text-xs text-odyssey-slate">{f.date}</p>
            <p className="text-sm" aria-hidden="true">{getIcon(f.condition)}</p>
            <p className="text-xs font-mono text-odyssey-ink">{Math.round(f.high)}°/{Math.round(f.low)}°</p>
          </div>
        ))}
      </div>
    </div>
  );
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
