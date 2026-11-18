import { handle, tzFrom } from "@/lib/api";
import { getDashboard } from "@/lib/service";

export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  return handle(() => getDashboard(tzFrom(req)));
}
