import { validatePhoneFormat } from "@/domain/auth/phone";
import { validatePinFormat } from "@/domain/auth/pin-policy";
import { isOtpExpired } from "@/domain/auth/otp";
import { ValidationError } from "@/domain/shared/errors";
import type { AuthRepository } from "@/application/auth/auth.repository";
import type { Hasher } from "@/application/auth/hasher";
import type { AuditLogger } from "@/application/shared/audit-logger";

/**
 * Réinitialisation de PIN (mot de passe oublié) et définition du premier PIN
 * d'un vendeur invité utilisent le même flux (cahier des charges §4).
 */
export async function confirmPinReset(
  deps: { repository: AuthRepository; hasher: Hasher; auditLogger: AuditLogger },
  input: { phone: string; otp: string; newPin: string },
) {
  validatePhoneFormat(input.phone);
  validatePinFormat(input.newPin);

  const user = await deps.repository.findUserByPhone(input.phone);
  if (!user) {
    throw new ValidationError("Aucun compte associé à ce numéro");
  }

  const otpRecord = await deps.repository.findActiveOtp(input.phone, "PIN_RESET");
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
