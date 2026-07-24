"use client";

import { useActionState } from "react";
import { saveDisplayName } from "@/app/onboarding/actions";

type NameState = { error?: string } | null;

async function submitName(_prev: NameState, formData: FormData): Promise<NameState> {
  const first = String(formData.get("firstName") ?? "").trim();
  if (!first) return { error: "Tell us what to call you." };
  try {
    await saveDisplayName(formData);
    return null;
  } catch (err: unknown) {
    const digest =
      typeof err === "object" && err && "digest" in err
        ? String((err as { digest: unknown }).digest)
        : "";
    if (digest.startsWith("NEXT_REDIRECT")) throw err;
    return { error: "Couldn't save your name — try again." };
  }
}

export function NameForm() {
  const [state, action, pending] = useActionState(submitName, null);

  return (
    <form className="onboard-card" action={action}>
      <h1 className="onboard-title">What should we call you?</h1>
      <p className="onboard-sub">
        This shows up on your trips, for your fellow travelers.
      </p>

      <div className="field">
        <label htmlFor="first-name">First name</label>
        <input
          id="first-name"
          name="firstName"
          className="input"
          placeholder="Maya"
          autoFocus
          autoComplete="given-name"
          required
        />
      </div>

      <div className="field">
        <label htmlFor="last-name">Last name <span className="field-optional">(optional)</span></label>
        <input
          id="last-name"
          name="lastName"
          className="input"
          placeholder="Rivera"
          autoComplete="family-name"
        />
      </div>

      {state?.error && <p className="form-error">{state.error}</p>}

      <button className="btn btn-primary onboard-submit" type="submit" disabled={pending}>
        {pending ? "Saving…" : "Continue"}
      </button>
    </form>
  );
}
