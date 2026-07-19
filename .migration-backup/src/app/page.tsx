export default function Home() {
  return (
    <div
      className="min-h-screen flex items-center justify-center text-white relative"
      style={{
        backgroundImage: "url('/images/situationsplan.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/70" />

      <div className="relative z-10 text-center space-y-6">
        <img
          src="/images/logo.png"
          alt="Company Games 2026"
          className="mx-auto h-32 w-auto drop-shadow-2xl"
        />
        <h1 className="text-5xl font-bold tracking-tight drop-shadow-lg">
          Company Games 2026
        </h1>
        <p className="text-zinc-300 text-lg">
          Event Management System
        </p>
        <div className="flex gap-4 justify-center text-sm pt-2">
          <a href="/admin" className="px-5 py-2.5 bg-white text-black rounded-lg font-medium hover:bg-zinc-200 transition">
            Admin
          </a>
          <a href="/referee" className="px-5 py-2.5 border border-white/30 rounded-lg hover:border-white/60 hover:bg-white/10 transition backdrop-blur-sm">
            Schiedsrichter
          </a>
          <a href="/scoreboard" className="px-5 py-2.5 border border-white/30 rounded-lg hover:border-white/60 hover:bg-white/10 transition backdrop-blur-sm">
            Scoreboard
          </a>
        </div>
      </div>
    </div>
  );
}
