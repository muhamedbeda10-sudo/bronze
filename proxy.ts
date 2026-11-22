import { NextResponse, type NextRequest } from "next/server";

// An optimistic gate (no database here): no session cookie means straight
// to sign-in. The real check is on the server, on every page and action.
const OPEN = ["/login", "/signup"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (OPEN.includes(pathname)) return NextResponse.next();
  if (!request.cookies.get("lb_session")?.value) return NextResponse.redirect(new URL("/login", request.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/|icon.svg|favicon.ico|robots.txt).*)"],
};
