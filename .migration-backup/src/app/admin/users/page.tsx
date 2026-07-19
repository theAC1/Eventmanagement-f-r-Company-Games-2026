"use client";

import { useEffect, useState } from "react";

type User = {
  id: string;
  name: string;
  email: string | null;
  username: string | null;
  rolle: string;
  istAktiv: boolean;
  createdAt: string;
};

const ROLLEN = ["ADMIN", "ORGA", "SCHIEDSRICHTER", "HELFER"] as const;

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  ORGA: "Orga",
  SCHIEDSRICHTER: "Schiedsrichter",
  HELFER: "Helfer",
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  // Form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rolle, setRolle] = useState<string>("ORGA");

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    const res = await fetch("/api/users");
    if (res.ok) {
      setUsers(await res.json());
    }
    setLoading(false);
  }

  function resetForm() {
    setName("");
    setEmail("");
    setUsername("");
    setPassword("");
    setRolle("ORGA");
    setEditingId(null);
    setShowForm(false);
    setError("");
  }

  function startEdit(user: User) {
    setName(user.name);
    setEmail(user.email || "");
    setUsername(user.username || "");
    setPassword("");
    setRolle(user.rolle);
    setEditingId(user.id);
    setShowForm(true);
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const payload: Record<string, unknown> = { name, email, username, rolle };
    if (password) payload.password = password;

    const url = editingId ? `/api/users/${editingId}` : "/api/users";
    const method = editingId ? "PUT" : "POST";

    if (!editingId && !password) {
      setError("Passwort ist Pflicht beim Erstellen.");
      return;
    }

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Fehler beim Speichern.");
      return;
    }

    resetForm();
    loadUsers();
  }

  async function toggleActive(user: User) {
    await fetch(`/api/users/${user.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ istAktiv: !user.istAktiv }),
    });
    loadUsers();
  }

  async function handleDelete(user: User) {
    if (!confirm(`${user.name} wirklich löschen?`)) return;
    const res = await fetch(`/api/users/${user.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error || "Fehler beim Löschen.");
      return;
    }
    loadUsers();
  }

  if (loading) {
    return <div className="text-zinc-500">Laden...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">Benutzer</h1>
          <p className="text-sm text-zinc-500 mt-1">
            {users.length} Benutzer registriert
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="px-4 py-2 bg-white text-zinc-950 text-sm font-medium rounded-md hover:bg-zinc-200 transition"
        >
          + Neuer Benutzer
        </button>
      </div>

      {/* Formular */}
      {showForm && (
        <div className="mb-6 p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
          <h2 className="text-sm font-medium mb-4">
            {editingId ? "Benutzer bearbeiten" : "Neuer Benutzer"}
          </h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-700 rounded text-sm text-white focus:border-zinc-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-700 rounded text-sm text-white focus:border-zinc-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Benutzername *</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ""))}
                required
                className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-700 rounded text-sm text-white focus:border-zinc-500 focus:outline-none font-mono"
                placeholder="z.B. max.muster"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">
                Passwort {editingId ? "(leer = unverändert)" : "*"}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required={!editingId}
                minLength={6}
                className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-700 rounded text-sm text-white focus:border-zinc-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Rolle *</label>
              <select
                value={rolle}
                onChange={(e) => setRolle(e.target.value)}
                className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-700 rounded text-sm text-white focus:border-zinc-500 focus:outline-none"
              >
                {ROLLEN.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end gap-2">
              <button
                type="submit"
                className="px-4 py-1.5 bg-white text-zinc-950 text-sm font-medium rounded hover:bg-zinc-200 transition"
              >
                {editingId ? "Speichern" : "Erstellen"}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-1.5 text-sm text-zinc-400 hover:text-white transition"
              >
                Abbrechen
              </button>
            </div>
            {error && (
              <p className="col-span-2 text-sm text-red-400 bg-red-400/10 px-3 py-2 rounded">
                {error}
              </p>
            )}
          </form>
        </div>
      )}

      {/* Tabelle */}
      <div className="border border-zinc-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/50">
              <th className="text-left px-4 py-2.5 text-zinc-400 font-medium">Name</th>
              <th className="text-left px-4 py-2.5 text-zinc-400 font-medium">Username</th>
              <th className="text-left px-4 py-2.5 text-zinc-400 font-medium">Rolle</th>
              <th className="text-left px-4 py-2.5 text-zinc-400 font-medium">Status</th>
              <th className="text-right px-4 py-2.5 text-zinc-400 font-medium">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-zinc-800/50 hover:bg-zinc-900/30">
                <td className="px-4 py-2.5">
                  <div className="text-white">{user.name}</div>
                  {user.email && (
                    <div className="text-xs text-zinc-500">{user.email}</div>
                  )}
                </td>
                <td className="px-4 py-2.5 font-mono text-zinc-400">
                  {user.username || "—"}
                </td>
                <td className="px-4 py-2.5">
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                      user.rolle === "ADMIN"
                        ? "bg-amber-400/10 text-amber-400"
                        : user.rolle === "ORGA"
                        ? "bg-blue-400/10 text-blue-400"
                        : user.rolle === "SCHIEDSRICHTER"
                        ? "bg-green-400/10 text-green-400"
                        : "bg-zinc-400/10 text-zinc-400"
                    }`}
                  >
                    {ROLE_LABELS[user.rolle] || user.rolle}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <button
                    onClick={() => toggleActive(user)}
                    className={`text-xs px-2 py-0.5 rounded ${
                      user.istAktiv
                        ? "bg-emerald-400/10 text-emerald-400"
                        : "bg-red-400/10 text-red-400"
                    }`}
                  >
                    {user.istAktiv ? "Aktiv" : "Deaktiviert"}
                  </button>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <button
                    onClick={() => startEdit(user)}
                    className="text-xs text-zinc-400 hover:text-white transition mr-3"
                  >
                    Bearbeiten
                  </button>
                  <button
                    onClick={() => handleDelete(user)}
                    className="text-xs text-zinc-500 hover:text-red-400 transition"
                  >
                    Löschen
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
