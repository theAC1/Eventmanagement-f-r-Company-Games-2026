import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";

export default function RefereeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-bg text-ink">
      <header className="sticky top-0 z-50 border-b border-line bg-bg/95 backdrop-blur">
        <div className="flex h-[52px] items-center justify-between px-[18px]">
          <Link
            href="/referee"
            className="flex items-center gap-2.5 transition-opacity duration-150 hover:opacity-80"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/logo.png" alt="CG26" className="h-[26px] w-auto" />
            <span className="text-[15px] font-semibold tracking-tight">
              Schiedsrichter
            </span>
          </Link>
          <ThemeToggle />
        </div>
      </header>
      <main className="px-[18px] py-5">{children}</main>
    </div>
  );
}
