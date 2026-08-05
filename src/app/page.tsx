import Link from "next/link";

export default function Home() {
  return (
    <div
      className="relative flex min-h-screen items-center justify-center"
      style={{
        backgroundImage: "url('/images/situationsplan.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* Abdunklung über dem Luftbild — bewusst theme-unabhängig */}
      <div className="absolute inset-0" style={{ background: "rgba(6, 11, 19, 0.74)" }} />

      <div className="anim-rise relative z-10 space-y-6 px-4 text-center text-[#E9F0F8]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/logo.png" alt="Company Games 2026" className="mx-auto h-32 w-auto drop-shadow-2xl" />
        <h1 className="text-4xl font-semibold tracking-[-0.03em] drop-shadow-lg sm:text-5xl">
          Company Games 2026
        </h1>
        <p className="text-lg text-[#C8D6E8]">Event Management System</p>
        <div className="flex flex-wrap justify-center gap-3 pt-2 text-sm">
          <Link
            href="/admin"
            className="inline-flex h-11 items-center rounded-[9px] bg-[#3DA5E5] px-5 font-semibold text-[#06121D] transition-colors duration-150 hover:bg-[#7CC4EF]"
          >
            Orga
          </Link>
          <Link
            href="/referee"
            className="inline-flex h-11 items-center rounded-[9px] border border-white/30 px-5 font-medium backdrop-blur-sm transition-colors duration-150 hover:border-white/60 hover:bg-white/10"
          >
            Schiedsrichter
          </Link>
          <Link
            href="/scoreboard"
            className="inline-flex h-11 items-center rounded-[9px] border border-white/30 px-5 font-medium backdrop-blur-sm transition-colors duration-150 hover:border-white/60 hover:bg-white/10"
          >
            Scoreboard
          </Link>
        </div>
      </div>
    </div>
  );
}
