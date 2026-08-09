/**
 * The single money formatter for the whole app (ODY-024). Before this, three
 * components each defined their own `fmtMoney = "$" + Math.round(n)`, which
 * hid cents everywhere — a $30.50 settle-up rendered as "$31". This is the one
 * cents-honest, trip-currency-aware formatter; nothing else formats money.
 *
 * Cents show only when the amount actually has them, so clean whole figures
 * ($1,240) stay clean while $12.50 keeps its cents. Zero-decimal currencies
 * (JPY, KRW) fall through to their natural precision via Intl.
 *
 * Stage 1 (ODY-111 gap #1): `currency` is the trip's single base currency —
 * it controls symbol and formatting only. Per-expense foreign currency and
 * stored FX rates are explicitly deferred.
 */
export function formatMoney(amount: number | null | undefined, currency = "USD"): string {
  const n = Number(amount) || 0;
  // Whole in major units → no fraction digits; otherwise show up to 2. For a
  // 2-decimal currency this yields "$13" vs "$12.50"; for JPY it yields "¥13".
  const isWhole = Number.isInteger(n);
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: isWhole ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    // Defensive: an unrecognized currency code shouldn't blank out the UI.
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: isWhole ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(n);
  }
}

/** Currencies a trip can pick (ODY-024). Kept short and travel-relevant rather
 * than the full ISO list — a picker of 12 common ones covers the vast majority
 * of trips without becoming a scroll of 160 codes. */
export const TRIP_CURRENCIES = [
  { code: "USD", label: "US Dollar ($)" },
  { code: "EUR", label: "Euro (€)" },
  { code: "GBP", label: "British Pound (£)" },
  { code: "JPY", label: "Japanese Yen (¥)" },
  { code: "CAD", label: "Canadian Dollar (C$)" },
  { code: "AUD", label: "Australian Dollar (A$)" },
  { code: "CHF", label: "Swiss Franc (CHF)" },
  { code: "CNY", label: "Chinese Yuan (¥)" },
  { code: "MXN", label: "Mexican Peso (MX$)" },
  { code: "INR", label: "Indian Rupee (₹)" },
  { code: "BRL", label: "Brazilian Real (R$)" },
  { code: "KRW", label: "South Korean Won (₩)" },
] as const;

export const TRIP_CURRENCY_CODES = TRIP_CURRENCIES.map((c) => c.code);
