import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { requireTenantContext } from "@/infrastructure/auth/session";
import { getTenantBrandingAction } from "@/presentation/tenant/actions";
import { getCurrentUserAction } from "@/presentation/auth/actions";
import { AppShell } from "@/presentation/layout/components/app-shell";
import { ForbiddenError } from "@/domain/shared/errors";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  let role: "PATRON" | "VENDEUR";
  let tenantId: string;
  let userId: string;
  try {
    ({ role, tenantId, userId } = await requireTenantContext());
  } catch (error) {
    if (error instanceof ForbiddenError) {
      redirect("/login");
    }
    throw error;
  }

  const [branding, currentUser] = await Promise.all([
    getTenantBrandingAction(),
    getCurrentUserAction(),
  ]);

  return (
    <AppShell
      role={role}
      branding={branding}
      currentUser={currentUser}
      tenantId={tenantId}
      userId={userId}
    >
      {children}
    </AppShell>
  );
}
