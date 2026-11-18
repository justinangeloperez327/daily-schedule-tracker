import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"], display: "swap" });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "Daily Schedule Tracker",
  description: "Manage daily site schedules, projects, employees, and equipment.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={geist.variable + " " + geistMono.variable + " min-h-screen min-w-0 overflow-x-clip bg-background"}>
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
