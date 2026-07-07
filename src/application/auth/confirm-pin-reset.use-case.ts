import { validatePhoneFormat } from "@/domain/auth/phone";
import { validateEmailFormat } from "@/domain/auth/email";
import { isOtpExpired, type OtpChannel } from "@/domain/auth/otp";
import { validatePinFormat } from "@/domain/auth/pin-policy";
import { ValidationError } from "@/domain/shared/errors";
import type { AuthRepository } from "@/application/auth/auth.repository";
import type { Hasher } from "@/application/auth/hasher";
import type { AuditLogger } from "@/application/shared/audit-logger";

/**
 * Réinitialisation de PIN (mot de passe oublié) et définition du premier PIN
 * d'un vendeur invité utilisent le même flux (cahier des charges §4). Le
 * vendeur invité passe toujours par le canal téléphone (seul canal utilisé à
 * l'invitation) ; un patron/vendeur avec un email peut choisir ce canal ici.
 */
export async function confirmPinReset(
  deps: { repository: AuthRepository; hasher: Hasher; auditLogger: AuditLogger },
  input: { channel: OtpChannel; identifier: string; otp: string; newPin: string },
) {
  if (input.channel === "EMAIL") {
    validateEmailFormat(input.identifier);
  } else {
    validatePhoneFormat(input.identifier);
  }
  validatePinFormat(input.newPin);

  const user =
    input.channel === "EMAIL"
      ? await deps.repository.findUserByEmail(input.identifier)
      : await deps.repository.findUserByPhone(input.identifier);
  if (!user) {
    throw new ValidationError("Aucun compte associé à cet identifiant");
  }

  const otpRecord = await deps.repository.findActiveOtp(input.identifier, "PIN_RESET");
  if (!otpRecord || isOtpExpired(otpRecord) || otpRecord.consumedAt) {
    throw new ValidationError("Code de vérification invalide ou expiré");
  }
  if (!(await deps.hasher.verify(otpRecord.codeHash, input.otp))) {
    throw new ValidationError("Code de vérification invalide ou expiré");
  }

  await deps.repository.updatePinHash(user.id, await deps.hasher.hash(input.newPin));
  await deps.repository.consumeOtp(otpRecord.id);

  await deps.auditLogger.log(
    { tenantId: user.tenantId, userId: user.id, role: user.role },
    { action: "auth.pin_reset", entity: "User", entityId: user.id },
  );
}
