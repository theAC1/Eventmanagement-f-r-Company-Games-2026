"use client";

import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";

export function KvpFloatingButton() {
  const { user } = useAuth();
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState({ typ: "BUG", titel: "", beschreibung: "" });

  // Only show for ORGA+
  if (!user || !["ADMIN", "ORGA"].includes(user.rolle)) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch("/api/kvp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...form, seite: location }),
      });
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setOpen(false);
        setForm({ typ: "BUG", titel: "", beschreibung: "" });
      }, 1500);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-600 transition flex items-center justify-center text-lg"
        title="Feedback / KVP"
      >
        ⚑
      </button>
      {open && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-sm p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Feedback / KVP</h3>
              <button onClick={() => setOpen(false)} className="text-zinc-500 hover:text-white text-lg leading-none">×</button>
            </div>
            {success ? (
              <p className="text-emerald-400 text-sm text-center py-4">Danke! Feedback gesendet ✓</p>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3">
                <select
                  value={form.typ}
                  onChange={(e) => setForm((f) => ({ ...f, typ: e.target.value }))}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-white text-sm"
                >
                  <option value="BUG">Bug</option>
                  <option value="WUNSCHFUNKTION">Wunschfunktion</option>
                  <option value="IDEE">Idee</option>
                </select>
                <input
                  type="text"
                  placeholder="Titel (max. 100 Zeichen)"
                  maxLength={100}
                  required
                  value={form.titel}
                  onChange={(e) => setForm((f) => ({ ...f, titel: e.target.value }))}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-white text-sm placeholder-zinc-600"
                />
                <textarea
                  placeholder="Beschreibung"
                  maxLength={500}
                  required
                  value={form.beschreibung}
                  onChange={(e) => setForm((f) => ({ ...f, beschreibung: e.target.value }))}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-white text-sm placeholder-zinc-600 h-20 resize-none"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2 bg-white text-zinc-950 text-sm font-medium rounded-md hover:bg-zinc-200 disabled:opacity-50 transition"
                >
                  {loading ? "..." : "Senden"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
