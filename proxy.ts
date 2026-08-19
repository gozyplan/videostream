import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const hostname =
    request.headers.get("host")?.split(":")[0].toLowerCase() || "";

  const pathname = request.nextUrl.pathname;

  // ============================================================
  // HDLINK DOMAIN
  // hdlink.fun / www.hdlink.fun
  // ============================================================

  const isHDLink =
    hostname === "hdlink.fun" ||
    hostname === "www.hdlink.fun";

  if (isHDLink) {
    // Only change the HOME page.
    // /auth, /premium, /api etc. remain available normally.
    if (pathname === "/") {
      const url = request.nextUrl.clone();

      url.pathname = "/hdlink";

      return NextResponse.rewrite(url);
    }
  }

  // ============================================================
  // GOZY DOMAIN
  // gozy.in / www.gozy.in
  // ============================================================

  const isGozy =
    hostname === "gozy.in" ||
    hostname === "www.gozy.in";

  if (isGozy) {
    // Gozy homepage stays app/page.tsx
    if (pathname === "/") {
      const url = request.nextUrl.clone();

      url.pathname = "/";

      return NextResponse.next();
    }
  }

  // ============================================================
  // DEFAULT
  // ============================================================

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Run Proxy for normal pages.
     * API, Next static files and images don't need domain routing.
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};