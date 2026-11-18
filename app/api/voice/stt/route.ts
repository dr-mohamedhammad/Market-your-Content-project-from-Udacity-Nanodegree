import { NextResponse } from "next/server";

export const maxDuration = 60;

// Cloud speech-to-text (OpenAI). Used when the browser has no built-in speech recognition
// or when the learner selects "Cloud voice" in Settings. The API key stays on the server.
export async function POST(req: Request) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return NextResponse.json({ error: "Cloud voice is not configured (OPENAI_API_KEY)." }, { status: 503 });
  let form: FormData;
  try { form = await req.formData(); } catch { return NextResponse.json({ error: "Invalid audio upload." }, { status: 400 }); }
  const audio = form.get("audio");
  if (!(audio instanceof Blob) || audio.size < 800) return NextResponse.json({ text: "" });
  if (audio.size > 20 * 1024 * 1024) return NextResponse.json({ error: "Recording too long." }, { status: 413 });

  const type = audio.type || "audio/webm";
  const ext = type.includes("mp4") || type.includes("m4a") ? "m4a" : type.includes("ogg") ? "ogg" : type.includes("wav") ? "wav" : "webm";
  const out = new FormData();
  out.append("file", audio, `speech.${ext}`);
  out.append("model", process.env.OPENAI_STT_MODEL || "gpt-4o-mini-transcribe");
  out.append("language", "en");
  // Keep the learner's real wording (including mistakes) – the tutor needs them to correct.
  out.append("prompt", "Transcribe exactly what the English learner says, including grammar mistakes. Do not correct anything.");
  try {
    const r = await fetch(`${process.env.OPENAI_BASE_URL || "https://api.openai.com/v1"}/audio/transcriptions`, { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: out });
    if (!r.ok) {
      console.error("[stt]", r.status, await r.text().catch(() => ""));
      return NextResponse.json({ error: r.status === 401 ? "Cloud voice key is invalid." : "Speech recognition failed. Try again." }, { status: 502 });
    }
    const data = (await r.json()) as { text?: string };
    return NextResponse.json({ text: (data.text ?? "").trim() });
  } catch {
    return NextResponse.json({ error: "Could not reach the speech service." }, { status: 503 });
  }
}
