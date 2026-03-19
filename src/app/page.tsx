export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-white">
      <div className="text-center space-y-6">
        <h1 className="text-5xl font-bold tracking-tight">
          Company Games 2026
        </h1>
        <p className="text-zinc-400 text-lg">
          Event Management System
        </p>
        <div className="flex gap-4 justify-center text-sm">
          <a href="/admin" className="px-4 py-2 bg-white text-black rounded-lg font-medium hover:bg-zinc-200 transition">
            Admin
          </a>
          <a href="/referee" className="px-4 py-2 border border-zinc-700 rounded-lg hover:border-zinc-500 transition">
            Schiedsrichter
          </a>
          <a href="/scoreboard" className="px-4 py-2 border border-zinc-700 rounded-lg hover:border-zinc-500 transition">
            Scoreboard
          </a>
        </div>
        <p className="text-zinc-600 text-xs pt-8">
          Next.js + Socket.io + PostgreSQL + Prisma
        </p>
      </div>
    </div>
  );
}
