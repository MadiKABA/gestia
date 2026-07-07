import { notFound, redirect } from "next/navigation";
import { requireTenantContext } from "@/infrastructure/auth/session";
import { ForbiddenError, NotFoundError } from "@/domain/shared/errors";
import { getPartyByIdAction } from "@/presentation/party/actions";
import { PartyDetail } from "@/presentation/party/components/party-detail";

export default async function TierDetailPage({ params }: { params: Promise<{ id: string }> }) {
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

  let detail: Awaited<ReturnType<typeof getPartyByIdAction>>;
  try {
    detail = await getPartyByIdAction(id);
  } catch (error) {
    if (error instanceof NotFoundError) {
      notFound();
    }
    throw error;
  }

  return (
    <PartyDetail
      party={{ ...detail.party, balance: detail.balance }}
      tenantId={context.tenantId}
      userId={context.userId}
      canDelete={context.role === "PATRON"}
    />
  );
}
