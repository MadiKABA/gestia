import { validatePhoneFormat } from "@/domain/auth/phone";
import { OTP_EXPIRY_MS, OTP_LENGTH } from "@/domain/auth/otp";
import { generateOtpCode } from "@/application/auth/generate-otp-code";
import type { AuthRepository } from "@/application/auth/auth.repository";
import type { OtpSender } from "@/application/auth/otp-sender";
import type { Hasher } from "@/application/auth/hasher";
import { ValidationError } from "@/domain/shared/errors";

/** Inscription — étape 1 : envoie un OTP au futur patron (cahier des charges §4). */
export async function requestRegistrationOtp(
  deps: { repository: AuthRepository; otpSender: OtpSender; hasher: Hasher },
  input: { phone: string },
) {
  validatePhoneFormat(input.phone);

  const existing = await deps.repository.findUserByPhone(input.phone);
  if (existing) {
    throw new ValidationError("Ce numéro est déjà associé à un compte");
  }

  const code = generateOtpCode(OTP_LENGTH);
  await deps.repository.createOtp({
    phone: input.phone,
    codeHash: await deps.hasher.hash(code),
    purpose: "REGISTRATION",
    expiresAt: new Date(Date.now() + OTP_EXPIRY_MS),
  });

  await deps.otpSender.sendOtp(input.phone, code);
}
