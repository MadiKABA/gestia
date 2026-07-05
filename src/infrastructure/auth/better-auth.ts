import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
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
export const auth = betterAuth({
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
  plugins: [pinAuthPlugin()],
});
