import { headers } from "next/headers";
import { auth } from "@/infrastructure/auth/better-auth";
import { ForbiddenError } from "@/domain/shared/errors";
import type { TenantContext } from "@/domain/shared/tenant-context";

type SessionUser = {
  id: string;
  tenantId: string;
  role: "PATRON" | "VENDEUR";
};

/**
 * Point d'entrée unique pour dériver le TenantContext de la session côté
 * serveur (Server Actions, Route Handlers, proxy). Ne jamais faire confiance
 * à un tenantId/role fourni par le client — toujours passer par ici.
 */
export async function getTenantContext(): Promise<TenantContext | null> {
  const result = await auth.api.getSession({ headers: await headers() });
  if (!result) return null;

  const user = result.user as unknown as SessionUser;
  return { tenantId: user.tenantId, userId: user.id, role: user.role };
}

export async function requireTenantContext(): Promise<TenantContext> {
  const context = await getTenantContext();
  if (!context) {
    throw new ForbiddenError("Authentification requise");
  }
  return context;
}
