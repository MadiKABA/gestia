import { AuthLayout } from "@/presentation/auth/components/auth-layout";
import { OtpPinForm } from "@/presentation/auth/components/otp-pin-form";
import { confirmPinResetAction } from "@/presentation/auth/actions";

export default async function ConfirmPinResetPage({
  searchParams,
}: {
  searchParams: Promise<{ phone?: string }>;
}) {
  const { phone } = await searchParams;

  return (
    <AuthLayout
      heading="Nouveau code PIN"
      description="Saisissez le code reçu par SMS et votre nouveau PIN."
    >
      <OtpPinForm
        initialPhone={phone ?? ""}
        action={confirmPinResetAction}
        redirectTo="/login"
        submitLabel="Valider"
      />
    </AuthLayout>
  );
}
