import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const hostname = request.headers.get("host") || "";
  const pathname = request.nextUrl.pathname;

  // Remove port during local development
  const host = hostname.split(":")[0].toLowerCase();

  // ============================================================
  // HDLINK DOMAIN
  // hdlink.fun → /hdlink
  // ============================================================

  if (
    host === "hdlink.fun" ||
    host === "www.hdlink.fun"
  ) {
    // Don't rewrite files, APIs, auth, premium, admin, etc.
    if (
      pathname.startsWith("/_next") ||
      pathname.startsWith("/api") ||
      pathname.startsWith("/auth") ||
      pathname.startsWith("/admin") ||
      pathname.startsWith("/premium") ||
      pathname.startsWith("/hdlink") ||
      pathname.includes(".")
    ) {
      return NextResponse.next();
    }

    // hdlink.fun/ → /hdlink
    return NextResponse.rewrite(
      new URL("/hdlink", request.url)
    );
  }

  // ============================================================
  // GOZY DOMAIN
  // gozy.in → normal website
  // ============================================================

  if (
    host === "gozy.in" ||
    host === "www.gozy.in"
  ) {
    return NextResponse.next();
  }

  // ============================================================
  // VERCEL / OTHER DOMAIN
  // ============================================================

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Run middleware on all routes except
     * Next.js internals and static files.
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};