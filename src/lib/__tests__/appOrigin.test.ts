import { describe, it, expect } from "vitest";
import { resolveAppOrigin } from "@/lib/appOrigin";

describe("resolveAppOrigin (ODY-053)", () => {
  it("uses NEXT_PUBLIC_APP_URL when Host is a public domain", () => {
    expect(
      resolveAppOrigin({
        envUrl: "https://odyssey.app/",
        host: "evil.example",
        proto: "https",
      })
    ).toBe("https://odyssey.app");
  });

  it("ignores spoofed Host even when env is unset (falls back to localhost)", () => {
    expect(
      resolveAppOrigin({
        envUrl: null,
        host: "attacker.test",
        proto: "https",
      })
    ).toBe("http://localhost:3000");
  });

  it("allows localhost request host in local dev", () => {
    expect(
      resolveAppOrigin({
        envUrl: "http://localhost:3000",
        host: "localhost:3001",
        proto: "http",
      })
    ).toBe("http://localhost:3001");
  });

  it("allows 127.0.0.1 request host in local dev", () => {
    expect(
      resolveAppOrigin({
        envUrl: "",
        host: "127.0.0.1:3000",
        proto: "http",
      })
    ).toBe("http://127.0.0.1:3000");
  });
});
