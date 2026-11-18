import { NextResponse } from "next/server";
import { SESSION_COOKIE, SESSION_MAX_AGE, authSecret, createToken, safeEqual } from "@/lib/auth";

// Simple in-memory brute-force protection (per server instance).
const attempts = new Map<string, { n: number; until: number }>();

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  const a = attempts.get(ip);
  if (a && a.until > Date.now()) {
    return NextResponse.json({ error: "Too many attempts. Wait a minute and try again." }, { status: 429 });
  }
  const password = process.env.APP_PASSWORD;
  const secret = authSecret();
  if (!password || !secret) {
    return NextResponse.json({ error: "Server not configured: set APP_PASSWORD and AUTH_SECRET (16+ characters)." }, { status: 503 });
  }
  let given = "";
  try { given = String(((await req.json()) as { password?: string }).password ?? ""); } catch {}
  if (!(await safeEqual(given, password))) {
    const n = (a?.n ?? 0) + 1;
    attempts.set(ip, { n, until: n >= 5 ? Date.now() + 60_000 : 0 });
    return NextResponse.json({ error: "Wrong password." }, { status: 401 });
  }
  attempts.delete(ip);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await createToken(secret), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
