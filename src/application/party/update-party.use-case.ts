import type { TenantContext } from "@/domain/shared/tenant-context";
import type { PartyInput } from "@/domain/party/party.entity";
import { normalizePartyInput, validatePartyInput } from "@/domain/party/party.entity";
import { NotFoundError } from "@/domain/shared/errors";
import type { PartyRepository } from "@/application/party/party.repository";
import type { AuditLogger } from "@/application/shared/audit-logger";

export async function updateParty(
  context: TenantContext,
  deps: { repository: PartyRepository; auditLogger: AuditLogger },
  id: string,
  input: PartyInput,
) {
  validatePartyInput(input);

  const existing = await deps.repository.findById(id);
  if (!existing) {
    throw new NotFoundError("Party", id);
  }

  const updated = await deps.repository.update(id, normalizePartyInput(input));

  await deps.auditLogger.log(context, {
    action: "party.updated",
    entity: "Party",
    entityId: updated.id,
    oldData: existing,
    newData: updated,
  });

  return updated;
}
