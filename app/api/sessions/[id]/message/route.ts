import { body, handle } from "@/lib/api";
import { sendMessage } from "@/lib/service";

export const maxDuration = 120;
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return handle(async () => {
    const b = await body<{ text?: string; inputMode?: string }>(req);
    const { reply } = await sendMessage(id, String(b.text ?? ""), b.inputMode === "voice" ? "voice" : "text");
    return { reply };
  });
}
