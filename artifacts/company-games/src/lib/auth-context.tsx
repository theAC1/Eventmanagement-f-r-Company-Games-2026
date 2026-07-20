import React, { createContext, useContext, useEffect, useState } from "react";
import { useLocation } from "wouter";

export type AuthUser = {
  id: string;
  name: string;
  email: string | null;
  rolle: "OWNER" | "ADMIN" | "ORGA" | "SCHIEDSRICHTER" | "HELFER";
};

export type LoginResult =
  | { requiresActivation: true; username: string }
  | { requiresActivation: false; user: AuthUser };

type AuthContextValue = {
  user: AuthUser | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<LoginResult>;
  activate: (username: string, aktivierungsCode: string, neuesPasswort: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

// Zielroute nach Login/Aktivierung anhand der Rolle
export function homeForRole(rolle: string): string {
  return rolle === "SCHIEDSRICHTER" ? "/referee" : "/admin";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => setUser(data?.user ?? null))
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false));
  }, []);

  async function login(username: string, password: string): Promise<LoginResult> {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Login fehlgeschlagen");
    }
    const data = await res.json();
    if (data.requiresActivation) {
      return { requiresActivation: true, username: data.username };
    }
    setUser(data.user);
    return { requiresActivation: false, user: data.user };
  }

  async function activate(username: string, aktivierungsCode: string, neuesPasswort: string): Promise<AuthUser> {
    const res = await fetch("/api/auth/activate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ username, aktivierungsCode, neuesPasswort }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Aktivierung fehlgeschlagen");
    }
    const data = await res.json();
    setUser(data.user);
    return data.user;
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, activate, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function ROLE_HIERARCHY(): Record<string, number> {
  return { OWNER: 200, ADMIN: 100, ORGA: 50, SCHIEDSRICHTER: 20, HELFER: 10 };
}

export function hasMinRole(userRole: string, requiredRole: string): boolean {
  const h = ROLE_HIERARCHY();
  return (h[userRole] ?? 0) >= (h[requiredRole] ?? 999);
}

// Protect admin routes - redirects to /login if not authenticated
export function RequireAuth({
  children,
  minRole = "SCHIEDSRICHTER",
}: {
  children: React.ReactNode;
  minRole?: string;
}) {
  const { user, isLoading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/login");
    }
  }, [user, isLoading, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-500">Laden...</div>
      </div>
    );
  }

  if (!user) return null;

  if (!hasMinRole(user.rolle, minRole)) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-red-400">Keine Berechtigung</div>
      </div>
    );
  }

  return <>{children}</>;
}
