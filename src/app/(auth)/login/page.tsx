import { AuthLayout } from "@/presentation/auth/components/auth-layout";
import { LoginForm } from "@/presentation/auth/components/login-form";
import { loginAction } from "@/presentation/auth/actions";

export default function LoginPage() {
  return (
    <AuthLayout
      heading="Connexion"
      footer={
        <>
          <a href="/reset-pin" className="text-primary font-medium hover:underline">
            PIN oublié ?
          </a>
          <span className="mx-2">·</span>
          <a href="/register" className="text-primary font-medium hover:underline">
            Créer un compte
          </a>
        </>
      }
    >
      <LoginForm action={loginAction} />
    </AuthLayout>
  );
}
