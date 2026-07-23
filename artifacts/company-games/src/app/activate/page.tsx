"use client";

import { useState, Suspense } from "react";
import { useLocation, useSearch } from "wouter";
import { useAuth, homeForRole } from "@/lib/auth-context";
import { checkPassword, isPasswordValid, PASSWORD_RULE_LABELS } from "@/lib/password-rules";

function ActivateForm() {
  const { activate } = useAuth();
  const [, navigate] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);

  const [username, setUsername] = useState(params.get("username") || "");
  const [aktivierungsCode, setAktivierungsCode] = useState("");
  const [neuesPasswort, setNeuesPasswort] = useState("");
  const [bestaetigung, setBestaetigung] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const rules = checkPassword(neuesPasswort);
  const passwortOk = isPasswordValid(neuesPasswort);
  const bestaetigungOk = neuesPasswort.length > 0 && neuesPasswort === bestaetigung;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!passwortOk) {
      setError("Das Passwort erfüllt nicht alle Anforderungen.");
      return;
    }
    if (!bestaetigungOk) {
      setError("Die Passwörter stimmen nicht überein.");
      return;
    }
    setLoading(true);
    try {
      const user = await activate(username.trim(), aktivierungsCode.trim(), neuesPasswort);
      navigate(homeForRole(user.rolle));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Aktivierung fehlgeschlagen.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4 py-10 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(245,158,11,0.08),transparent_55%),radial-gradient(circle_at_75%_80%,rgba(59,130,246,0.08),transparent_55%)]" />
      <div className="w-full max-w-sm relative">
        <div className="text-center mb-8">
          <img
            src="/images/logo.png"
            alt="Company Games 2026"
            className="mx-auto h-20 w-auto mb-4 drop-shadow-lg"
          />
          <h1 className="text-2xl font-bold tracking-tight text-white">Account aktivieren</h1>
          <p className="text-sm text-zinc-500 mt-1">Erstanmeldung mit Aktivierungscode</p>
        </div>

        <div className="bg-zinc-900/70 backdrop-blur border border-zinc-800 rounded-xl p-6 shadow-xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm text-zinc-400 mb-1.5">Benutzername</label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                required
                className="w-full px-3 py-2.5 text-base bg-zinc-950 border border-zinc-800 rounded-md text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/40 transition"
              />
            </div>

            <div>
              <label htmlFor="code" className="block text-sm text-zinc-400 mb-1.5">Aktivierungscode</label>
              <input
                id="code"
                type="text"
                value={aktivierungsCode}
                onChange={(e) => setAktivierungsCode(e.target.value)}
                required
                className="w-full px-3 py-2.5 text-base bg-zinc-950 border border-zinc-800 rounded-md text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/40 transition font-mono"
                placeholder="Vom Owner erhalten"
              />
            </div>

            <div>
              <label htmlFor="pw" className="block text-sm text-zinc-400 mb-1.5">Neues Passwort</label>
              <input
                id="pw"
                type="password"
                value={neuesPasswort}
                onChange={(e) => setNeuesPasswort(e.target.value)}
                autoComplete="new-password"
                required
                className="w-full px-3 py-2.5 text-base bg-zinc-950 border border-zinc-800 rounded-md text-white focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/40 transition"
              />
            </div>

            <div>
              <label htmlFor="pw2" className="block text-sm text-zinc-400 mb-1.5">Passwort bestätigen</label>
              <input
                id="pw2"
                type="password"
                value={bestaetigung}
                onChange={(e) => setBestaetigung(e.target.value)}
                autoComplete="new-password"
                required
                className="w-full px-3 py-2.5 text-base bg-zinc-950 border border-zinc-800 rounded-md text-white focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/40 transition"
              />
            </div>

            <ul className="space-y-1 text-xs">
              {PASSWORD_RULE_LABELS.map(({ key, label }) => (
                <li key={key} className={rules[key] ? "text-emerald-400" : "text-zinc-500"}>
                  {rules[key] ? "✓" : "○"} {label}
                </li>
              ))}
              <li className={bestaetigungOk ? "text-emerald-400" : "text-zinc-500"}>
                {bestaetigungOk ? "✓" : "○"} Passwörter stimmen überein
              </li>
            </ul>

            {error && (
              <p className="text-sm text-red-400 bg-red-400/10 px-3 py-2 rounded-md">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !passwortOk || !bestaetigungOk}
              className="w-full py-3 px-4 bg-amber-500 text-zinc-950 font-semibold rounded-md hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {loading ? "..." : "Aktivieren & Passwort setzen"}
            </button>
          </form>
        </div>

        <p className="text-xs text-zinc-600 text-center mt-6">
          Bereits aktiviert?{" "}
          <a href="login" className="text-amber-500/80 hover:text-amber-400">Zur Anmeldung</a>
        </p>
      </div>
    </div>
  );
}

export default function ActivatePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-500">Laden...</div>
      </div>
    }>
      <ActivateForm />
    </Suspense>
  );
}
