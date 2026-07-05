/** Implémenté par src/infrastructure/auth/sms-otp-sender.ts (Africa's Talking). */
export interface OtpSender {
  sendOtp(phone: string, code: string): Promise<void>;
}
