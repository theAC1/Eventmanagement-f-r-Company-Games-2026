/**
 * Sicherer Fetch-Wrapper für API-Calls
 * Verhindert weisse Bildschirme bei API-Fehlern
 */
export async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}
