import { NotFoundError } from "@/domain/shared/errors";
import type { TenantContext } from "@/domain/shared/tenant-context";
import type { AuthRepository } from "@/application/auth/auth.repository";

export type CurrentUser = {
  name: string;
  phone: string;
  email: string | null;
  image: string | null;
  role: "PATRON" | "VENDEUR";
};

/** Identité de l'utilisateur connecté (header, page profil) — lecture
 * seule, aucune mutation donc pas d'entrée AuditLog. */
export async function getCurrentUser(
  context: TenantContext,
  deps: { repository: AuthRepository },
): Promise<CurrentUser> {
  const user = await deps.repository.findUserById(context.userId);
  if (!user) throw new NotFoundError("Utilisateur", context.userId);

  return {
    name: user.name,
    phone: user.phone,
    email: user.email,
    image: user.image,
    role: user.role,
  };
}
