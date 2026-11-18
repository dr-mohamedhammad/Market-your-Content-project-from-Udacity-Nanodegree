import "server-only";
import { NextResponse } from "next/server";
import { TutorError } from "./tutor/claude";

export function tzFrom(req: Request): string {
  const tz = req.headers.get("x-tz") || "UTC";
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return tz;
  } catch {
    return "UTC";
  }
}

export async function handle<T>(fn: () => Promise<T>): Promise<NextResponse> {
  try {
    return NextResponse.json(await fn());
  } catch (e) {
    if (e instanceof TutorError) return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
    console.error("[api]", e);
    // Database errors are shown with Supabase's reason (signed-in owner only) so setup problems can be fixed.
    const msg = e instanceof Error && e.message.startsWith("Database error") ? `Could not reach your database. ${dbHint(e.message)}` : "Unexpected server error.";
    return NextResponse.json({ error: msg, code: "server_error" }, { status: 500 });
  }
}

export async function body<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new TutorError("Invalid request body.", 400, "invalid");
  }
}

function dbHint(message: string): string {
  const m = message.toLowerCase();
  const detail = message.replace(/^Database error:\s*/, "").slice(0, 200);
  if (m.includes("permission denied")) return `Supabase denied access – run the GRANT lines from supabase/schema.sql and check SUPABASE_SERVICE_ROLE_KEY is the secret/service_role key. (${detail})`;
  if (m.includes("does not exist") || m.includes("could not find the table") || m.includes("schema cache")) return `The tables are missing – run supabase/schema.sql in the Supabase SQL Editor, and make sure the Data API exposes the public schema. (${detail})`;
  if (m.includes("invalid api key") || m.includes("jwt") || m.includes("unauthorized")) return `The Supabase key is not valid – check SUPABASE_SERVICE_ROLE_KEY. (${detail})`;
  if (m.includes("fetch failed") || m.includes("enotfound") || m.includes("getaddrinfo")) return `The Supabase URL can't be reached – check SUPABASE_URL. (${detail})`;
  return `Supabase said: ${detail}`;
}
