import { AuthLayout } from "@/presentation/auth/components/auth-layout";
import { OtpPinForm } from "@/presentation/auth/components/otp-pin-form";
import { confirmPinResetAction } from "@/presentation/auth/actions";

export default async function ConfirmPinResetPage({
  searchParams,
}: {
  searchParams: Promise<{ channel?: string; identifier?: string }>;
}) {
  const { channel, identifier } = await searchParams;

  return (
    <AuthLayout
      heading="Nouveau code PIN"
      description="Saisissez le code reçu et votre nouveau PIN."
    >
      <OtpPinForm
        initialIdentifier={identifier ?? ""}
        channel={channel === "EMAIL" ? "EMAIL" : "PHONE"}
        action={confirmPinResetAction}
        redirectTo="/login"
        submitLabel="Valider"
      />
    </AuthLayout>
  );
}
