import { handle } from "@/lib/api";
import { retryTurn } from "@/lib/service";

export const maxDuration = 120;
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return handle(async () => ({ reply: (await retryTurn(id)).reply }));
}
