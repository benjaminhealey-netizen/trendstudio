import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "./lib/auth/session";

/**
 * Every route is admin-only except the login page, the login API, and the two
 * public surfaces: locally-hosted published sites (/host) and the per-client
 * domain handoff page (/handoff).
 */
const PUBLIC_PREFIXES = ["/login", "/api/auth/login", "/host", "/handoff", "/_next", "/favicon.ico"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  const secret = (process.env.SESSION_SECRET ?? "insecure-dev-secret-change-me").trim();
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value, secret);
  if (session) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
