"use server";

import { requireTenantContext } from "@/infrastructure/auth/session";
import {
  syncMutation,
  type SyncMutationResult,
} from "@/application/offline/sync-mutation.use-case";
import { pullChanges, type PullChangesResult } from "@/application/offline/pull-changes.use-case";
import type { QueuedMutation } from "@/application/offline/mutation-handler";
import { PrismaAuditLogger } from "@/infrastructure/audit-log/audit-log.repository";
import { registerPartySync } from "@/infrastructure/party/register-party-sync";
import { pullChangesInputSchema } from "@/presentation/offline/schemas";

const auditLogger = new PrismaAuditLogger();

// Enregistré ici, pas seulement dans src/instrumentation.ts : Next.js bundle
// instrumentation.ts dans un graphe de modules séparé de celui des Server
// Actions, donc le registre (singleton en mémoire, mutation-handler-registry.ts)
// rempli au démarrage par instrumentation.ts n'est PAS le même que celui que
// syncMutation() lit ici — constaté en prod ("Aucun gestionnaire de
// synchronisation pour party"). L'enregistrer directement dans le module qui
// exécute la Server Action garantit qu'il est dans le même graphe.
// registerMutationHandler est idempotent (Map.set), donc sans risque même si
// instrumentation.ts l'appelle aussi de son côté.
registerPartySync();

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

/**
 * Point d'entrée générique unique du pull (symétrique à syncMutationAction
 * ci-dessus) — `since`/`pageCursor` ne pilotent qu'une fenêtre de lecture,
 * jamais un `tenantId` : celui-ci vient exclusivement de la session, comme
 * partout ailleurs.
 */
export async function pullChangesAction(input: {
  entity: string;
  since: string;
  pageCursor?: string;
}): Promise<PullChangesResult> {
  const { entity, since, pageCursor } = pullChangesInputSchema.parse(input);
  const context = await requireTenantContext();
  return pullChanges(context, entity, new Date(since), pageCursor);
}
