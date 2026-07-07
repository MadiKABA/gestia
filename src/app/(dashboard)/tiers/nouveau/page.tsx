import { redirect } from "next/navigation";
import { requireTenantContext } from "@/infrastructure/auth/session";
import { ForbiddenError } from "@/domain/shared/errors";
import { createPartyAction } from "@/presentation/party/actions";
import { PartyForm } from "@/presentation/party/components/party-form";
import { partyLabels } from "@/presentation/shared/labels";

export default async function NouveauTiersPage() {
  try {
    await requireTenantContext();
  } catch (error) {
    if (error instanceof ForbiddenError) {
      redirect("/login");
    }
    throw error;
  }

  return (
    <div className="mx-auto max-w-md p-4">
      <h1 className="text-foreground mb-4 text-lg font-semibold">{partyLabels.newPageTitle}</h1>
      <PartyForm onSubmit={createPartyAction} submitLabel={partyLabels.createSubmitLabel} />
    </div>
  );
}
