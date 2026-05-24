import type { Metadata, Viewport } from "next";
import { Fraunces, Instrument_Sans } from "next/font/google";
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
      className={`${fraunces.variable} ${instrumentSans.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-ink text-parchment">
        <DemoProvider>
          <AuthProvider>{children}</AuthProvider>
        </DemoProvider>
      </body>
    </html>
  );
}
