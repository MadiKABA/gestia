import { redirect } from "next/navigation";
import { requirePatron } from "@/presentation/auth/require-role";
import { listVendeursAction } from "@/presentation/auth/actions";
import { VendeursPanel } from "@/presentation/auth/components/vendeurs-panel";
import { ForbiddenError } from "@/domain/shared/errors";

export default async function VendeursPage() {
  try {
    await requirePatron();
  } catch (error) {
    if (error instanceof ForbiddenError) {
      redirect("/");
    }
    throw error;
  }

  const vendeurs = await listVendeursAction();
  return <VendeursPanel initialVendeurs={vendeurs} />;
}
