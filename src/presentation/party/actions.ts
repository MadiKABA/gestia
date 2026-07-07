"use server";

import { requireTenantContext } from "@/infrastructure/auth/session";
import { searchParties } from "@/application/party/search-parties.use-case";
import { getPartyById } from "@/application/party/get-party-by-id.use-case";
import { PrismaPartyRepository } from "@/infrastructure/party/party.repository";
import { partySearchSchema, type PartySearchInput } from "@/presentation/party/schemas";

/**
 * Lecture seule : sert de source pour le rendu serveur initial et le
 * rafraîchissement en arrière-plan du cache local (voir
 * infrastructure/party/party-offline.repository.ts). Les écritures
 * (création/modification/suppression) ne passent plus par une Server
 * Action dédiée — un appel réseau ne peut pas être le chemin d'écriture
 * "hors ligne d'abord" : elles passent par PartyOfflineRepository (cache
 * local + queue), synchronisées ensuite par le moteur générique
 * (presentation/offline/actions.ts) qui appelle create/update/deleteParty
 * côté serveur.
 */
export async function searchPartiesAction(input: PartySearchInput = {}) {
  const context = await requireTenantContext();
  const repository = new PrismaPartyRepository(context.tenantId);

  const { search, type } = partySearchSchema.parse(input);
  return searchParties({ repository }, { search, type });
}

export async function getPartyByIdAction(id: string) {
  const context = await requireTenantContext();
  const repository = new PrismaPartyRepository(context.tenantId);

  return getPartyById({ repository }, id);
}
