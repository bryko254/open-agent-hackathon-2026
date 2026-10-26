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
  title: "Evidence Agent · The Agent That Can Explain Why",
  description:
    "Open Agent Hackathon 2026 Track 02. An agent that investigates a goal, cites evidence, and explains why that evidence supports the outcome.",
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
          Evidence Agent · Track 02 · The Agent That Can Explain Why ·{" "}
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
