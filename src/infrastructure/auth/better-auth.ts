import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "@/infrastructure/prisma/client";
import { pinAuthPlugin } from "@/infrastructure/auth/pin-auth.plugin";
import { env } from "@/lib/env";

/**
 * BetterAuth ne gère ici QUE la session (cookie, CSRF, expiration) — la
 * vérification du PIN est entièrement custom (voir pin-auth.plugin.ts) car
 * le cahier des charges impose pinHash sur User (§6), incompatible avec le
 * modèle credential/account standard de better-auth. emailAndPassword et les
 * providers OAuth sont désactivés : aucune méthode de connexion autre que
 * téléphone + PIN (§4).
 */
function createAuth() {
  return betterAuth({
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    database: prismaAdapter(prisma, { provider: "postgresql" }),
    emailAndPassword: { enabled: false },
    user: {
      modelName: "user",
      additionalFields: {
        tenantId: { type: "string", required: true, input: false },
        role: { type: ["PATRON", "VENDEUR"], required: true, input: false },
        phone: { type: "string", required: true, input: false },
        pinHash: { type: "string", required: true, input: false },
        failedAttempts: { type: "number", required: false, defaultValue: 0, input: false },
        lockedUntil: { type: "date", required: false, input: false },
        active: { type: "boolean", required: false, defaultValue: true, input: false },
      },
    },
    session: {
      // Expiration après inactivité (cahier des charges §9) : une session non
      // renouvelée (updateAge) expire après 8h ; le renouvellement se fait au
      // plus toutes les 30 min d'activité.
      expiresIn: 60 * 60 * 8,
      updateAge: 60 * 30,
    },
    // nextCookies() doit rester le dernier plugin : c'est lui qui reporte les
    // en-têtes Set-Cookie émis par les endpoints (dont /sign-in/pin) vers la
    // réponse Next.js quand ils sont appelés via auth.api depuis une Server
    // Action — sans lui, le cookie de session est silencieusement perdu.
    plugins: [pinAuthPlugin(), nextCookies()],
  });
}

let authInstance: ReturnType<typeof createAuth> | undefined;

/**
 * Construction paresseuse : betterAuth() valide `secret`/`baseURL` dès sa
 * construction et throw si absents. Un export top-level serait construit à
 * l'import du module, donc aussi pendant la collecte de données de page de
 * `next build` (qui importe /api/auth/[...all] pour analyse statique) — avant
 * que les variables d'environnement ne soient garanties disponibles sur une
 * plateforme comme Render. En ne construisant qu'au premier appel réel
 * (une requête, jamais déclenchée pendant le build), on évite ce crash sans
 * affaiblir la validation au runtime réel.
 */
export function getAuth() {
  if (!authInstance) {
    authInstance = createAuth();
  }
  return authInstance;
}
