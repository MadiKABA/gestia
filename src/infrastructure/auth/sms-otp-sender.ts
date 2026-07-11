import type { OtpSender } from "@/application/auth/otp-sender";
import { sendSms } from "@/infrastructure/external/africastalking-client";
import { buildPremiereConnexionLink } from "@/domain/auth/premiere-connexion-link";
import { env } from "@/lib/env";

export class SmsOtpSender implements OtpSender {
  async sendOtp(
    phone: string,
    code: string,
    options?: { isVendeurInvitation?: boolean },
  ): Promise<void> {
    // Message dédié à l'invitation : caractères volontairement limités au
    // jeu GSM-7 de base (ni tiret cadratin, ni accent) pour rester dans le
    // budget d'un SMS simple segment (160 caractères) même avec le lien
    // complet — un seul caractère hors GSM-7 (ex. le "—" du message
    // générique ci-dessous) fait basculer tout le SMS en UCS-2, où le budget
    // tombe à 70 caractères et le lien seul suffirait à forcer un envoi en
    // plusieurs segments.
    const message = options?.isVendeurInvitation
      ? `Gestia : code ${code}. Definissez votre PIN : ${buildPremiereConnexionLink(env.NEXT_PUBLIC_APP_URL, phone)}`
      : `Gestia — votre code de vérification : ${code} (valable 5 minutes)`;

    await sendSms(phone, message);
  }
}
