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
// Égalité stricte (pas préfixe) : seul l'écran d'accueil lui-même est
// public, pas question d'exempter accidentellement une sous-route par ce
// biais. La landing détecte elle-même une session valide et redirige vers
// /dashboard (voir app/page.tsx) — ce garde-fou ne fait que la laisser
// passer pour un visiteur sans session, plutôt que la court-circuiter en
// forçant /login avant même son premier rendu.
const PUBLIC_ROUTES = ["/"];

export function proxy(request: NextRequest) {
  const isAuthRoute = AUTH_ROUTE_PREFIXES.some((prefix) =>
    request.nextUrl.pathname.startsWith(prefix),
  );
  const isPublicRoute = PUBLIC_ROUTES.includes(request.nextUrl.pathname);
  const hasSession = Boolean(getSessionCookie(request));

  if (!hasSession && !isAuthRoute && !isPublicRoute) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (hasSession && isAuthRoute) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|manifest.json|serwist|icons|offline.html).*)",
  ],
};
