import { AuthLayout } from "@/presentation/auth/components/auth-layout";
import { RequestOtpForm } from "@/presentation/auth/components/request-otp-form";
import { requestPinResetAction } from "@/presentation/auth/actions";

export default function ResetPinPage() {
  return (
    <AuthLayout
      heading="PIN oublié"
      description="Recevez un code par SMS pour définir un nouveau PIN."
    >
      <RequestOtpForm
        action={requestPinResetAction}
        nextPathBase="/reset-pin/confirm"
        submitLabel="Recevoir le code"
      />
    </AuthLayout>
  );
}
