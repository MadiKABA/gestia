"use server";

import { requireTenantContext } from "@/infrastructure/auth/session";
import {
  syncMutation,
  type SyncMutationResult,
} from "@/application/offline/sync-mutation.use-case";
import { pullChanges, type PullChangesResult } from "@/application/offline/pull-changes.use-case";
import type { SyncActionResult } from "@/application/offline/sync-result";
import type { QueuedMutation } from "@/application/offline/mutation-handler";
import { PrismaAuditLogger } from "@/infrastructure/audit-log/audit-log.repository";
import { registerPartySync } from "@/infrastructure/party/register-party-sync";
import { registerTransactionSync } from "@/infrastructure/transaction/register-transaction-sync";
import { registerPaymentSync } from "@/infrastructure/payment/register-payment-sync";
import { registerCashMovementSync } from "@/infrastructure/cash-movement/register-cash-movement-sync";
import { checkRateLimit, SYNC_RATE_LIMIT } from "@/infrastructure/shared/rate-limiter";
import { pullChangesInputSchema, queuedMutationInputSchema } from "@/presentation/offline/schemas";
import { ForbiddenError } from "@/domain/shared/errors";
import type { TenantContext } from "@/domain/shared/tenant-context";

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
registerTransactionSync();
registerPaymentSync();
registerCashMovementSync();

function checkSyncRateLimit(
  context: TenantContext,
): { ok: false; reason: "rate_limited" } | undefined {
  // Après auth, jamais avant : ce rate limiting protège contre un client
  // authentifié buggé en boucle de retry, pas contre un abus anonyme
  // (couvert ailleurs, ex: rate limiting des demandes d'OTP). La clé
  // combine tenant + utilisateur : un vendeur en boucle ne doit pas
  // affecter le quota des autres postes du même tenant.
  const allowed = checkRateLimit(`${context.tenantId}:${context.userId}`, SYNC_RATE_LIMIT);
  return allowed ? undefined : { ok: false, reason: "rate_limited" };
}

/**
 * Point d'entrée générique unique du moteur de sync (cahier des charges §9)
 * — une seule Server Action pour toute entity/action, jamais une par module
 * métier. `mutation.tenantId` n'est jamais fait confiance : le tenant réel
 * vient de la session (`requireTenantContext`), comme partout ailleurs dans
 * l'app — voir ARCHITECTURE.md "Isolation multi-tenant".
 *
 * Retourne une enveloppe {ok,reason} plutôt que de laisser échapper
 * l'erreur pour les cas "session expirée/absente" et "trop d'appels" : les
 * classes d'erreur custom ne survivent pas à la sérialisation d'une Server
 * Action (seul `message` traverse), donc un `instanceof` côté client ne
 * fonctionnerait pas — voir infrastructure/offline/sync-engine.ts. Toute
 * autre erreur (validation, bug serveur, réseau) continue de rejeter
 * normalement, gérée par le backoff générique déjà en place.
 */
export async function syncMutationAction(
  mutation: Omit<QueuedMutation, "tenantId">,
): Promise<SyncActionResult<SyncMutationResult>> {
  const parsed = queuedMutationInputSchema.parse(mutation);

  let context: TenantContext;
  try {
    context = await requireTenantContext();
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, reason: "auth_required" };
    throw error;
  }

  const limited = checkSyncRateLimit(context);
  if (limited) return limited;

  const data = await syncMutation(
    context,
    { auditLogger },
    { ...parsed, tenantId: context.tenantId },
  );
  return { ok: true, data };
}

/**
 * Point d'entrée générique unique du pull (symétrique à syncMutationAction
 * ci-dessus) — `since`/`pageCursor` ne pilotent qu'une fenêtre de lecture,
 * jamais un `tenantId` : celui-ci vient exclusivement de la session, comme
 * partout ailleurs. Même enveloppe {ok,reason} et même raison d'être.
 */
export async function pullChangesAction(input: {
  entity: string;
  since: string;
  pageCursor?: string;
}): Promise<SyncActionResult<PullChangesResult>> {
  const { entity, since, pageCursor } = pullChangesInputSchema.parse(input);

  let context: TenantContext;
  try {
    context = await requireTenantContext();
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, reason: "auth_required" };
    throw error;
  }

  const limited = checkSyncRateLimit(context);
  if (limited) return limited;

  const data = await pullChanges(context, entity, new Date(since), pageCursor);
  return { ok: true, data };
}
