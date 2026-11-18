"use client";
// Browser-side API helper. Sends the learner's time zone so streaks and "today" are local.

export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string) {
    super(message);
  }
}

export async function api<T = unknown>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("x-tz", Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
  let bodyInit = init.body;
  if (init.json !== undefined) {
    headers.set("Content-Type", "application/json");
    bodyInit = JSON.stringify(init.json);
  }
  let res: Response;
  try {
    res = await fetch(path, { ...init, headers, body: bodyInit, cache: "no-store" });
  } catch {
    throw new ApiError("You seem to be offline. Check your connection and try again.", 0, "offline");
  }
  if (res.status === 401 && typeof window !== "undefined" && !path.startsWith("/api/auth")) {
    window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
    throw new ApiError("Please sign in again.", 401, "unauthorized");
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
  if (!res.ok) throw new ApiError(data.error || `Request failed (${res.status})`, res.status, data.code);
  return data as T;
}

export function fmtDate(iso: string, lang: string) {
  const d = iso.length === 10 ? new Date(iso + "T12:00:00") : new Date(iso);
  return d.toLocaleDateString(lang === "ar" ? "ar-EG" : "en-GB", { weekday: "short", day: "numeric", month: "short" });
}

export function readPref<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v == null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
}

export function writePref(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}
