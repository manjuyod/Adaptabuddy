import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const font = Space_Grotesk({
  subsets: ["latin"],
  display: "swap"
});

export const metadata: Metadata = {
  title: "Adaptabuddy",
  description: "Adaptive training companion with offline-first Supabase stack.",
  manifest: "/manifest.webmanifest",
  themeColor: "#0f172a",
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-192.png"
  }
};

export default function RootLayout({
  children
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en" className={font.className}>
      <body className="min-h-screen bg-slate-950">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
