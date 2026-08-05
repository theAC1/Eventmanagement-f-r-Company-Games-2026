import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-bg/85 backdrop-blur-sm">
      <div className="mx-auto flex h-13 max-w-7xl items-center gap-3 px-4">
        <Link href="/" className="flex items-center gap-2.5 transition-opacity duration-150 hover:opacity-80">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/logo.png" alt="Company Games 2026" className="h-[26px] w-auto" />
          <span className="flex flex-col leading-tight">
            <span className="text-xs font-semibold tracking-[-0.01em] text-ink">Company Games</span>
            <span className="tnum text-[10px] font-medium text-ink-3">2026</span>
          </span>
        </Link>
        <span className="flex-1" />
        <ThemeToggle />
      </div>
    </header>
  );
}
