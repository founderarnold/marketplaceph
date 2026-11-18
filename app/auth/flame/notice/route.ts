import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { verifyHubMessage } from "@/lib/flame-sso";
import { FLAME_BADGE_TAG } from "@/lib/flame-badge";

/**
 * flameph.org tells us to drop badges now (a member turned consent 3 off, or the badge switch was turned off).
 * Signed with this site's key. Dropping all cached badges is simplest and always safe: they are fetched again.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { token?: unknown } | null;
  const c = typeof body?.token === "string" ? verifyHubMessage("hub-notice", body.token) : null;
  if (!c || c.what !== "badge-drop") return NextResponse.json({ error: "bad_request" }, { status: 401 });
  revalidateTag(FLAME_BADGE_TAG, { expire: 0 });
  return NextResponse.json({ ok: true });
}
