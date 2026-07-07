import { notFound, redirect } from "next/navigation";
import { requireTenantContext } from "@/infrastructure/auth/session";
import { ForbiddenError, NotFoundError } from "@/domain/shared/errors";
import { getPartyByIdAction, updatePartyAction } from "@/presentation/party/actions";
import { PartyForm } from "@/presentation/party/components/party-form";
import type { PartyFormInput } from "@/presentation/party/schemas";

export default async function ModifierTierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    await requireTenantContext();
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

  async function onSubmit(input: PartyFormInput) {
    "use server";
    return updatePartyAction(id, input);
  }

  return (
    <div className="mx-auto max-w-md p-4">
      <h1 className="text-foreground mb-4 text-lg font-semibold">Modifier le tiers</h1>
      <PartyForm
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
        onSubmit={onSubmit}
        submitLabel="Enregistrer les modifications"
      />
    </div>
  );
}
