import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetRateLimiter, OTP_REQUEST_IP_RATE_LIMIT } from "@/infrastructure/shared/rate-limiter";

/**
 * Régression pour le gap d'audit "épuisement du crédit SMS via numéros
 * arbitraires" : le rate limiting déjà existant (`assertOtpRequestAllowed`)
 * filtre uniquement par numéro cible — un attaquant changeant de numéro à
 * chaque appel n'était jamais bloqué. Ce test vérifie la limite
 * complémentaire par IP, toutes cibles confondues.
 *
 * `SmsOtpSender`/`EmailOtpSender` mockés (sinon un vrai SMS/email serait
 * envoyé à chaque appel réussi) — même choix que les autres tests
 * d'intégration qui exercent les Server Actions directement
 * (sync-rate-limit.test.ts). `next/headers` mocké pour contrôler l'IP
 * simulée (même origine tout du long, cible différente à chaque appel).
 */
const sendOtpMock = vi.fn().mockResolvedValue(undefined);

vi.mock("@/infrastructure/auth/sms-otp-sender", () => ({
  SmsOtpSender: class {
    sendOtp = sendOtpMock;
  },
}));

vi.mock("@/infrastructure/auth/email-otp-sender", () => ({
  EmailOtpSender: class {
    sendOtp = sendOtpMock;
  },
}));

let fakeIp = "203.0.113.1";
vi.mock("next/headers", () => ({
  headers: async () => ({ get: (name: string) => (name === "x-forwarded-for" ? fakeIp : null) }),
}));

// Base horodatée (même convention que auth.use-cases.test.ts) pour éviter
// toute collision avec un numéro déjà existant en base — ce use case ne crée
// jamais de User (seulement un OtpCode), mais `findUserByPhone` doit trouver
// zéro résultat pour que chaque appel de la boucle passe la vérification
// "numéro déjà associé à un compte" et exerce réellement le rate limiting.
const PHONE_TEST_BASE = Date.now().toString().slice(-6);
function fakePhone(n: number): string {
  return `+22176${PHONE_TEST_BASE}${String(n).padStart(3, "0")}`;
}

describe("Rate limiting par IP sur les demandes d'OTP", () => {
  beforeEach(() => {
    resetRateLimiter();
    sendOtpMock.mockClear();
    fakeIp = "203.0.113.1";
  });

  afterEach(() => {
    resetRateLimiter();
  });

  // Timeout relevé : chaque itération hache réellement l'OTP en Argon2
  // (volontairement lent/memory-hard) en plus d'un aller-retour Postgres —
  // 20+ itérations dépassent le timeout par défaut de vitest (5s) sous
  // charge (suite complète), sans que ce soit un signe de lenteur du rate
  // limiting lui-même (pur, en mémoire).
  it("bloque au-delà de la limite par IP même avec un numéro différent à chaque appel", async () => {
    const { requestRegistrationOtpAction } = await import("@/presentation/auth/actions");

    for (let i = 0; i < OTP_REQUEST_IP_RATE_LIMIT.limit; i++) {
      const result = await requestRegistrationOtpAction({ phone: fakePhone(i) });
      expect(result).toEqual({ success: true });
    }

    // Un numéro encore jamais utilisé — le filtre par numéro cible seul
    // laisserait passer, seule la limite par IP doit bloquer ici.
    const limited = await requestRegistrationOtpAction({
      phone: fakePhone(OTP_REQUEST_IP_RATE_LIMIT.limit + 1),
    });
    expect(limited.success).toBe(false);
    expect(sendOtpMock).toHaveBeenCalledTimes(OTP_REQUEST_IP_RATE_LIMIT.limit);
  }, 30_000);

  it("requestRegistrationOtpAction et requestPinResetAction partagent le même compteur par IP", async () => {
    const { requestRegistrationOtpAction, requestPinResetAction } =
      await import("@/presentation/auth/actions");

    // Offsets dédiés à ce test — chaque test du fichier doit utiliser des
    // numéros jamais sollicités par un autre test, sinon le cooldown 60s par
    // numéro cible (assertOtpRequestAllowed, indépendant de ce qu'on teste
    // ici) interférerait avec le résultat attendu.
    const half = Math.floor(OTP_REQUEST_IP_RATE_LIMIT.limit / 2);
    for (let i = 0; i < half; i++) {
      expect(await requestRegistrationOtpAction({ phone: fakePhone(200 + i) })).toEqual({
        success: true,
      });
    }
    for (let i = 0; i < OTP_REQUEST_IP_RATE_LIMIT.limit - half; i++) {
      const result = await requestPinResetAction({
        channel: "PHONE",
        identifier: fakePhone(300 + i),
      });
      // Ce numéro n'existe pas forcément en base — l'erreur métier
      // ("Aucun compte associé") est acceptable ici, seul compte le fait que
      // ce ne soit jamais le message de rate limiting avant d'avoir atteint
      // la limite globale.
      expect(result.success === false ? result.error : "success").not.toBe(
        "Trop de demandes depuis cette connexion. Réessayez plus tard.",
      );
    }

    const limited = await requestRegistrationOtpAction({ phone: fakePhone(400) });
    expect(limited).toEqual({
      success: false,
      error: "Trop de demandes depuis cette connexion. Réessayez plus tard.",
    });
  }, 30_000);

  it("une IP différente n'est pas affectée par la limite atteinte sur une autre IP", async () => {
    const { requestRegistrationOtpAction } = await import("@/presentation/auth/actions");

    for (let i = 0; i < OTP_REQUEST_IP_RATE_LIMIT.limit; i++) {
      await requestRegistrationOtpAction({ phone: fakePhone(500 + i) });
    }
    const limitedSameIp = await requestRegistrationOtpAction({ phone: fakePhone(600) });
    expect(limitedSameIp.success).toBe(false);

    fakeIp = "198.51.100.7";
    const otherIp = await requestRegistrationOtpAction({ phone: fakePhone(601) });
    expect(otherIp).toEqual({ success: true });
  }, 30_000);
});
