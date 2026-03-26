import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

// Rollen-Hierarchie (muss mit auth.ts übereinstimmen)
const ROLE_HIERARCHY: Record<string, number> = {
  ADMIN: 100,
  ORGA: 50,
  SCHIEDSRICHTER: 20,
  HELFER: 10,
};

// Route → Minimale Rolle
const PROTECTED_ROUTES: Array<{ path: string; minRole: string }> = [
  { path: "/admin/users", minRole: "ADMIN" },    // User-Management nur für Admin
  { path: "/admin", minRole: "ORGA" },            // Admin-Panel für Orga+
  { path: "/referee", minRole: "SCHIEDSRICHTER" }, // Referee für Schiedsrichter+
];

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const pathname = req.nextUrl.pathname;

    if (!token) {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    const userRole = (token.rolle as string) || "";
    const userLevel = ROLE_HIERARCHY[userRole];

    // Unbekannte oder fehlende Rolle → kein Zugang
    if (userLevel === undefined) {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    // Finde die passende Route-Regel (spezifischere Pfade zuerst)
    for (const route of PROTECTED_ROUTES) {
      if (pathname.startsWith(route.path)) {
        const requiredLevel = ROLE_HIERARCHY[route.minRole] ?? Infinity;
        if (userLevel < requiredLevel) {
          // Keine Berechtigung → zurück zur Startseite
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
