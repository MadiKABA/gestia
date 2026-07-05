import type { OtpSender } from "@/application/auth/otp-sender";
import { sendSms } from "@/infrastructure/external/africastalking-client";

export class SmsOtpSender implements OtpSender {
  async sendOtp(phone: string, code: string): Promise<void> {
    await sendSms(phone, `Gestia — votre code de vérification : ${code} (valable 5 minutes)`);
  }
}
