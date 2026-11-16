import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Centralized auth guard for all /dashboard/* routes.
 *
 * We check for the presence of the dtms_token cookie. The cookie itself is
 * httpOnly and its value is unreadable from JS, but Next.js middleware runs
 * on the Edge where it CAN read cookie names/values from the request headers.
 *
 * We do NOT verify the JWT signature here — the backend does that on every
 * request. This middleware only catches the "obviously not logged in" case
 * (no cookie at all) and redirects early, saving a round-trip to the API.
 *
 * Role-based redirects (wrong dashboard for your role) are handled client-side
 * in each dashboard page via AuthContext, since role information requires a
 * verified token decode.
 */
export function middleware(request: NextRequest) {
  const token = request.cookies.get("dtms_token");

  if (!token) {
    const loginUrl = new URL("/login", request.url);
    // Preserve the intended destination so we can redirect back after login
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Only run on /dashboard/** routes — public pages are left untouched.
  matcher: ["/dashboard/:path*"],
};
