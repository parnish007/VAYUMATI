import type { Metadata, Viewport } from "next";
import { Fraunces, Instrument_Sans, DM_Serif_Display, Cormorant_Garamond, IBM_Plex_Mono } from "next/font/google";
import { DemoProvider } from "@/lib/demoContext";
import { AuthProvider } from "@/lib/authContext";
import "./globals.css";
import "leaflet/dist/leaflet.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
});

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
  display: "swap",
});

// Soil Bond typography — scoped to carbon UI surfaces only (Rewards/Bari teaser/Dashboard strap).
// Three faces, deliberately different from the rest of the app:
//  · DM Serif Display     → certificate big numbers + names
//  · Cormorant Garamond   → italic body text on the bond
//  · IBM Plex Mono        → registry codes + receipt stamps
const bondDisplay = DM_Serif_Display({
  variable: "--font-bond-display",
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  display: "swap",
});
const bondText = Cormorant_Garamond({
  variable: "--font-bond-text",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});
const bondMono = IBM_Plex_Mono({
  variable: "--font-bond-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "VayuMitti — Ward Environmental Intelligence",
  description: "Real-time air and soil advisory for Kathmandu Valley wards",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="ne"
      className={`${fraunces.variable} ${instrumentSans.variable} ${bondDisplay.variable} ${bondText.variable} ${bondMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-ink text-parchment">
        <DemoProvider>
          <AuthProvider>{children}</AuthProvider>
        </DemoProvider>
      </body>
    </html>
  );
}
