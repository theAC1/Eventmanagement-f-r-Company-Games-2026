import Link from "next/link";

export function PublicHeader() {
  return (
    <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-12 flex items-center">
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition">
          <img src="/images/logo.png" alt="Company Games 2026" className="h-6 w-auto" />
          <span className="text-xs font-medium text-zinc-400">Company Games 2026</span>
        </Link>
      </div>
    </header>
  );
}
