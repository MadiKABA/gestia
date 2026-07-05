import { APIError, createAuthEndpoint } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import type { BetterAuthPlugin, User as BetterAuthUser } from "better-auth";
import * as z from "zod";
import { isLockedOut, nextLockoutState } from "@/domain/auth/pin-policy";
import { Argon2Hasher } from "@/infrastructure/auth/argon2-hasher";

type PinAuthUser = {
  id: string;
  tenantId: string;
  role: "PATRON" | "VENDEUR";
  active: boolean;
  pinHash: string;
  failedAttempts: number;
  lockedUntil: Date | null;
};

/**
 * Plugin better-auth custom : authentification téléphone + PIN (Argon2),
 * verrouillage après 5 tentatives échouées (cahier des charges §4). Ne passe
 * jamais par le provider emailAndPassword — le PIN vit sur User.pinHash
 * (schéma §6), pas dans une table `account` séparée.
 */
export function pinAuthPlugin() {
  const hasher = new Argon2Hasher();

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

          const user = await ctx.context.adapter.findOne<PinAuthUser>({
            model: "user",
            where: [{ field: "phone", value: phone }],
          });

          if (!user || !user.active) {
            throw new APIError("UNAUTHORIZED", { message: "Téléphone ou PIN invalide" });
          }

          if (isLockedOut(user)) {
            throw new APIError("FORBIDDEN", {
              message:
                "Compte temporairement verrouillé après plusieurs échecs. Réessayez plus tard.",
            });
          }

          const validPin = await hasher.verify(user.pinHash, pin);

          if (!validPin) {
            const { failedAttempts, lockedUntil } = nextLockoutState(user);
            await ctx.context.adapter.update({
              model: "user",
              where: [{ field: "id", value: user.id }],
              update: { failedAttempts, lockedUntil },
            });
            throw new APIError("UNAUTHORIZED", { message: "Téléphone ou PIN invalide" });
          }

          if (user.failedAttempts > 0 || user.lockedUntil) {
            await ctx.context.adapter.update({
              model: "user",
              where: [{ field: "id", value: user.id }],
              update: { failedAttempts: 0, lockedUntil: null },
            });
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
