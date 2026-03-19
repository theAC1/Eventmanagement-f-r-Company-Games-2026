import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Company Games 2026",
  description: "Event Management System für die Company Games 2026",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
