import { AuthLayout } from "@/presentation/auth/components/auth-layout";
import { CompleteRegistrationForm } from "@/presentation/auth/components/complete-registration-form";
import { confirmRegistrationAction } from "@/presentation/auth/actions";

export default async function CompleteRegistrationPage({
  searchParams,
}: {
  searchParams: Promise<{ phone?: string }>;
}) {
  const { phone } = await searchParams;

  return (
    <AuthLayout
      heading="Finalisez votre inscription"
      description="Saisissez le code reçu par SMS et définissez votre PIN."
    >
      <CompleteRegistrationForm initialPhone={phone ?? ""} action={confirmRegistrationAction} />
    </AuthLayout>
  );
}
