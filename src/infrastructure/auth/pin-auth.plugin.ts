import { APIError, createAuthEndpoint } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import type { BetterAuthPlugin, User as BetterAuthUser } from "better-auth";
import * as z from "zod";
import { ForbiddenError, ValidationError } from "@/domain/shared/errors";
import { login } from "@/application/auth/login.use-case";
import { Argon2Hasher } from "@/infrastructure/auth/argon2-hasher";
import { PrismaAuthRepository } from "@/infrastructure/auth/auth.repository";
import { PrismaAuditLogger } from "@/infrastructure/audit-log/audit-log.repository";

/**
 * Plugin better-auth custom : authentification téléphone + PIN. La décision
 * métier (vérification Argon2, verrouillage, AuditLog) vit entièrement dans
 * application/auth/login.use-case.ts — ce plugin ne fait que ce que seul
 * better-auth peut faire : émettre la session et poser le cookie signé. Ne
 * passe jamais par le provider emailAndPassword — le PIN vit sur
 * User.pinHash (schéma §6), pas dans une table `account` séparée.
 */
export function pinAuthPlugin() {
  const repository = new PrismaAuthRepository();
  const hasher = new Argon2Hasher();
  const auditLogger = new PrismaAuditLogger();

  return {
    id: "pin-auth",
    endpoints: {
      signInPin: createAuthEndpoint(
        "/sign-in/pin",
        {
          method: "POST",
          body: z.object({ phone: z.string(), pin: z.string() }),
        },
        async (ctx) => {
          const { phone, pin } = ctx.body;

          let user;
          try {
            user = await login({ repository, hasher, auditLogger }, { phone, pin });
          } catch (error) {
            if (error instanceof ForbiddenError) {
              throw new APIError("FORBIDDEN", { message: error.message });
            }
            if (error instanceof ValidationError) {
              throw new APIError("UNAUTHORIZED", { message: error.message });
            }
            throw error;
          }

          const session = await ctx.context.internalAdapter.createSession(user.id);
          if (!session) {
            throw new APIError("INTERNAL_SERVER_ERROR", {
              message: "Échec de création de session",
            });
          }

          // Notre User.email est nullable (cahier des charges §4 : email optionnel),
          // le type User de better-auth attend `string` — sans incidence à l'exécution,
          // setSessionCookie ne fait que sérialiser l'objet dans le cookie/la réponse.
          await setSessionCookie(ctx, { session, user: user as unknown as BetterAuthUser });

          return ctx.json({ user, session });
        },
      ),
    },
  } satisfies BetterAuthPlugin;
}
