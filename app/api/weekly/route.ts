import { handle, tzFrom } from "@/lib/api";
import { getWeeklySummary } from "@/lib/service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(req: Request) {
  return handle(() => getWeeklySummary(tzFrom(req)));
}
