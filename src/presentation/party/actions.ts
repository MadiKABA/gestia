"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireTenantContext } from "@/infrastructure/auth/session";
import { createParty } from "@/application/party/create-party.use-case";
import { updateParty } from "@/application/party/update-party.use-case";
import { searchParties } from "@/application/party/search-parties.use-case";
import { getPartyById } from "@/application/party/get-party-by-id.use-case";
import { deleteParty } from "@/application/party/delete-party.use-case";
import type { PartyInput } from "@/domain/party/party.entity";
import { PrismaPartyRepository } from "@/infrastructure/party/party.repository";
import { PrismaAuditLogger } from "@/infrastructure/audit-log/audit-log.repository";
import {
  partyInputSchema,
  partySearchSchema,
  type PartyFormInput,
  type PartySearchInput,
} from "@/presentation/party/schemas";

const auditLogger = new PrismaAuditLogger();

/** Les champs texte optionnels du formulaire arrivent en chaîne vide plutôt
 * qu'`undefined` (contrôle React) — normalisés en `null` pour le domain. */
function toPartyInput(input: PartyFormInput): PartyInput {
  return {
    name: input.name,
    phone: input.phone || null,
    whatsappNumber: input.whatsappNumber || null,
    type: input.type,
    isCompany: input.isCompany,
    companyName: input.companyName || null,
    contactName: input.contactName || null,
    note: input.note || null,
  };
}

export async function createPartyAction(input: PartyFormInput) {
  const context = await requireTenantContext();
  const repository = new PrismaPartyRepository(context.tenantId);

  const party = await createParty(
    context,
    { repository, auditLogger },
    toPartyInput(partyInputSchema.parse(input)),
  );
  revalidatePath("/tiers");
  redirect(`/tiers/${party.id}`);
}

export async function updatePartyAction(id: string, input: PartyFormInput) {
  const context = await requireTenantContext();
  const repository = new PrismaPartyRepository(context.tenantId);

  await updateParty(
    context,
    { repository, auditLogger },
    id,
    toPartyInput(partyInputSchema.parse(input)),
  );
  revalidatePath("/tiers");
  revalidatePath(`/tiers/${id}`);
  redirect(`/tiers/${id}`);
}

export async function deletePartyAction(id: string) {
  const context = await requireTenantContext();
  const repository = new PrismaPartyRepository(context.tenantId);

  await deleteParty(context, { repository, auditLogger }, id);
  revalidatePath("/tiers");
}

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
