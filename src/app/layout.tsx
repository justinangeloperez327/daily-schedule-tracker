import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

export const metadata: Metadata = {
  title: "Daily Schedule Tracker",
  description: "Manage daily site schedules, projects, employees, and equipment.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen min-w-0 overflow-x-clip bg-[#fafbfc]">
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
