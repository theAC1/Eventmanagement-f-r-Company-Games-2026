"use client";

import { useEffect, useState } from "react";

function formatMMSS(totalSeconds: number): string {
  const absSeconds = Math.abs(totalSeconds);
  const minutes = Math.floor(absSeconds / 60);
  const seconds = absSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function parsePlannedEnd(
  startTime: Date,
  slotEndZeit: string,
): Date {
  const [hours, minutes] = slotEndZeit.split(":").map(Number);
  const planned = new Date(startTime);
  planned.setHours(hours, minutes, 0, 0);
  return planned;
}

export function GameTimer({
  startTime,
  slotEndZeit,
}: {
  startTime: Date;
  slotStartZeit?: string;
  slotEndZeit?: string;
}) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const elapsedSeconds = Math.max(
    0,
    Math.floor((now.getTime() - startTime.getTime()) / 1000),
  );

  const plannedEnd = slotEndZeit
    ? parsePlannedEnd(startTime, slotEndZeit)
    : null;

  const diffSeconds = plannedEnd
    ? Math.floor((now.getTime() - plannedEnd.getTime()) / 1000)
    : null;

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-4xl font-mono font-bold tracking-wider text-white">
        {formatMMSS(elapsedSeconds)}
      </span>
      {diffSeconds !== null && (
        <span
          className={`text-sm font-mono ${
            diffSeconds < 0
              ? "text-emerald-400"
              : "text-red-400"
          }`}
        >
          {diffSeconds < 0
            ? `-${formatMMSS(Math.abs(diffSeconds))} verbleibend`
            : `+${formatMMSS(diffSeconds)} über Plan`}
        </span>
      )}
    </div>
  );
}
