import type { Metadata } from "next";
import { Geist, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { BuildInfo } from "@/components/build-info";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Company Games 2026",
  description: "Event Management System für die Company Games 2026",
};

/**
 * Theme vor der Hydration setzen, damit kein falsches Theme aufblitzt.
 * Standard ist dunkel; nur eine gespeicherte Wahl "light" schaltet um.
 */
const themeInitScript = `try{if(localStorage.getItem("cg26-theme")==="light")document.documentElement.dataset.theme="light"}catch(e){}`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="de"
      className={`h-full antialiased ${geistSans.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        {children}
        <BuildInfo />
      </body>
    </html>
  );
}
