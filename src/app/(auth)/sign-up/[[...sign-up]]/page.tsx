import { SignUp } from "@clerk/nextjs";

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function SignUpPage({ searchParams }: Props) {
  const sp = await searchParams;
  const afterRaw = typeof sp.after === "string" ? sp.after : undefined;
  // Only honor internal paths so the `after` param can't be used as an open redirect.
  const dest = afterRaw && afterRaw.startsWith("/") && !afterRaw.startsWith("//") ? afterRaw : undefined;

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      background: "var(--paper)",
      padding: "24px 16px",
    }}>
      <div className="brand" style={{ marginBottom: 28 }}>
        <span className="brand-mark" aria-hidden="true" />
        <span className="brand-name">Odyssey</span>
      </div>
      <SignUp forceRedirectUrl={dest} signInForceRedirectUrl={dest} />
    </div>
  );
}
