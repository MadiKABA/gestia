import { redirect } from "next/navigation";
import { requireTenantContext } from "@/infrastructure/auth/session";
import { ForbiddenError } from "@/domain/shared/errors";
import { PartyForm } from "@/presentation/party/components/party-form";
import { BackLink } from "@/presentation/shared/components/back-link";
import { partyLabels } from "@/presentation/shared/labels";

export default async function NouveauTiersPage() {
  let context;
  try {
    context = await requireTenantContext();
  } catch (error) {
    if (error instanceof ForbiddenError) {
      redirect("/login");
    }
    throw error;
  }

  return (
    <div className="mx-auto w-full max-w-md p-4 lg:max-w-lg">
      <BackLink href="/tiers" />
      <h1 className="text-foreground mt-3 mb-4 text-lg font-semibold">
        {partyLabels.newPageTitle}
      </h1>
      <PartyForm
        mode="create"
        tenantId={context.tenantId}
        userId={context.userId}
        submitLabel={partyLabels.createSubmitLabel}
      />
    </div>
  );
}
