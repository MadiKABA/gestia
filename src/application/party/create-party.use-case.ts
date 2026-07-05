import type { TenantContext } from "@/domain/shared/tenant-context";
import type { PartyInput } from "@/domain/party/party.entity";
import { validatePartyInput } from "@/domain/party/party.entity";
import type { PartyRepository } from "@/application/party/party.repository";
import type { AuditLogger } from "@/application/shared/audit-logger";

export async function createParty(
  context: TenantContext,
  deps: { repository: PartyRepository; auditLogger: AuditLogger },
  input: PartyInput,
) {
  validatePartyInput(input);

  const party = await deps.repository.create(input);

  await deps.auditLogger.log(context, {
    action: "party.created",
    entity: "Party",
    entityId: party.id,
    newData: party,
  });

  return party;
}
