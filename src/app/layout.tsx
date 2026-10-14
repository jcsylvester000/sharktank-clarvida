import type { Metadata, Viewport } from "next";
import "@fontsource/montserrat/400.css";
import "@fontsource/montserrat/500.css";
import "@fontsource/montserrat/600.css";
import "@fontsource/montserrat/700.css";
import "@fontsource/ibm-plex-mono/400.css";
import "./globals.css";
import { Providers } from "@/components/shell/providers";

export const metadata: Metadata = {
  title: { default: "Clarvida Referral Co-Pilot", template: "%s · Clarvida Referral Co-Pilot" },
  description: "Clarvida Referral Co-Pilot prototype for the internal Shark Tank. Synthetic data only.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#1d7fa3" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      {/* Browser extensions (e.g. test recorders) add attributes to body before React loads; ignore that mismatch. */}
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
