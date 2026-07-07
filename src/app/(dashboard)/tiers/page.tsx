import { redirect } from "next/navigation";
import { requireTenantContext } from "@/infrastructure/auth/session";
import { ForbiddenError } from "@/domain/shared/errors";
import { searchPartiesAction } from "@/presentation/party/actions";
import { PartiesList } from "@/presentation/party/components/parties-list";

export default async function TiersPage() {
  let context;
  try {
    context = await requireTenantContext();
  } catch (error) {
    if (error instanceof ForbiddenError) {
      redirect("/login");
    }
    throw error;
  }

  const parties = await searchPartiesAction();
  return (
    <PartiesList initialParties={parties} tenantId={context.tenantId} userId={context.userId} />
  );
}
