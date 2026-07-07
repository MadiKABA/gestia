import { notFound, redirect } from "next/navigation";
import { requireTenantContext } from "@/infrastructure/auth/session";
import { ForbiddenError, NotFoundError } from "@/domain/shared/errors";
import { getPartyByIdAction } from "@/presentation/party/actions";
import { PartyForm } from "@/presentation/party/components/party-form";
import { partyLabels } from "@/presentation/shared/labels";

export default async function ModifierTierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let context;
  try {
    context = await requireTenantContext();
  } catch (error) {
    if (error instanceof ForbiddenError) {
      redirect("/login");
    }
    throw error;
  }

  let party;
  try {
    ({ party } = await getPartyByIdAction(id));
  } catch (error) {
    if (error instanceof NotFoundError) {
      notFound();
    }
    throw error;
  }

  return (
    <div className="mx-auto max-w-md p-4">
      <h1 className="text-foreground mb-4 text-lg font-semibold">{partyLabels.editPageTitle}</h1>
      <PartyForm
        mode="edit"
        partyId={id}
        tenantId={context.tenantId}
        userId={context.userId}
        defaultValues={{
          name: party.name,
          phone: party.phone ?? "",
          whatsappNumber: party.whatsappNumber ?? "",
          type: party.type,
          isCompany: party.isCompany,
          companyName: party.companyName ?? "",
          contactName: party.contactName ?? "",
          note: party.note ?? "",
        }}
        submitLabel={partyLabels.editSubmitLabel}
      />
    </div>
  );
}
