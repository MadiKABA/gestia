import { validatePhoneFormat } from "@/domain/shared/phone";
import {
  OTP_EXPIRY_MS,
  OTP_LENGTH,
  OTP_REQUEST_WINDOW_MS,
  assertOtpRequestAllowed,
} from "@/domain/auth/otp";
import { generateOtpCode } from "@/application/auth/generate-otp-code";
import { ValidationError, ForbiddenError } from "@/domain/shared/errors";
import type { TenantContext } from "@/domain/shared/tenant-context";
import type { AuthRepository } from "@/application/auth/auth.repository";
import type { OtpSender } from "@/application/auth/otp-sender";
import type { Hasher } from "@/application/auth/hasher";
import type { AuditLogger } from "@/application/shared/audit-logger";

/**
 * Le patron ajoute un vendeur par téléphone ; celui-ci définit son PIN à sa
 * première connexion via le même flux OTP que la réinitialisation de PIN
 * (cahier des charges §4).
 */
export async function inviteVendeur(
  context: TenantContext,
  deps: {
    repository: AuthRepository;
    otpSender: OtpSender;
    hasher: Hasher;
    auditLogger: AuditLogger;
  },
  input: { name: string; phone: string },
) {
  if (context.role !== "PATRON") {
    throw new ForbiddenError("Seul le patron peut inviter un vendeur");
  }

  validatePhoneFormat(input.phone);

  const existing = await deps.repository.findUserByPhone(input.phone);
  if (existing) {
    throw new ValidationError("Ce numéro est déjà associé à un compte");
  }

  const placeholderPinHash = await deps.hasher.hash(crypto.randomUUID());
  const vendeur = await deps.repository.createVendeur({
    tenantId: context.tenantId,
    name: input.name,
    phone: input.phone,
    placeholderPinHash,
  });

  const recentRequests = await deps.repository.findRecentOtpRequestTimestamps(
    input.phone,
    "PIN_RESET",
    new Date(Date.now() - OTP_REQUEST_WINDOW_MS),
  );
  assertOtpRequestAllowed(recentRequests);

  const code = generateOtpCode(OTP_LENGTH);
  await deps.repository.createOtp({
    identifier: input.phone,
    channel: "PHONE",
    codeHash: await deps.hasher.hash(code),
    purpose: "PIN_RESET",
    expiresAt: new Date(Date.now() + OTP_EXPIRY_MS),
  });

  // Le vendeur et son OTP sont déjà valides à ce stade — une panne de l'envoi
  // SMS (réseau, quota, fournisseur en incident) ne doit pas faire échouer
  // toute l'invitation : ce serait perdre le lien de première connexion
  // affiché ensuite au patron (voir VendeursPanel, "Copier le lien"), alors
  // que c'est précisément le filet de secours prévu pour ce cas. L'échec
  // reste visible côté opérateur via les logs serveur, jamais silencieux au
  // point de masquer un vrai incident fournisseur récurrent.
  try {
    await deps.otpSender.sendOtp(input.phone, code, { isVendeurInvitation: true });
  } catch (error) {
    console.error("Échec de l'envoi du SMS d'invitation vendeur :", error);
  }

  await deps.auditLogger.log(context, {
    action: "auth.vendeur_invited",
    entity: "User",
    entityId: vendeur.id,
    newData: { name: input.name, phone: input.phone },
  });

  return vendeur;
}
