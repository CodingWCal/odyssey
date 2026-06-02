import { LandingPage } from "@/components/landing/LandingPage";

// The landing page, always reachable — even while signed in (unlike "/", which
// redirects authenticated users to the dashboard).
export default function WelcomePage() {
  return <LandingPage />;
}
