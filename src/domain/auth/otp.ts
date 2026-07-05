export type OtpPurpose = "REGISTRATION" | "PIN_RESET";

export const OTP_LENGTH = 6;
export const OTP_EXPIRY_MS = 5 * 60 * 1000;

export function isOtpExpired(otp: { expiresAt: Date }, now = new Date()): boolean {
  return otp.expiresAt <= now;
}
