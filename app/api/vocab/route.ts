import { body, handle } from "@/lib/api";
import { addVocab, listVocab } from "@/lib/service";

export const dynamic = "force-dynamic";
export async function GET() {
  return handle(() => listVocab());
}
export async function POST(req: Request) {
  return handle(async () => {
    const b = await body<{ expression?: string; meaning?: string; example?: string }>(req);
    return addVocab({ expression: String(b.expression ?? ""), meaning: String(b.meaning ?? ""), example: String(b.example ?? "") });
  });
}
