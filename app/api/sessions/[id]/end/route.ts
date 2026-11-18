import { handle } from "@/lib/api";
import { endSession } from "@/lib/service";

export const maxDuration = 180;
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return handle(async () => {
    const s = await endSession(id);
    return { report: s.report };
  });
}
