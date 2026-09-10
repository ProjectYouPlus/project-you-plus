import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/theme/theme-provider";
import "./globals.css";
import "./themes.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "Project You+ — Build the 1% version of yourself",
  description: "An AI-powered personal operating system connecting your goals, tasks, calendar, finances, fitness, health, and habits into one intelligent system.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#050509" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} data-theme="original" suppressHydrationWarning>
      <body className="font-sans antialiased"><ThemeProvider>{children}</ThemeProvider></body>
    </html>
  );
}
