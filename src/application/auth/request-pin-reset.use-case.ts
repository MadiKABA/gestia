import { validatePhoneFormat } from "@/domain/shared/phone";
import { validateEmailFormat } from "@/domain/auth/email";
import {
  OTP_EXPIRY_MS,
  OTP_LENGTH,
  OTP_REQUEST_WINDOW_MS,
  assertOtpRequestAllowed,
  type OtpChannel,
} from "@/domain/auth/otp";
import { generateOtpCode } from "@/application/auth/generate-otp-code";
import type { AuthRepository } from "@/application/auth/auth.repository";
import type { OtpSender } from "@/application/auth/otp-sender";
import type { Hasher } from "@/application/auth/hasher";

export async function requestPinReset(
  deps: { repository: AuthRepository; otpSender: OtpSender; hasher: Hasher },
  input: { channel: OtpChannel; identifier: string },
) {
  if (input.channel === "EMAIL") {
    validateEmailFormat(input.identifier);
  } else {
    validatePhoneFormat(input.identifier);
  }

  const user =
    input.channel === "EMAIL"
      ? await deps.repository.findUserByEmail(input.identifier)
      : await deps.repository.findUserByPhone(input.identifier);
  if (!user) {
    // Ne révèle jamais si un compte existe pour cet identifiant (énumération
    // de compte) : retourne silencieusement, comme un succès — aucun OTP créé,
    // aucun SMS/email envoyé. Le message affiché à l'utilisateur reste
    // générique quel que soit le cas, voir requestPinResetAction.
    return;
  }

  const recentRequests = await deps.repository.findRecentOtpRequestTimestamps(
    input.identifier,
    "PIN_RESET",
    new Date(Date.now() - OTP_REQUEST_WINDOW_MS),
  );
  assertOtpRequestAllowed(recentRequests);

  const code = generateOtpCode(OTP_LENGTH);
  await deps.repository.createOtp({
    identifier: input.identifier,
    channel: input.channel,
    codeHash: await deps.hasher.hash(code),
    purpose: "PIN_RESET",
    expiresAt: new Date(Date.now() + OTP_EXPIRY_MS),
  });

  await deps.otpSender.sendOtp(input.identifier, code);
}
