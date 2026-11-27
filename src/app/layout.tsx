import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppShell } from "@/components/app-shell";
import { getCurrentUser } from "@/lib/auth";
import "./globals.css";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"], display: "swap" });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "Daily Schedule Tracker",
  description: "Manage daily site schedules, projects, employees, and equipment.",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // A missing/unreachable database must not crash every page; the pages
  // themselves show the database error from the API.
  const user = await getCurrentUser().catch(() => null);
  return (
    <html lang="en">
      <body className={geist.variable + " " + geistMono.variable + " min-h-screen min-w-0 overflow-x-clip bg-background"}>
        <AppShell user={user}>{children}</AppShell>
      </body>
    </html>
  );
}
