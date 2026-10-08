import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { TIER_KEYS } from "@/lib/plans";
import { createAdminClient } from "@/lib/supabase/server";

const body = z.object({
  email: z.email().max(200),
  tier: z.enum(TIER_KEYS),
  billing: z.enum(["monthly", "yearly"]).optional(),
  period_end: z.iso.datetime({ offset: true }).optional(),
});

function authorised(request: NextRequest) {
  const secret = process.env.FLAME_SYNC_SECRET;
  if (!secret || secret.length < 24) return false; // refuse to run with a missing / weak secret
  const given = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * FLAME PH → MarketplacePH membership sync (server to server).
 *   POST /api/flame/membership   Authorization: Bearer <FLAME_SYNC_SECRET>
 *   { "email": "member@example.com", "tier": "micro", "billing": "monthly", "period_end": "2027-01-31T00:00:00+08:00" }
 * Matches the member by account email. Use tier "apprentice" to end a paid membership. Unknown emails get 404 (no account to upgrade yet).
 */
export async function POST(request: NextRequest) {
  if (!authorised(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const { email, tier, billing, period_end } = parsed.data;
  const { data, error } = await createAdminClient().rpc("sync_membership", { p_email: email, p_tier: tier, p_billing: billing, p_period_end: period_end });
  if (error) return NextResponse.json({ error: "failed" }, { status: 500 });
  return data ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "no_account" }, { status: 404 });
}
