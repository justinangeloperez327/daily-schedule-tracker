import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Daily Schedule Tracker",
  description: "Plan and manage daily site work, labour, and equipment schedules.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
