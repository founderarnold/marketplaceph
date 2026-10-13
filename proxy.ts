import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Routes that need a signed-in user. (Real authorization is enforced by RLS and in server code;
// this is only an optimistic redirect.)
const PROTECTED = ["/sell", "/my", "/messages", "/favorites", "/account", "/admin", "/orders", "/notifications", "/cart", "/checkout", "/business", "/export"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

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
  const signedIn = !!data?.claims;

  const path = request.nextUrl.pathname;

  // One FLAME PH account: a visitor who isn't signed in here is checked once with flameph.org, which signs them in
  // here if they're signed in there. The cookie stops repeat checks (and stays "off" after they log out).
  if (!signedIn && wantsSsoCheck(request)) {
    const res = NextResponse.redirect(`https://www.flameph.org/sso/authorize?client=marketplaceph&silent=1&return=${encodeURIComponent(request.nextUrl.href)}`);
    res.cookies.set("flame_sso", "checked", { maxAge: 60 * 60 * 6, path: "/", sameSite: "lax", secure: true, httpOnly: true });
    return res;
  }

  if (!signedIn && PROTECTED.some((p) => path === p || path.startsWith(p + "/"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(path + request.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }
  return response;
}

const BOT = /bot|crawl|spider|slurp|facebookexternalhit|embedly|preview|lighthouse|headless/i;

function wantsSsoCheck(request: NextRequest) {
  const secret = process.env.SSO_SECRET;
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
