import { ValidationError } from "@/domain/shared/errors";

export type OtpPurpose = "REGISTRATION" | "PIN_RESET";

/** Canal d'envoi/identifiant utilisé pour l'OTP — téléphone reste prioritaire,
 * l'email est un second identifiant possible pour la connexion et le reset PIN. */
export type OtpChannel = "PHONE" | "EMAIL";

export const OTP_LENGTH = 6;
export const OTP_EXPIRY_MS = 5 * 60 * 1000;

export function isOtpExpired(otp: { expiresAt: Date }, now = new Date()): boolean {
  return otp.expiresAt <= now;
}

/** Anti-spam SMS (cahier des charges §8) : un cooldown court entre deux
 * demandes, plafonnées sur une fenêtre glissante plus large. */
export const OTP_REQUEST_COOLDOWN_MS = 60 * 1000;
export const OTP_REQUEST_MAX_PER_WINDOW = 5;
export const OTP_REQUEST_WINDOW_MS = 60 * 60 * 1000;

export function assertOtpRequestAllowed(recentRequestTimestamps: Date[], now = new Date()): void {
  const lastRequest = recentRequestTimestamps.reduce<Date | null>(
    (latest, current) => (latest === null || current > latest ? current : latest),
    null,
  );

  if (lastRequest && now.getTime() - lastRequest.getTime() < OTP_REQUEST_COOLDOWN_MS) {
    throw new ValidationError("Veuillez patienter avant de redemander un code.");
  }

  if (recentRequestTimestamps.length >= OTP_REQUEST_MAX_PER_WINDOW) {
    throw new ValidationError("Trop de demandes de code pour ce numéro. Réessayez plus tard.");
  }
}
