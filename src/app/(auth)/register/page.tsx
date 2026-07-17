import { headers } from "next/headers";
import Link from "next/link";
import { AuthLayout } from "@/presentation/auth/components/auth-layout";
import { RequestOtpForm } from "@/presentation/auth/components/request-otp-form";
import { requestRegistrationOtpFromIdentifierAction } from "@/presentation/auth/actions";
import { resolveCountryFromAcceptLanguage } from "@/domain/shared/locale-country";

export default async function RegisterPage() {
  const defaultCountryCode = resolveCountryFromAcceptLanguage(
    (await headers()).get("accept-language"),
  );

  return (
    <AuthLayout
      heading="Créer votre compte"
      description="Recevez un code de vérification par SMS pour commencer."
      footer={
        <>
          Déjà un compte ?{" "}
          <Link href="/login" className="text-primary font-medium hover:underline">
            Se connecter
          </Link>
        </>
      }
    >
      <RequestOtpForm
        action={requestRegistrationOtpFromIdentifierAction}
        nextPathBase="/register/complete"
        submitLabel="Recevoir le code"
        defaultCountryCode={defaultCountryCode}
      />
    </AuthLayout>
  );
}
