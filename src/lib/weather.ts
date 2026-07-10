/**
 * WMO weather-code → app condition mapping (extracted from WeatherBanner for
 * testability, ODY-016). Codes per Open-Meteo's WMO interpretation table.
 */
export function getConditionFromCode(code: number): string {
  if (code === 0) return "clear";
  if (code <= 3) return "cloudy";
  if (code <= 48) return "fog";
  if (code <= 67) return "rain";
  if (code <= 77) return "snow";
  if (code <= 82) return "rain";
  if (code <= 99) return "storm";
  return "default";
}
