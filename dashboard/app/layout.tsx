import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Aura — Spending Tracker",
  description:
    "Track your spending with a voice note. No apps, no spreadsheets. Just message your Telegram bot and let Aura do the rest.",
  openGraph: {
    title: "Aura — Spending Tracker",
    description:
      "Track your spending with a voice note. No apps, no spreadsheets. Just message your Telegram bot and let Aura do the rest.",
    images: ["/aura-logo.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
