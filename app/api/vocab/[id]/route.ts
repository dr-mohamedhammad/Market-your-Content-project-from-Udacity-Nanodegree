import { body, handle } from "@/lib/api";
import { deleteVocab, reviewVocabItem } from "@/lib/service";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return handle(async () => {
    const b = await body<{ success?: boolean }>(req);
    return reviewVocabItem(id, !!b.success);
  });
}
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return handle(async () => { await deleteVocab(id); return { ok: true }; });
}
