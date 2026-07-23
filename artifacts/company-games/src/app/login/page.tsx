"use client";

import { useState, Suspense } from "react";
import { useLocation, useSearch } from "wouter";
import { useAuth, homeForRole } from "@/lib/auth-context";

function LoginForm() {
  const { login } = useAuth();
  const [, navigate] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const callbackUrl = params.get("callbackUrl");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await login(username, password);
      if (result.requiresActivation) {
        navigate(`/activate?username=${encodeURIComponent(result.username)}`);
        return;
      }
      navigate(callbackUrl || homeForRole(result.user.rolle));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Benutzername oder Passwort falsch.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(245,158,11,0.08),transparent_55%),radial-gradient(circle_at_75%_80%,rgba(59,130,246,0.08),transparent_55%)]" />
      <div className="w-full max-w-sm relative">
        <div className="text-center mb-8">
          <img
            src="/images/logo.png"
            alt="Company Games 2026"
            className="mx-auto h-24 w-auto mb-4 drop-shadow-lg"
          />
          <h1 className="text-3xl font-bold tracking-tight text-white">CG26</h1>
          <p className="text-sm text-zinc-500 mt-1">Company Games 2026 · Anmeldung</p>
        </div>

        <div className="bg-zinc-900/70 backdrop-blur border border-zinc-800 rounded-xl p-6 shadow-xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm text-zinc-400 mb-1.5">
                Benutzername
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoFocus
                required
                className="w-full px-3 py-2.5 text-base bg-zinc-950 border border-zinc-800 rounded-md text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/40 transition"
                autoCapitalize="none"
                autoCorrect="off"
                placeholder="z.B. juan"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm text-zinc-400 mb-1.5">
                Passwort <span className="text-zinc-600">oder Aktivierungscode</span>
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                className="w-full px-3 py-2.5 text-base bg-zinc-950 border border-zinc-800 rounded-md text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/40 transition"
              />
            </div>

            {error && (
              <p className="text-sm text-red-400 bg-red-400/10 px-3 py-2 rounded-md">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-amber-500 text-zinc-950 font-semibold rounded-md hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {loading ? "..." : "Anmelden"}
            </button>
          </form>
        </div>

        <p className="text-xs text-zinc-600 text-center mt-6">
          Erstanmeldung mit Aktivierungscode?{" "}
          <a href="activate" className="text-amber-500/80 hover:text-amber-400">
            Account aktivieren
          </a>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-500">Laden...</div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
