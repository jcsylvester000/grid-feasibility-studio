import type { Metadata, Viewport } from "next";
import { cantata, poppins } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_ORIGIN ?? "http://localhost:3000"),
  title: { default: "GRID Feasibility Studio", template: "%s · GRID Feasibility Studio" },
  description:
    "Sourced property feasibility reports for the Philippine market: Quick Report, Executive Summary, Feasibility Report and Teaser Scan.",
  robots: process.env.ALLOW_INDEXING === "true" ? undefined : { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#0e192f", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-PH" className={`${cantata.variable} ${poppins.variable}`}>
      {/* Browser extensions (e.g. test recorders, password managers) add attributes to <body>; ignore them. */}
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
