import type { QueuedMutation } from "@/application/offline/mutation-handler";
import type { SyncTransport } from "@/infrastructure/offline/sync-engine";

export type OnlineAttemptResult =
  | { status: "success"; updatedAt: string }
  | { status: "validation_error"; message: string }
  | { status: "dependency_not_found"; message: string }
  | { status: "transient_error" };

/**
 * Tente une mutation directement contre le serveur (app en ligne au moment
 * de l'action) via le même transport que le moteur de sync différée
 * (sync-engine.ts:SyncTransport) — donc le même chemin serveur au bout
 * (syncMutationAction -> syncMutation -> MutationHandler -> use case
 * applicatif, ex. registerPayment), jamais une deuxième source de vérité
 * sur les règles métier entre "en ligne direct" et "sync différée".
 *
 * Interprète le résultat en 3 issues distinctes pour l'appelant (voir
 * *-offline.repository.ts) :
 * - "success" : mutation appliquée côté serveur — l'appelant écrit son
 *   cache local avec `updatedAt` (la valeur serveur, jamais un timestamp
 *   client), sans jamais passer par mutationQueue.
 * - "validation_error" : erreur de validation métier définitive (mêmes
 *   règles que la validation locale déjà appliquée dans le domaine, mais
 *   faisant foi côté serveur contre l'état réel, pas un cache local
 *   potentiellement périmé) — à remonter immédiatement au formulaire
 *   appelant, jamais mise en queue ni retentée.
 * - "dependency_not_found" : la mutation référence une autre entité
 *   introuvable côté serveur (ex. `partyId`). Contrairement au moteur de
 *   sync différée (sync-engine.ts, qui peut reporter en fin de cycle pour
 *   laisser la dépendance se synchroniser elle-même), une tentative en
 *   ligne directe est déjà séquentielle et complète avant la suivante : il
 *   n'y a pas d'autre mutation "juste avant" qui pourrait encore résoudre
 *   cette dépendance. Traité comme "validation_error" par l'appelant
 *   (rejet immédiat, jamais mis en queue) — voir *-offline.repository.ts.
 * - "transient_error" : tout le reste (réseau, session expirée, rate
 *   limit, bug serveur — un rejet de promesse comme un `{ok:false}` non
 *   "validation_error"/"dependency_not_found") — l'appelant doit se replier
 *   sur le chemin hors ligne déjà existant (écriture optimiste +
 *   enqueueMutation) pour ne jamais perdre la saisie, exactement comme si
 *   l'app avait été hors ligne dès le départ.
 */
export async function attemptOnlineMutation(
  syncTransport: SyncTransport,
  mutation: QueuedMutation,
): Promise<OnlineAttemptResult> {
  try {
    const outcome = await syncTransport(mutation);
    if (!outcome.ok) {
      if (outcome.reason === "validation_error") {
        return { status: "validation_error", message: outcome.message };
      }
      if (outcome.reason === "dependency_not_found") {
        return { status: "dependency_not_found", message: outcome.message };
      }
      return { status: "transient_error" };
    }
    return { status: "success", updatedAt: outcome.data.updatedAt };
  } catch {
    return { status: "transient_error" };
  }
}
