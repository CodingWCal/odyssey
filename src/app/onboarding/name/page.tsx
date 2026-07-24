import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { clerkUserNeedsName } from "@/lib/auth";
import { NameForm } from "./NameForm";

export default async function OnboardingNamePage() {
  const user = await currentUser();
  if (!user) redirect("/sign-in");
  if (!clerkUserNeedsName(user)) redirect("/dashboard");

  return (
    <div className="auth-shell">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true" />
        <span className="brand-name">Odyssey</span>
      </div>
      <NameForm />
    </div>
  );
}
