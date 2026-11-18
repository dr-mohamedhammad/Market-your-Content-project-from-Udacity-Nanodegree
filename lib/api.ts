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
    const msg = e instanceof Error && e.message.startsWith("Database error") ? "Could not save your data (database error). Check the database settings." : "Unexpected server error.";
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
