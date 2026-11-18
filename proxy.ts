import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, authSecret, verifyToken } from "./lib/auth";

const PUBLIC = ["/login", "/api/auth/login", "/api/health", "/manifest.webmanifest", "/sw.js", "/offline.html"];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname === p) || pathname.startsWith("/icons/")) return NextResponse.next();

  const secret = authSecret();
  const ok = secret ? await verifyToken(req.cookies.get(SESSION_COOKIE)?.value, secret) : false;
  if (ok) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Not signed in", code: "unauthorized" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|ico|webp|jpg)$).*)"],
};
