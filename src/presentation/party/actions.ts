"use server";

import { revalidatePath } from "next/cache";
import { requireTenantContext } from "@/infrastructure/auth/session";
import { createParty } from "@/application/party/create-party.use-case";
import { updateParty } from "@/application/party/update-party.use-case";
import { searchParties } from "@/application/party/search-parties.use-case";
import type { PartyInput } from "@/domain/party/party.entity";
import { PrismaPartyRepository } from "@/infrastructure/party/party.repository";
import { PrismaAuditLogger } from "@/infrastructure/audit-log/audit-log.repository";

const auditLogger = new PrismaAuditLogger();

export async function createPartyAction(input: PartyInput) {
  const context = await requireTenantContext();
  const repository = new PrismaPartyRepository(context.tenantId);

  const party = await createParty(context, { repository, auditLogger }, input);
  revalidatePath("/parties");
  return party;
}

export async function updatePartyAction(id: string, input: PartyInput) {
  const context = await requireTenantContext();
  const repository = new PrismaPartyRepository(context.tenantId);

  const party = await updateParty(context, { repository, auditLogger }, id, input);
  revalidatePath("/parties");
  return party;
}

export async function searchPartiesAction(search?: string) {
  const context = await requireTenantContext();
  const repository = new PrismaPartyRepository(context.tenantId);

  return searchParties({ repository }, { search });
}
