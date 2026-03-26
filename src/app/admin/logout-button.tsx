"use client";

import { signOut } from "next-auth/react";

export function LogoutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="text-xs text-zinc-500 hover:text-zinc-300 transition"
    >
      Abmelden
    </button>
  );
}
