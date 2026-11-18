import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Public, but only reports which features are configured – never any values.
export async function GET() {
  return NextResponse.json({
    ok: true,
    ai: !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN),
    auth: !!process.env.APP_PASSWORD && (process.env.AUTH_SECRET?.length ?? 0) >= 16,
    database: process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY ? "supabase" : "file",
    cloudVoice: !!process.env.OPENAI_API_KEY,
  });
}
