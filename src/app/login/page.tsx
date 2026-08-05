"use client";

import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import { ThemeToggle } from "@/components/theme-toggle";

const INPUT_CLASS =
  "w-full h-11 px-3 bg-sunken border border-line-strong rounded-[9px] text-sm text-ink placeholder:text-faint focus:outline-none focus:border-action transition-colors duration-150";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/admin";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      username,
      password,
      redirect: false,
    });

    if (result?.error) {
      // Erstanmeldung: Aktivierungscode wurde als Passwort eingegeben
      if (result.error === "ACTIVATION_REQUIRED") {
        router.push(`/activate?username=${encodeURIComponent(username)}`);
        return;
      }
      if (result.error.startsWith("Zu viele Anmeldeversuche")) {
        setError(result.error);
      } else {
        setError("Benutzername oder Passwort falsch.");
      }
      setLoading(false);
      return;
    }

    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <div className="anim-rise w-full max-w-sm">
        <div className="mb-8 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/logo.png" alt="Company Games 2026" className="mx-auto mb-4 h-24 w-auto" />
          <h1 className="text-2xl font-semibold tracking-[-0.02em] text-ink">Company Games</h1>
          <p className="tnum mt-1 text-sm text-ink-3">2026 · Orga-Zugang</p>
        </div>

        <div className="rounded-[14px] border border-line bg-surface p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="username" className="cg-label mb-1.5 block">
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
                className={INPUT_CLASS}
                placeholder="z.B. juan"
              />
            </div>

            <div>
              <label htmlFor="password" className="cg-label mb-1.5 block">
                Passwort
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                className={INPUT_CLASS}
              />
            </div>

            {error && (
              <p className="rounded-[9px] bg-hot-dim px-3 py-2 text-sm text-hot-tint" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="h-11 w-full rounded-[9px] bg-action px-4 text-sm font-semibold text-on-action transition-colors duration-150 hover:bg-action-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Anmelden …" : "Anmelden"}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-faint">
          Neuen Aktivierungscode erhalten?{" "}
          <a href="/activate" className="text-action hover:text-action-hover">
            Account aktivieren
          </a>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-bg">
          <div className="text-ink-3">Laden …</div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
