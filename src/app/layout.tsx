import type { Metadata } from "next";
import { Instrument_Serif, Manrope, JetBrains_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "@/components/shared/Toast";
import "./globals.css";

const instrumentSerif = Instrument_Serif({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

const manrope = Manrope({
  variable: "--font-body",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

const SITE_DESCRIPTION =
  "A calm, joy-inducing workspace for trips — solo escapes, group adventures, weekends that turn into something more. One place to hold all of it.";

// metadataBase makes relative OG/Twitter image paths resolve to absolute URLs
// (ODY-026). Prefers an explicit site URL, falls back to Vercel's production
// domain at build time, then localhost for dev.
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Odyssey — the plan is part of the adventure",
    // Per-route titles render as "Tokyo — Odyssey" via this template.
    template: "%s — Odyssey",
  },
  description: SITE_DESCRIPTION,
  applicationName: "Odyssey",
  keywords: ["trip planner", "travel itinerary", "group travel", "trip budget", "travel planning"],
  openGraph: {
    type: "website",
    siteName: "Odyssey",
    title: "Odyssey — the plan is part of the adventure",
    description: SITE_DESCRIPTION,
    images: [{ url: "/landing.png", width: 1280, height: 800, alt: "Odyssey — a trip planner" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Odyssey — the plan is part of the adventure",
    description: SITE_DESCRIPTION,
    images: ["/landing.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html
        lang="en"
        className={`${instrumentSerif.variable} ${manrope.variable} ${jetbrainsMono.variable} h-full antialiased`}
      >
        <body className="min-h-full">
          {children}
          <Toaster />
        </body>
      </html>
    </ClerkProvider>
  );
}
