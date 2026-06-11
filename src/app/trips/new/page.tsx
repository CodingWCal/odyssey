import { redirect } from "next/navigation";

// Trip creation now happens in the New-trip wizard modal on the dashboard.
// This legacy route just bounces there.
export default function NewTripPage() {
  redirect("/dashboard");
}
