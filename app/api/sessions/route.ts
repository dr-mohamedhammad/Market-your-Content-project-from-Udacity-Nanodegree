import { body, handle, tzFrom } from "@/lib/api";
import { listSessionSummaries, startSession, type StartOptions } from "@/lib/service";
import type { Mode, Topic } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET() {
  return handle(() => listSessionSummaries());
}

const MODES: Mode[] = ["free", "roleplay", "intensive"];
const KINDS: StartOptions["kind"][] = ["daily", "surprise", "custom", "revisit", "library"];

export async function POST(req: Request) {
  return handle(async () => {
    const b = await body<{ kind?: string; mode?: string; topic?: Topic; revisitOf?: string; lessonId?: string }>(req);
    const kind = KINDS.includes(b.kind as StartOptions["kind"]) ? (b.kind as StartOptions["kind"]) : "daily";
    const mode = MODES.includes(b.mode as Mode) ? (b.mode as Mode) : undefined;
    const s = await startSession({ kind, mode, topic: b.topic, revisitOf: b.revisitOf, lessonId: typeof b.lessonId === "string" ? b.lessonId : undefined, tz: tzFrom(req) });
    return { id: s.id };
  });
}
