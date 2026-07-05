/**
 * Contexte d'exécution obligatoire pour toute opération métier : identifie le
 * tenant (isolation stricte) et l'utilisateur à l'origine de l'action (traçabilité
 * AuditLog). Chaque use case de src/application reçoit ce contexte en premier
 * argument — jamais un tenantId "nu" passé à la main.
 */
export type TenantContext = {
  tenantId: string;
  userId: string;
  role: "PATRON" | "VENDEUR";
};
