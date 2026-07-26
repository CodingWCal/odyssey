import { SignIn } from "@clerk/nextjs";

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Sign-in. Honors the same allowlisted `?after=` redirect as sign-up (ODY-062)
 * so invite deep-links work whether the traveler signs in or signs up.
 */
export default async function SignInPage({ searchParams }: Props) {
  const sp = await searchParams;
  const afterRaw = typeof sp.after === "string" ? sp.after : undefined;
  // Only honor internal paths so the `after` param can't be used as an open redirect.
  const dest = afterRaw && afterRaw.startsWith("/") && !afterRaw.startsWith("//") ? afterRaw : undefined;

  return (
    <div className="auth-shell">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true" />
        <span className="brand-name">Odyssey</span>
      </div>
      <SignIn forceRedirectUrl={dest} signUpForceRedirectUrl={dest} />
    </div>
  );
}
