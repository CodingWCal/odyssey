# Clerk: collect name on email sign-up (ODY-044)

Email/password sign-ups currently skip name fields unless the Clerk **instance**
asks for them. Without that, Odyssey falls back to **"Traveler"** everywhere.

## Required dashboard step (human)

In the [Clerk Dashboard](https://dashboard.clerk.com) for the instance this app
uses (dev and eventually production — see ODY-036):

1. Open **User & Authentication** → **Email, Phone, Username** (wording may be
   **User & authentication** → **Attributes** depending on Clerk UI version).
2. Find **Name** (First name / Last name).
3. Set First name (and optionally Last name) to **Required** on sign-up — not
   optional, not off.
4. Save. Confirm on the hosted sign-up page that name fields appear before
   email/password.

Once enabled, the prebuilt `<SignUp />` in
`src/app/(auth)/sign-up/[[...sign-up]]/page.tsx` shows those fields
automatically — no component prop can force this; it is instance config only.

## Code-side fallback (this PR)

Until the dashboard toggle is on (and for any existing "Traveler" accounts with
no Clerk name), `/onboarding/name` asks **"What should we call you?"**, updates
Clerk + our `User` row, then continues to the dashboard.
