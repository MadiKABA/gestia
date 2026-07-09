import { registerMutationHandler } from "@/application/offline/mutation-handler-registry";
import { registerMutationSchema } from "@/application/offline/mutation-schema-registry";
import { registerPullHandler } from "@/application/offline/pull-handler-registry";
import { cashMovementMutationHandler } from "@/infrastructure/cash-movement/cash-movement-mutation-handler";
import { cashMovementSyncPayloadSchema } from "@/infrastructure/cash-movement/cash-movement-mutation.schema";
import { cashMovementPullHandler } from "@/infrastructure/cash-movement/cash-movement-pull-handler";

/** Branche l'entity "cashMovement" sur les moteurs de sync génériques (push
 * et pull) — même contrat que register-payment-sync.ts. Doit être appelé
 * depuis les 4 points d'entrée dès sa construction (instrumentation.ts,
 * presentation/offline/actions.ts, app/api/sync/route.ts,
 * register-pullable-entities.ts) : instrumentation.ts seul ne suffit pas en
 * production (voir le commentaire détaillé dans actions.ts — incident déjà
 * vécu pour party puis payment). */
export function registerCashMovementSync(): void {
  registerMutationHandler("cashMovement", cashMovementMutationHandler);
  registerMutationSchema("cashMovement", cashMovementSyncPayloadSchema);
  registerPullHandler("cashMovement", cashMovementPullHandler);
}
