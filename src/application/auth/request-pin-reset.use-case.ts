import { validatePhoneFormat } from "@/domain/auth/phone";
import { OTP_EXPIRY_MS, OTP_LENGTH } from "@/domain/auth/otp";
import { generateOtpCode } from "@/application/auth/generate-otp-code";
import { ValidationError } from "@/domain/shared/errors";
import type { AuthRepository } from "@/application/auth/auth.repository";
import type { OtpSender } from "@/application/auth/otp-sender";
import type { Hasher } from "@/application/auth/hasher";

export async function requestPinReset(
  deps: { repository: AuthRepository; otpSender: OtpSender; hasher: Hasher },
  input: { phone: string },
) {
  validatePhoneFormat(input.phone);

  const user = await deps.repository.findUserByPhone(input.phone);
  if (!user) {
    throw new ValidationError("Aucun compte associé à ce numéro");
  }

  const code = generateOtpCode(OTP_LENGTH);
  await deps.repository.createOtp({
    phone: input.phone,
    codeHash: await deps.hasher.hash(code),
    purpose: "PIN_RESET",
    expiresAt: new Date(Date.now() + OTP_EXPIRY_MS),
  });

  await deps.otpSender.sendOtp(input.phone, code);
}
