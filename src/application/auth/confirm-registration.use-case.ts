import { validatePhoneFormat } from "@/domain/shared/phone";
import { validateEmailFormat } from "@/domain/auth/email";
import { validatePinFormat } from "@/domain/auth/pin-policy";
import { isOtpAttemptsExceeded, isOtpExpired } from "@/domain/auth/otp";
import { ValidationError } from "@/domain/shared/errors";
import type { AuthRepository } from "@/application/auth/auth.repository";
import type { Hasher } from "@/application/auth/hasher";
import type { AuditLogger } from "@/application/shared/audit-logger";

/**
 * Inscription — étape 2 : vérifie l'OTP puis crée le Tenant + le compte
 * patron avec son PIN (cahier des charges §4). L'email est optionnel et
 * n'est jamais vérifié par OTP à l'inscription — le téléphone reste le seul
 * identifiant prioritaire à cette étape.
 */
export async function confirmRegistration(
  deps: { repository: AuthRepository; hasher: Hasher; auditLogger: AuditLogger },
  input: {
    phone: string;
    otp: string;
    pin: string;
    tenantName: string;
    patronName: string;
    email?: string;
  },
) {
  validatePhoneFormat(input.phone);
  validatePinFormat(input.pin);
  if (input.email) {
    validateEmailFormat(input.email);
    const existingEmail = await deps.repository.findUserByEmail(input.email);
    if (existingEmail) {
      throw new ValidationError("Cet email est déjà associé à un compte");
    }
  }

  const otpRecord = await deps.repository.findActiveOtp(input.phone, "REGISTRATION");
  if (!otpRecord || isOtpExpired(otpRecord)) {
    throw new ValidationError("Code de vérification invalide ou expiré");
  }

  if (!(await deps.hasher.verify(otpRecord.codeHash, input.otp))) {
    const { attempts } = await deps.repository.incrementOtpAttempts(otpRecord.id);
    if (isOtpAttemptsExceeded(attempts)) {
      await deps.repository.consumeOtp(otpRecord.id);
    }
    throw new ValidationError("Code de vérification invalide ou expiré");
  }

  const consumed = await deps.repository.consumeOtp(otpRecord.id);
  if (!consumed) {
    // Déjà consommé par une confirmation concurrente avec le même code —
    // n'applique surtout pas une seconde fois la création du tenant.
    throw new ValidationError("Code de vérification invalide ou expiré");
  }

  const user = await deps.repository.createTenantWithPatron({
    tenantName: input.tenantName,
    patronName: input.patronName,
    phone: input.phone,
    pinHash: await deps.hasher.hash(input.pin),
    email: input.email,
  });

  await deps.auditLogger.log(
    { tenantId: user.tenantId, userId: user.id, role: "PATRON" },
    { action: "auth.tenant_registered", entity: "User", entityId: user.id },
  );

  return user;
}
