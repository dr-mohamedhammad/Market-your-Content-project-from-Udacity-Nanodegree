import { body, handle } from "@/lib/api";
import { getProfile, updateProfile } from "@/lib/service";

export const dynamic = "force-dynamic";
export async function GET() {
  return handle(() => getProfile());
}
export async function PATCH(req: Request) {
  return handle(async () => {
    const b = await body<{ name?: string; interests?: string[]; dailyGoalMinutes?: number; tutorNotes?: string[] }>(req);
    const patch: Parameters<typeof updateProfile>[0] = {};
    if (typeof b.name === "string") patch.name = b.name;
    if (Array.isArray(b.interests)) patch.interests = b.interests;
    if (b.dailyGoalMinutes != null) patch.dailyGoalMinutes = Number(b.dailyGoalMinutes);
    if (Array.isArray(b.tutorNotes)) patch.tutorNotes = b.tutorNotes;
    return updateProfile(patch);
  });
}
