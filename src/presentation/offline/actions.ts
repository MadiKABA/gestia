"use server";

import { requireTenantContext } from "@/infrastructure/auth/session";
import {
  syncMutation,
  type SyncMutationResult,
} from "@/application/offline/sync-mutation.use-case";
import type { QueuedMutation } from "@/application/offline/mutation-handler";
import { PrismaAuditLogger } from "@/infrastructure/audit-log/audit-log.repository";

const auditLogger = new PrismaAuditLogger();

/**
 * Point d'entrée générique unique du moteur de sync (cahier des charges §9)
 * — une seule Server Action pour toute entity/action, jamais une par module
 * métier. `mutation.tenantId` n'est jamais fait confiance : le tenant réel
 * vient de la session (`requireTenantContext`), comme partout ailleurs dans
 * l'app — voir ARCHITECTURE.md "Isolation multi-tenant".
 */
export async function syncMutationAction(
  mutation: Omit<QueuedMutation, "tenantId">,
): Promise<SyncMutationResult> {
  const context = await requireTenantContext();
  return syncMutation(context, { auditLogger }, { ...mutation, tenantId: context.tenantId });
}
