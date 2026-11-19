import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { LINK_COOKIE, SESSION_CHECK_SECONDS, SSO_COOKIE, hostCookie, hubCall, readLink, signLink } from "@/lib/flame-sso";
import { SESSION_ENDED_COOKIE, sessionEndedCookie } from "@/lib/session-ended";

// Routes that need a signed-in user. (Real authorization is enforced by RLS and in server code;
// this is only an optimistic redirect.)
// "/sell" itself is the public seller hub; everything under it needs an account.
const PROTECTED = ["/sell/new", "/sell/edit", "/sell/verify", "/sell/tools", "/sell/website", "/my", "/messages", "/favorites", "/account", "/admin", "/orders", "/notifications", "/cart", "/checkout", "/business", "/export",
  "/jobs/profile", "/jobs/applications", "/jobs/post", "/jobs/employer", "/jobs/messages", "/updates", "/looking-for/new", "/delivery/new", "/delivery/register"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  // Did this browser arrive with a session? If it ends below, the page is told to redraw its header (see SessionSync).
  const hadSession = request.cookies.getAll().some((c) => c.name.startsWith("sb-") && c.name.includes("-auth-token") && !c.name.endsWith("-code-verifier"));
  const ended = <T extends NextResponse>(res: T): T => {
    if (hadSession) res.cookies.set(SESSION_ENDED_COOKIE, "1", sessionEndedCookie);
    return res;
  };

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          for (const { name, value } of list) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of list) response.cookies.set(name, value, options);
        },
      },
    },
  );

  // Refreshes the session cookie when needed.
  const { data } = await supabase.auth.getClaims();
  let signedIn = !!data?.claims;

  const path = request.nextUrl.pathname;

  // Logout everywhere (Phase 10A): a member who signed in with FLAME PH is re-checked with flameph.org every minute.
  // Logged out anywhere, account suspended, or the shared sign-in switched off: the session here ends.
  // If flameph.org can't be reached, the check is simply tried again on the next page.
  const linkValue = request.cookies.get(LINK_COOKIE)?.value;
  if (signedIn && linkValue && request.method === "GET" && !path.startsWith("/auth/")) {
    const link = readLink(linkValue);
    const now = Math.floor(Date.now() / 1000);
    if (!link || link.uid !== data?.claims?.sub) {
      response.cookies.set(LINK_COOKIE, "", { ...hostCookie, maxAge: 0 });
    } else if (now - link.chk > SESSION_CHECK_SECONDS) {
      const status = await hubCall<{ active?: boolean }>("/api/sso/status", "sso-status", { sub: link.sub, since: link.since }, 4000);
      if (status && status.active === false) {
        await supabase.auth.signOut({ scope: "local" });
        signedIn = false;
        const res = NextResponse.redirect(request.nextUrl);
        for (const c of response.cookies.getAll()) res.cookies.set(c);
        res.cookies.set(LINK_COOKIE, "", { ...hostCookie, maxAge: 0 });
        res.cookies.set(SSO_COOKIE, "off", { ...hostCookie, maxAge: 60 * 60 * 24 * 30 });
        return ended(res);
      }
      if (status?.active) {
        const fresh = signLink({ ...link, chk: now });
        if (fresh) response.cookies.set(LINK_COOKIE, fresh, { ...hostCookie, maxAge: 60 * 60 * 24 * 30 });
      }
    }
  }

  // One FLAME PH account: a visitor who isn't signed in here is checked once with flameph.org, which signs them in
  // here if they're signed in there. The cookie stops repeat checks (and stays "off" after they log out).
  if (!signedIn && wantsSsoCheck(request)) {
    // Through /auth/flame/start, which keeps the one-time browser check (Phase 10A).
    const res = NextResponse.redirect(new URL(`/auth/flame/start?silent=1&next=${encodeURIComponent(path + request.nextUrl.search)}`, request.url));
    res.cookies.set("flame_sso", "checked", { maxAge: 60 * 60 * 6, path: "/", sameSite: "lax", secure: true, httpOnly: true });
    return ended(res);
  }

  if (!signedIn && PROTECTED.some((p) => path === p || path.startsWith(p + "/"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(path + request.nextUrl.search)}`;
    return ended(NextResponse.redirect(url));
  }
  return signedIn ? response : ended(response);
}

const BOT = /bot|crawl|spider|slurp|facebookexternalhit|embedly|preview|lighthouse|headless/i;

function wantsSsoCheck(request: NextRequest) {
  const secret = process.env.SSO_SECRET_MARKETPLACEPH || process.env.SSO_SECRET;
  return (
    !!secret && secret.length >= 32 &&
    request.method === "GET" &&
    !request.cookies.has("flame_sso") &&
    (request.headers.get("accept") ?? "").includes("text/html") &&
    !request.headers.has("next-router-prefetch") && !request.headers.has("rsc") &&
    !BOT.test(request.headers.get("user-agent") ?? "") &&
    !/^\/(auth|api|feed|r)\//.test(request.nextUrl.pathname) &&
    request.nextUrl.hostname.endsWith("marketplaceph.com")
  );
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|seed/|brand/|icons/).*)"],
};
