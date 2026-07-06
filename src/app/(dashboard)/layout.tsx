import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { requireTenantContext } from "@/infrastructure/auth/session";
import { getTenantBrandingAction } from "@/presentation/tenant/actions";
import { AppShell } from "@/presentation/layout/components/app-shell";
import { ForbiddenError } from "@/domain/shared/errors";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  let role: "PATRON" | "VENDEUR";
  try {
    ({ role } = await requireTenantContext());
  } catch (error) {
    if (error instanceof ForbiddenError) {
      redirect("/login");
    }
    throw error;
  }

  const branding = await getTenantBrandingAction();

  return (
    <AppShell role={role} branding={branding}>
      {children}
    </AppShell>
  );
}
