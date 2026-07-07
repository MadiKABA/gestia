import { Resend } from "resend";
import type { OtpSender } from "@/application/auth/otp-sender";
import { env } from "@/lib/env";

const resend = new Resend(env.RESEND_API_KEY);

export class EmailOtpSender implements OtpSender {
  async sendOtp(email: string, code: string): Promise<void> {
    const { error } = await resend.emails.send({
      from: env.RESEND_FROM_EMAIL,
      to: email,
      subject: `${code} — votre code de vérification Gestia`,
      text: `Gestia — votre code de vérification : ${code} (valable 5 minutes)`,
    });

    if (error) {
      throw new Error(`Échec de l'envoi de l'email OTP Resend : ${error.message}`);
    }
  }
}
