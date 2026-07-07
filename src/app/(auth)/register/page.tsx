import { AuthLayout } from "@/presentation/auth/components/auth-layout";
import { RequestOtpForm } from "@/presentation/auth/components/request-otp-form";
import { requestRegistrationOtpFromIdentifierAction } from "@/presentation/auth/actions";

export default function RegisterPage() {
  return (
    <AuthLayout
      heading="Créer votre compte"
      description="Recevez un code de vérification par SMS pour commencer."
      footer={
        <>
          Déjà un compte ?{" "}
          <a href="/login" className="text-primary font-medium hover:underline">
            Se connecter
          </a>
        </>
      }
    >
      <RequestOtpForm
        action={requestRegistrationOtpFromIdentifierAction}
        nextPathBase="/register/complete"
        submitLabel="Recevoir le code"
      />
    </AuthLayout>
  );
}
