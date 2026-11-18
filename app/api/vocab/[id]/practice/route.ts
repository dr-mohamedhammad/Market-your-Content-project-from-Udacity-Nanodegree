import { body, handle } from "@/lib/api";
import { practiceVocab } from "@/lib/service";

export const maxDuration = 60;
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return handle(async () => {
    const b = await body<{ sentence?: string }>(req);
    return practiceVocab(id, String(b.sentence ?? ""));
  });
}
