"use client";

import { useAuth } from "@/lib/auth-context";
import { useLocation } from "wouter";

export function LogoutButton() {
  const { logout } = useAuth();
  const [, navigate] = useLocation();

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <button
      onClick={handleLogout}
      className="text-xs text-zinc-500 hover:text-zinc-300 transition"
    >
      Abmelden
    </button>
  );
}
