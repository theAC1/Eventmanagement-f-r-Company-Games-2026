"use client";

import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle, Circle } from "@phosphor-icons/react";
import { checkPassword, isPasswordValid, PASSWORD_RULE_LABELS } from "@/lib/password";
import { ThemeToggle } from "@/components/theme-toggle";

const INPUT_CLASS =
  "w-full h-11 px-3 bg-sunken border border-line-strong rounded-[9px] text-sm text-ink placeholder:text-faint focus:outline-none focus:border-action transition-colors duration-150";

function RuleItem({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li
      className={`flex items-center gap-1.5 transition-colors duration-150 ${ok ? "text-done-tint" : "text-faint"}`}
    >
      {ok ? <CheckCircle size={13} weight="bold" /> : <Circle size={13} weight="bold" />}
      {label}
    </li>
  );
}

function ActivateForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [username, setUsername] = useState(searchParams.get("username") || "");
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
      const res = await fetch("/api/auth/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          aktivierungsCode: aktivierungsCode.trim(),
          neuesPasswort,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error ?? "Aktivierung fehlgeschlagen.");
      }

      // Direkt mit dem neuen Passwort einloggen
      const result = await signIn("credentials", {
        username: username.trim(),
        password: neuesPasswort,
        redirect: false,
      });
      if (result?.error) {
        // Aktivierung hat geklappt, Login nicht — zur Login-Seite
        router.push("/login");
        return;
      }
      router.push("/admin");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Aktivierung fehlgeschlagen.");
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-bg px-4 py-10">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <div className="anim-rise relative w-full max-w-sm">
        <div className="mb-8 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/logo.png" alt="Company Games 2026" className="mx-auto mb-4 h-20 w-auto" />
          <h1 className="text-2xl font-semibold tracking-[-0.02em] text-ink">Account aktivieren</h1>
          <p className="mt-1 text-sm text-ink-3">Erstanmeldung mit Aktivierungscode</p>
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
                required
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <label htmlFor="code" className="cg-label mb-1.5 block">
                Aktivierungscode
              </label>
              <input
                id="code"
                type="text"
                value={aktivierungsCode}
                onChange={(e) => setAktivierungsCode(e.target.value)}
                required
                className={`${INPUT_CLASS} tnum tracking-[0.15em]`}
                placeholder="Vom Owner erhalten"
              />
            </div>

            <div>
              <label htmlFor="pw" className="cg-label mb-1.5 block">
                Neues Passwort
              </label>
              <input
                id="pw"
                type="password"
                value={neuesPasswort}
                onChange={(e) => setNeuesPasswort(e.target.value)}
                autoComplete="new-password"
                required
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <label htmlFor="pw2" className="cg-label mb-1.5 block">
                Passwort bestätigen
              </label>
              <input
                id="pw2"
                type="password"
                value={bestaetigung}
                onChange={(e) => setBestaetigung(e.target.value)}
                autoComplete="new-password"
                required
                className={INPUT_CLASS}
              />
            </div>

            <ul className="space-y-1 text-xs">
              {PASSWORD_RULE_LABELS.map(({ key, label }) => (
                <RuleItem key={key} ok={rules[key]} label={label} />
              ))}
              <RuleItem ok={bestaetigungOk} label="Passwörter stimmen überein" />
            </ul>

            {error && (
              <p className="rounded-[9px] bg-hot-dim px-3 py-2 text-sm text-hot-tint" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !passwortOk || !bestaetigungOk}
              className="h-11 w-full rounded-[9px] bg-action px-4 text-sm font-semibold text-on-action transition-colors duration-150 hover:bg-action-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Aktivieren …" : "Aktivieren & Passwort setzen"}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-faint">
          Bereits aktiviert?{" "}
          <a href="/login" className="text-action hover:text-action-hover">
            Zur Anmeldung
          </a>
        </p>
      </div>
    </div>
  );
}

export default function ActivatePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-bg">
          <div className="text-ink-3">Laden …</div>
        </div>
      }
    >
      <ActivateForm />
    </Suspense>
  );
}
