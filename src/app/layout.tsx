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
  title: "Evidence Agent · Open Agent Hackathon 2026",
  description:
    "Track 02 Autonomous Agent — multi-step investigation with tools, citations, and concrete outcomes.",
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
        <footer className="border-t border-white/5 py-6 text-center text-xs text-slate-600">
          Evidence Agent · MIT · Open Agent Hackathon 2026 Track 02 ·{" "}
          <a
            className="text-slate-500 hover:text-slate-300"
            href="https://github.com/bryko254/open-agent-hackathon-2026"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
        </footer>
      </body>
    </html>
  );
}
