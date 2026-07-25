/**
 * Safe app origin for invite redirect URLs (ODY-053).
 * Never trust Host / x-forwarded-* outside local development — a crafted
 * invite request could otherwise point Clerk emails at an attacker site.
 */

function isLocalDevHost(host: string): boolean {
  const h = host.toLowerCase();
  return (
    h === "localhost" ||
    h.startsWith("localhost:") ||
    h === "127.0.0.1" ||
    h.startsWith("127.0.0.1:")
  );
}

export function resolveAppOrigin(opts: {
  envUrl?: string | null;
  host?: string | null;
  proto?: string | null;
}): string {
  const configured = (opts.envUrl || "").replace(/\/$/, "");
  const host = opts.host?.trim() || "";

  // Local only: derive from the real request so any port works.
  if (host && isLocalDevHost(host)) {
    const proto = opts.proto || "http";
    return `${proto}://${host}`;
  }

  if (configured) return configured;

  return "http://localhost:3000";
}
