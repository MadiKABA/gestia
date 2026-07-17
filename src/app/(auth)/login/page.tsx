import { headers } from "next/headers";
import Link from "next/link";
import { AuthLayout } from "@/presentation/auth/components/auth-layout";
import { LoginForm } from "@/presentation/auth/components/login-form";
import { loginAction } from "@/presentation/auth/actions";
import { resolveCountryFromAcceptLanguage } from "@/domain/shared/locale-country";

export default async function LoginPage() {
  const defaultCountryCode = resolveCountryFromAcceptLanguage(
    (await headers()).get("accept-language"),
  );

  return (
    <AuthLayout
      heading="Connexion"
      footer={
        <>
          <Link href="/reset-pin" className="text-primary font-medium hover:underline">
            PIN oublié ?
          </Link>
          <span className="mx-2">·</span>
          <Link href="/register" className="text-primary font-medium hover:underline">
            Créer un compte
          </Link>
        </>
      }
    >
      <LoginForm action={loginAction} defaultCountryCode={defaultCountryCode} />
    </AuthLayout>
  );
}
