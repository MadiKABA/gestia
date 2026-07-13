import { PHASE_PRODUCTION_BUILD } from "next/constants";
import { z } from "zod";

/**
 * Validation Zod des variables d'environnement, exécutée à l'import de ce module
 * (donc au démarrage réel de l'app — dev, ou `next start` en prod). Toute variable
 * manquante ou mal formée fait échouer le démarrage immédiatement plutôt qu'en
 * pleine requête.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  // Base de données (Postgres natif en local, Docker uniquement en prod)
  DATABASE_URL: z.url().startsWith("postgresql://"),

  // BetterAuth
  BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET doit faire au moins 32 caractères"),
  BETTER_AUTH_URL: z.url(),
  // Clé de chiffrement des closures de Server Actions, stable entre instances (voir ARCHITECTURE.md)
  NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: z.string().min(32),

  // SMS / OTP (Africa's Talking)
  AFRICASTALKING_ENV: z.enum(["sandbox", "production"]).default("sandbox"),
  AFRICASTALKING_USERNAME: z.string().min(1),
  AFRICASTALKING_API_KEY: z.string().min(1),
  AFRICASTALKING_SENDER_ID: z.string().optional(),

  // Email / OTP (Resend) — second identifiant de connexion optionnel (§4)
  RESEND_API_KEY: z.string().min(1),
  RESEND_FROM_EMAIL: z.email(),

  // Upload logo boutique (Cloudinary)
  CLOUDINARY_CLOUD_NAME: z.string().min(1),
  CLOUDINARY_API_KEY: z.string().min(1),
  CLOUDINARY_API_SECRET: z.string().min(1),

  // Public (exposées au client)
  NEXT_PUBLIC_APP_URL: z.url(),
  NEXT_PUBLIC_APP_NAME: z.string().default("Gestia"),
});

type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  // Next.js exécute une étape de "collecte des données de page" pendant `next build`
  // qui importe les modules de route (dont /api/auth/[...all]) pour analyse statique —
  // ce module est alors chargé transitivement avant que la plateforme d'hébergement
  // (déploiement Node natif sans Docker, ex. Render) ne garantisse les variables
  // d'environnement à cette étape précise, même si elles sont bien présentes au
  // démarrage réel du serveur. Next positionne `NEXT_PHASE=phase-production-build`
  // uniquement pendant cette commande : on saute la validation *seulement* alors,
  // jamais en dev ni au runtime réel (`next start`), qui restent fail-fast.
  if (process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD) {
    return process.env as unknown as Env;
  }

  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error(
      "❌ Variables d'environnement invalides :\n",
      z.flattenError(parsed.error).fieldErrors,
    );
    throw new Error("Configuration d'environnement invalide — voir .env.example");
  }

  return parsed.data;
}

export const env = loadEnv();
