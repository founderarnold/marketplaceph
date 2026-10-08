import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * Daily job (see vercel.json). Sends due in-app restock reminders and seller follow-ups, and queues SMS for
 * people who opted in. Vercel Cron sends `Authorization: Bearer $CRON_SECRET`; set CRON_SECRET in the project env.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const { data, error } = await createAdminClient().rpc("run_due_reminders");
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, ...(data?.[0] ?? {}) });
}
