import { handle } from "@/lib/api";
import { getSession } from "@/lib/service";

export const dynamic = "force-dynamic";
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return handle(async () => {
    const { context: _context, ...s } = await getSession(id);
    return s;
  });
}
