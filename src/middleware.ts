import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import { ROLE_HIERARCHY } from "./lib/roles";

const PROTECTED_ROUTES: Array<{ path: string; minRole: string }> = [
  { path: "/admin/users", minRole: "ADMIN" },
  { path: "/admin", minRole: "ORGA" },
  { path: "/referee", minRole: "SCHIEDSRICHTER" },
].sort((a, b) => b.path.length - a.path.length);

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const pathname = req.nextUrl.pathname;

    if (!token) {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    const userRole = (token.rolle as string) || "";
    const userLevel = ROLE_HIERARCHY[userRole];

    if (userLevel === undefined) {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    for (const route of PROTECTED_ROUTES) {
      if (pathname.startsWith(route.path)) {
        const requiredLevel = ROLE_HIERARCHY[route.minRole] ?? Infinity;
        if (userLevel < requiredLevel) {
          return NextResponse.redirect(new URL("/", req.url));
        }
        break;
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: ["/admin/:path*", "/referee/:path*"],
};
