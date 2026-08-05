"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle, MapTrifold } from "@phosphor-icons/react";
import { ThemeToggle } from "@/components/theme-toggle";
import { ProgressBar } from "@/components/ui/progress";

type Slot = {
  slotId: string;
  startZeit: string;
  endZeit: string;
  runde: number;
  status: string;
  gameName: string;
  gameSlug: string;
  gegner: string[];
  feld: string | null;
};

type Ergebnis = {
  id: string;
  gameName: string;
  gameSlug: string;
  gamePunkte: number | null;
  rangPunkte: number | null;
  status: string;
};

type TeamPortal = {
  teamId: string;
  teamName: string;
  teamNummer: number;
  teamFarbe: string;
  teamLogo: string | null;
  slots: Slot[];
  ergebnisse: Ergebnis[];
  rangPunkteSumme: number;
  lageplanUrl: string | null;
};

export default function TeamPortalPage() {
  const params = useParams();
  const token = params.token as string;

  const [data, setData] = useState<TeamPortal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = () =>
      fetch(`/api/team/${token}`)
        .then((r) => {
          if (!r.ok) throw new Error("Ungültiger QR-Code");
          return r.json();
        })
        .then((d) => setData(d))
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [token]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg text-ink">
        <p className="text-sm text-ink-3">Lade Team-Portal...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg text-ink">
        <p className="text-sm text-hot-tint">{error ?? "Team nicht gefunden"}</p>
        <Link href="/" className="text-sm text-action">
          Startseite
        </Link>
      </div>
    );
  }

  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const toMin = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  // Aktueller/nächster Slot: erster noch nicht beendeter
  const nextSlot = data.slots.find(
    (s) => s.status !== "ABGESCHLOSSEN" && toMin(s.endZeit) >= nowMin,
  );
  const nextSlotId = nextSlot?.slotId;

  const isLive = (s: Slot) =>
    s.status !== "ABGESCHLOSSEN" &&
    (s.status === "LAUFEND" ||
      (toMin(s.startZeit) <= nowMin && nowMin <= toMin(s.endZeit)));

  const gamesTotal = data.slots.length > 0 ? data.slots.length : data.ergebnisse.length;
  const gamesGewertet = data.ergebnisse.length;
  const progressPct = gamesTotal > 0 ? (gamesGewertet / gamesTotal) * 100 : 0;

  const teamNummer = String(data.teamNummer).padStart(2, "0");

  return (
    <div className="min-h-screen bg-bg text-ink">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-line bg-bg/85 backdrop-blur-sm">
        <div className="mx-auto flex h-[52px] max-w-md items-center gap-3 px-[18px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/logo.png" alt="CG26" className="h-[26px] w-auto" />
          <div className="flex min-w-0 flex-1 items-baseline gap-2">
            <span className="truncate text-sm font-semibold text-ink">{data.teamName}</span>
            <span className="flex shrink-0 items-center gap-1.5">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: data.teamFarbe }}
              />
              <span className="tnum text-[11px] text-ink-3">TEAM {teamNummer}</span>
            </span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="anim-rise mx-auto flex max-w-md flex-col gap-[14px] px-[18px] py-5">
        {/* Punkte-Hero */}
        <section
          className="rounded-2xl border border-line-strong p-5"
          style={{ background: "linear-gradient(160deg, var(--raised) 0%, var(--surface) 70%)" }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-action-tint">
            Eure Rangpunkte
          </p>
          <div className="mt-2 flex items-baseline gap-3">
            <span className="tnum text-[72px] font-bold leading-[0.9] tracking-[-0.03em] text-ink">
              {data.rangPunkteSumme}
            </span>
            <span className="text-[15px] text-ink-3">
              aus {gamesGewertet} von {gamesTotal} Games
            </span>
          </div>
          <ProgressBar pct={progressPct} height={6} className="mt-4" />
        </section>

        {/* Nächster Einsatz */}
        {nextSlot && (
          <section
            className="rounded-[14px] border-[1.5px] bg-action-row p-[18px]"
            style={{ borderColor: "color-mix(in srgb, var(--action) 50%, transparent)" }}
          >
            <p className="cg-label text-[11px] text-label">Euer nächster Einsatz</p>
            <div className="mt-2.5 flex items-baseline justify-between gap-3">
              <span className="text-lg font-semibold text-ink">{nextSlot.gameName}</span>
              <span className="tnum shrink-0 text-[13px] text-action-tint">
                {nextSlot.startZeit} – {nextSlot.endZeit}
              </span>
            </div>
            <p className="mt-1 text-sm text-ink-2">
              Runde {nextSlot.runde}
              {nextSlot.feld && <> · Feld {nextSlot.feld}</>}
              {nextSlot.gegner.length > 0 && <> · vs. {nextSlot.gegner.join(", ")}</>}
            </p>
            <a
              href="#lageplan"
              className="mt-3.5 flex h-12 items-center justify-center gap-2 rounded-[11px] border border-line-strong text-sm font-medium text-ink-2 transition-colors duration-150 hover:border-action hover:text-ink"
            >
              <MapTrifold size={17} weight="bold" />
              Lageplan
            </a>
          </section>
        )}

        {/* Spielplan */}
        <section className="flex flex-col gap-2.5">
          <h2 className="cg-label text-[11px] text-label">Spielplan</h2>
          {data.slots.length === 0 ? (
            <p className="text-sm text-ink-3">Noch kein Zeitplan verfügbar</p>
          ) : (
            <div className="flex flex-col gap-2">
              {data.slots.map((s) => {
                const done = s.status === "ABGESCHLOSSEN";
                const live = isLive(s);
                const isNext = s.slotId === nextSlotId;
                return (
                  <div
                    key={s.slotId}
                    className={`flex h-12 items-center gap-3 rounded-xl border px-4 ${
                      done
                        ? "border-line-soft bg-surface"
                        : isNext
                          ? "border-line-strong bg-surface"
                          : "border-line bg-surface"
                    }`}
                  >
                    {done ? (
                      <CheckCircle size={16} weight="bold" className="shrink-0 text-done" />
                    ) : live ? (
                      <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-warn" />
                    ) : (
                      <span className="h-[7px] w-[7px] shrink-0" />
                    )}
                    <span
                      className={`tnum shrink-0 text-xs ${done ? "text-faint" : "text-ink-3"}`}
                    >
                      {s.startZeit}–{s.endZeit}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span
                        className={`truncate text-sm font-medium ${
                          done ? "text-ink-3" : "text-ink"
                        }`}
                      >
                        {s.gameName}
                      </span>
                      {s.gegner.length > 0 && (
                        <span
                          className={`truncate text-[11px] ${done ? "text-faint" : "text-ink-3"}`}
                        >
                          vs. {s.gegner.join(", ")}
                        </span>
                      )}
                    </span>
                    <span className={`shrink-0 text-[11px] ${done ? "text-faint" : "text-ink-3"}`}>
                      {s.feld ? `Feld ${s.feld} · ` : ""}Runde {s.runde}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Punkte pro Game */}
        <section className="flex flex-col gap-2.5">
          <h2 className="cg-label text-[11px] text-label">Punkte pro Game</h2>
          {data.ergebnisse.length === 0 ? (
            <p className="text-sm text-ink-3">Noch keine Ergebnisse</p>
          ) : (
            <div className="flex flex-col gap-2">
              {data.ergebnisse.map((e) => (
                <div
                  key={e.id}
                  className="flex h-12 items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4"
                >
                  <span className="min-w-0 truncate text-sm font-medium text-ink">
                    {e.gameName}
                  </span>
                  <span className="flex shrink-0 items-baseline gap-3">
                    {e.gamePunkte !== null && (
                      <span className="tnum text-xs text-ink-3">{e.gamePunkte} Pkt</span>
                    )}
                    {e.rangPunkte !== null && (
                      <span className="tnum text-sm font-semibold text-ink">+{e.rangPunkte}</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Lageplan */}
        <section id="lageplan" className="flex flex-col gap-2.5 scroll-mt-16">
          <h2 className="cg-label text-[11px] text-label">Lageplan</h2>
          {data.lageplanUrl ? (
            <a
              href={data.lageplanUrl}
              target="_blank"
              rel="noreferrer"
              className="block h-24 overflow-hidden rounded-xl border border-line bg-surface"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={data.lageplanUrl}
                alt="Lageplan"
                className="h-full w-full object-cover opacity-70 transition-opacity duration-150 hover:opacity-90"
              />
            </a>
          ) : (
            <div className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-ink-3">
              Lageplan noch nicht verfügbar
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
