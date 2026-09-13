import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Set by apps/api on login (see apps/api/src/auth/session.ts) — must match
// SESSION_COOKIE_NAME there.
const SESSION_COOKIE_NAME = "localos_session";

// Named `proxy` (not `middleware`): Next.js 16 renamed the convention —
// same file-based hook, same behavior, just a new file/export name
// (apps/web/src/proxy.ts, replacing the deprecated middleware.ts).
//
// Fast, cheap check: does the cookie exist at all. It does not validate the
// session against the DB (expired/revoked sessions still have a cookie
// present) — that's caught downstream when the dashboard's own data-fetches
// get a 401 from the API and redirect themselves (see lib/api.ts). This
// proxy only exists to avoid rendering the dashboard shell at all for the
// common case of no session.
export function proxy(request: NextRequest) {
  if (!request.cookies.has(SESSION_COOKIE_NAME)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
