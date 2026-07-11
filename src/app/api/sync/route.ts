import { z } from "zod";
import { requireTenantContext } from "@/infrastructure/auth/session";
import { syncMutation } from "@/application/offline/sync-mutation.use-case";
import { pullChanges } from "@/application/offline/pull-changes.use-case";
import { PrismaAuditLogger } from "@/infrastructure/audit-log/audit-log.repository";
import { registerPartySync } from "@/infrastructure/party/register-party-sync";
import { registerTransactionSync } from "@/infrastructure/transaction/register-transaction-sync";
import { registerPaymentSync } from "@/infrastructure/payment/register-payment-sync";
import { registerCashMovementSync } from "@/infrastructure/cash-movement/register-cash-movement-sync";
import { pullChangesInputSchema, queuedMutationInputSchema } from "@/presentation/offline/schemas";
import { ForbiddenError, ValidationError } from "@/domain/shared/errors";
import { checkRateLimit, SYNC_RATE_LIMIT } from "@/infrastructure/shared/rate-limiter";

// Même précaution que presentation/offline/actions.ts : enregistré dans ce
// module précisément (pas seulement instrumentation.ts), qui bundle dans un
// graphe séparé en production — voir le commentaire détaillé là-bas.
registerPartySync();
registerTransactionSync();
registerPaymentSync();
registerCashMovementSync();

const auditLogger = new PrismaAuditLogger();

const syncRouteInputSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("push"), mutation: queuedMutationInputSchema }),
  z.object({ kind: z.literal("pull"), ...pullChangesInputSchema.shape }),
]);

/**
 * Point d'entrée HTTP simple (fetch, pas de Server Action) — seul appelant
 * prévu : le service worker lors d'un événement `sync` (Background Sync
 * API, voir src/app/sw.ts), hors du contexte d'exécution d'une page où
 * l'encodage RPC interne des Server Actions Next.js n'est pas exploitable
 * de façon fiable depuis ce contexte. Délègue aux mêmes use cases que
 * syncMutationAction/pullChangesAction (presentation/offline/actions.ts) :
 * aucune règle métier dupliquée, seul le mécanisme de transport diffère.
 *
 * Authentification : cookie de session transmis par le SW via
 * `fetch(..., { credentials: "include" })` (même origine, voir sw.ts) —
 * requireTenantContext() revalide la session exactement comme pour une
 * Server Action, jamais de confiance dans un tenantId transmis par le corps
 * de la requête.
 */
export async function POST(request: Request): Promise<Response> {
  let context;
  try {
    context = await requireTenantContext();
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return Response.json({ error: error.message }, { status: 401 });
    }
    throw error;
  }

  // Même compteur que syncMutationAction/pullChangesAction (clé identique
  // tenant+utilisateur) : un client buggé qui bascule entre Server Action et
  // ce endpoint ne doit pas doubler son quota effectif.
  if (!checkRateLimit(`${context.tenantId}:${context.userId}`, SYNC_RATE_LIMIT)) {
    return Response.json({ error: "Trop de requêtes" }, { status: 429 });
  }

  let body: z.infer<typeof syncRouteInputSchema>;
  try {
    body = syncRouteInputSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: "Requête invalide" }, { status: 400 });
    }
    throw error;
  }

  if (body.kind === "push") {
    try {
      const result = await syncMutation(
        context,
        { auditLogger },
        { ...body.mutation, tenantId: context.tenantId },
      );
      return Response.json(result);
    } catch (error) {
      // Même distinction que syncMutationAction (presentation/offline/actions.ts) :
      // 422 dédié plutôt qu'un 500 générique, pour que le transport SW
      // (sw.ts:pushMutationFromServiceWorker) puisse la reconnaître comme
      // définitive plutôt que de la traiter comme un échec transitoire —
      // sans quoi une mutation invalide rejouée via Background Sync
      // retenterait indéfiniment, exactement le bug corrigé côté Server
      // Action.
      if (error instanceof ValidationError) {
        return Response.json({ error: error.message, reason: "validation_error" }, { status: 422 });
      }
      throw error;
    }
  }

  const result = await pullChanges(context, body.entity, new Date(body.since), body.pageCursor);
  return Response.json(result);
}
