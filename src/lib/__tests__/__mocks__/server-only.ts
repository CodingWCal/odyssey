// Test-only stub for the "server-only" package (which throws when imported
// outside a Next.js server context). Aliased in vitest.config.ts so modules
// like src/lib/geocode.ts can be unit-tested with a mocked fetch (ODY-106).
export {};
