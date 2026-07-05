import { isLockedOut, nextLockoutState } from "@/domain/auth/pin-policy";
import { ForbiddenError, ValidationError } from "@/domain/shared/errors";
import type { AuthRepository, AuthUser } from "@/application/auth/auth.repository";
import type { Hasher } from "@/application/auth/hasher";
import type { AuditLogger } from "@/application/shared/audit-logger";

/**
 * Vérifie téléphone + PIN et applique le verrouillage après échecs répétés
 * (cahier des charges §4). Ne crée pas la session : c'est la seule étape que
 * seul better-auth peut faire (cookie signé), laissée à
 * infrastructure/auth/pin-auth.plugin.ts qui appelle ce use case pour la
 * décision métier puis émet la session sur succès.
 *
 * Aucune entrée AuditLog n'est écrite quand le compte n'existe pas : le
 * schéma AuditLog exige un tenantId/userId (§6), donc une tentative sur un
 * numéro inconnu n'a pas d'entité à laquelle rattacher la trace.
 */
export async function login(
  deps: { repository: AuthRepository; hasher: Hasher; auditLogger: AuditLogger },
  input: { phone: string; pin: string },
): Promise<AuthUser> {
  const user = await deps.repository.findUserByPhone(input.phone);
  if (!user || !user.active) {
    throw new ValidationError("Téléphone ou PIN invalide");
  }

  if (isLockedOut(user)) {
    throw new ForbiddenError(
      "Compte temporairement verrouillé après plusieurs échecs. Réessayez plus tard.",
    );
  }

  const validPin = await deps.hasher.verify(user.pinHash, input.pin);

  if (!validPin) {
    const { failedAttempts, lockedUntil } = nextLockoutState(user);
    await deps.repository.recordFailedLogin(user.id, { failedAttempts, lockedUntil });
    await deps.auditLogger.log(
      { tenantId: user.tenantId, userId: user.id, role: user.role },
      { action: "auth.login_failed", entity: "User", entityId: user.id },
    );
    throw new ValidationError("Téléphone ou PIN invalide");
  }

  if (user.failedAttempts > 0 || user.lockedUntil) {
    await deps.repository.clearLockout(user.id);
  }

  await deps.auditLogger.log(
    { tenantId: user.tenantId, userId: user.id, role: user.role },
    { action: "auth.login_success", entity: "User", entityId: user.id },
  );

  return user;
}
