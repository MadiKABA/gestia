import { AuthLayout } from "@/presentation/auth/components/auth-layout";
import { OtpPinForm } from "@/presentation/auth/components/otp-pin-form";
import { confirmPinResetAction } from "@/presentation/auth/actions";

/**
 * Premier accès d'un vendeur invité : le patron a déjà déclenché l'envoi de
 * l'OTP au moment de l'invitation (cahier des charges §4), donc pas de bouton
 * "recevoir un code" ici — juste la saisie du code déjà reçu et du PIN.
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
