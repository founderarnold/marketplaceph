import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";

/** OAuth (Google) redirect target: exchanges the code for a session cookie. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));
  let detail = searchParams.get("error_description") ?? searchParams.get("error") ?? "";
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
    detail = error.message;
  } else if (!detail) {
    detail = "no code returned";
  }
  console.error("auth/callback failed:", detail);
  return NextResponse.redirect(`${origin}/login?error=oauth&detail=${encodeURIComponent(detail.slice(0, 160))}`);
}
