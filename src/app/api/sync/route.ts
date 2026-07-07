import { z } from "zod";
import { requireTenantContext } from "@/infrastructure/auth/session";
import { syncMutation } from "@/application/offline/sync-mutation.use-case";
import { pullChanges } from "@/application/offline/pull-changes.use-case";
import { PrismaAuditLogger } from "@/infrastructure/audit-log/audit-log.repository";
import { registerPartySync } from "@/infrastructure/party/register-party-sync";
import { pullChangesInputSchema, queuedMutationInputSchema } from "@/presentation/offline/schemas";
import { ForbiddenError } from "@/domain/shared/errors";

// Même précaution que presentation/offline/actions.ts : enregistré dans ce
// module précisément (pas seulement instrumentation.ts), qui bundle dans un
// graphe séparé en production — voir le commentaire détaillé là-bas.
registerPartySync();

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
    const result = await syncMutation(
      context,
      { auditLogger },
      { ...body.mutation, tenantId: context.tenantId },
    );
    return Response.json(result);
  }

  const result = await pullChanges(context, body.entity, new Date(body.since), body.pageCursor);
  return Response.json(result);
}
