import { PartyOfflineRepository } from "@/infrastructure/party/party-offline.repository";
import { setCachedEntity } from "@/infrastructure/offline/local-cache.store";
import type { PartyWithBalance } from "@/application/party/party.repository";
import { triggerBackgroundSync } from "@/presentation/shared/hooks/use-network-status";

const ENTITY = "party";

/**
 * Seul endroit qui enveloppe le nudge de sync en dépendance concrète de
 * PartyOfflineRepository — l'infra ne connaît que l'interface
 * `onSyncNeeded`, cette usine (présentation, composition root) fait le
 * branchement, comme une Server Action le fait déjà pour
 * PrismaPartyRepository/PrismaAuditLogger. Le rafraîchissement des lectures
 * ne passe plus par un refetch Server Action dédié à Party (voir
 * party-offline.repository.ts) : `triggerBackgroundSync` déclenche le même
 * cycle de pull générique déjà utilisé après une mutation locale.
 */
export function createPartyOfflineRepository(
  tenantId: string,
  userId: string,
): PartyOfflineRepository {
  return new PartyOfflineRepository({
    tenantId,
    userId,
    onSyncNeeded: () => triggerBackgroundSync(tenantId),
  });
}

/** Amorce le cache local avec les données fraîchement rendues côté serveur
 * (SSR) — pour qu'une prochaine visite hors ligne les retrouve déjà là. */
export async function seedPartyCache(tenantId: string, parties: PartyWithBalance[]): Promise<void> {
  await Promise.all(
    parties.map((party) =>
      setCachedEntity(tenantId, ENTITY, party.id, party, party.updatedAt.toISOString()),
    ),
  );
}
