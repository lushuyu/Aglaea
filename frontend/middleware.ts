import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Admin auth middleware.
 * Checks for the session cookie on all /admin routes.
 * The cookie is HttpOnly so we can only check its presence, not its value.
 * Actual session validation happens in the backend.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/admin")) {
    const session = request.cookies.get("aglaea_session");
    if (!session) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
