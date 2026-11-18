import { NextResponse } from "next/server";

export const maxDuration = 60;

// Cloud text-to-speech (OpenAI) – a natural teacher voice. Falls back to the browser voice on the client.
export async function POST(req: Request) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return NextResponse.json({ error: "Cloud voice is not configured (OPENAI_API_KEY)." }, { status: 503 });
  let text = "";
  let speed = 1;
  try {
    const b = (await req.json()) as { text?: string; speed?: number };
    text = String(b.text ?? "").slice(0, 1500);
    speed = Math.min(1.2, Math.max(0.7, Number(b.speed) || 1));
  } catch {}
  if (!text.trim()) return NextResponse.json({ error: "No text." }, { status: 400 });
  try {
    const r = await fetch(`${process.env.OPENAI_BASE_URL || "https://api.openai.com/v1"}/audio/speech`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts",
        voice: process.env.OPENAI_TTS_VOICE || "coral",
        input: text,
        speed,
        instructions: "You are a warm, patient English teacher speaking to an intermediate learner. Speak clearly and naturally, at a calm pace.",
        response_format: "mp3",
      }),
    });
    if (!r.ok || !r.body) {
      console.error("[tts]", r.status, await r.text().catch(() => ""));
      return NextResponse.json({ error: "Text-to-speech failed." }, { status: 502 });
    }
    return new NextResponse(r.body, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=86400" } });
  } catch {
    return NextResponse.json({ error: "Could not reach the speech service." }, { status: 503 });
  }
}
