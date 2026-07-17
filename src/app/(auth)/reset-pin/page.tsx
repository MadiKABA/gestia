import { headers } from "next/headers";
import { AuthLayout } from "@/presentation/auth/components/auth-layout";
import { RequestOtpForm } from "@/presentation/auth/components/request-otp-form";
import { requestPinResetAction } from "@/presentation/auth/actions";
import { resolveCountryFromAcceptLanguage } from "@/domain/shared/locale-country";

export default async function ResetPinPage({
  searchParams,
}: {
  searchParams: Promise<{ phone?: string }>;
}) {
  // `phone` : arrivée possible depuis /premiere-connexion en cas de code
  // expiré (voir le lien "Code expiré ?" de cette page) — évite au vendeur
  // de ressaisir un numéro déjà fourni une fois.
  const { phone } = await searchParams;
  const defaultCountryCode = resolveCountryFromAcceptLanguage(
    (await headers()).get("accept-language"),
  );

  return (
    <AuthLayout
      heading="PIN oublié"
      description="Recevez un code par SMS ou email pour définir un nouveau PIN."
    >
      <RequestOtpForm
        action={requestPinResetAction}
        nextPathBase="/reset-pin/confirm"
        submitLabel="Recevoir le code"
        allowEmail
        initialIdentifier={phone ?? ""}
        defaultCountryCode={defaultCountryCode}
      />
    </AuthLayout>
  );
}
