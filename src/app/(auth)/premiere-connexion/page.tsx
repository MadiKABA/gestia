import { AuthLayout } from "@/presentation/auth/components/auth-layout";
import { OtpPinForm } from "@/presentation/auth/components/otp-pin-form";
import { confirmPinResetAction } from "@/presentation/auth/actions";
import { authLabels } from "@/presentation/shared/labels";

/**
 * Premier accès d'un vendeur invité : le patron a déjà déclenché l'envoi de
 * l'OTP au moment de l'invitation (cahier des charges §4), donc pas de bouton
 * "recevoir un code" ici — juste la saisie du code déjà reçu et du PIN. Le
 * lien "Code expiré ?" en pied de page (code valable 5 minutes, voir
 * otp.ts:OTP_EXPIRY_MS) est la seule issue si le vendeur ouvre ce lien trop
 * tard : sans lui, l'erreur "Code de vérification invalide ou expiré"
 * renvoyée par confirmPinReset serait une impasse — /reset-pin fonctionne
 * déjà pour renvoyer un nouveau code via le même use case.
 */
export default async function PremiereConnexionPage({
  searchParams,
}: {
  searchParams: Promise<{ phone?: string }>;
}) {
  const { phone } = await searchParams;

  return (
    <AuthLayout
      heading="Bienvenue sur Gestia"
      description="Votre patron vous a invité. Saisissez le code reçu par SMS et choisissez votre PIN."
      footer={
        <a
          href={`/reset-pin${phone ? `?phone=${encodeURIComponent(phone)}` : ""}`}
          className="text-primary font-medium hover:underline"
        >
          {authLabels.premiereConnexionExpiredLinkLabel}
        </a>
      }
    >
      <OtpPinForm
        initialIdentifier={phone ?? ""}
        action={confirmPinResetAction}
        redirectTo="/login"
        submitLabel="Définir mon PIN"
      />
    </AuthLayout>
  );
}
