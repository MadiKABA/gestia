import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Vérification optimiste (présence du cookie de session uniquement, pas
 * d'appel DB — cf. doc Next.js 16 sur `proxy`, qui déconseille les I/O lourds
 * ici). L'autorisation réelle (tenantId/role) est vérifiée dans chaque Server
 * Action/page via requireTenantContext() (infrastructure/auth/session.ts).
 */
const AUTH_ROUTE_PREFIXES = ["/login", "/register", "/reset-pin", "/premiere-connexion"];

export function proxy(request: NextRequest) {
  const isAuthRoute = AUTH_ROUTE_PREFIXES.some((prefix) =>
    request.nextUrl.pathname.startsWith(prefix),
  );
  const hasSession = Boolean(getSessionCookie(request));

  if (!hasSession && !isAuthRoute) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (hasSession && isAuthRoute) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|manifest.json|serwist|icons|offline.html).*)",
  ],
};
