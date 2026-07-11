/** Implémenté par src/infrastructure/auth/sms-otp-sender.ts (Africa's Talking)
 * et src/infrastructure/auth/email-otp-sender.ts (Resend). */
export interface OtpSender {
  /**
   * `options.isVendeurInvitation` : seul invite-vendeur.use-case.ts le passe
   * à `true` — signale à l'implémentation SMS d'inclure le lien direct vers
   * /premiere-connexion (voir sms-otp-sender.ts et
   * domain/auth/premiere-connexion-link.ts), en plus du code. Sans effet sur
   * les autres flux (inscription, réinitialisation de PIN "mot de passe
   * oublié"), qui gardent le message générique.
   */
  sendOtp(phone: string, code: string, options?: { isVendeurInvitation?: boolean }): Promise<void>;
}
