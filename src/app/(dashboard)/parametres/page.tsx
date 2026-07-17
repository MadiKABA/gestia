import { redirect } from "next/navigation";
import { requirePatron } from "@/presentation/auth/require-role";
import {
  getTenantSettingsForEditAction,
  getTenantBusinessTypeAction,
} from "@/presentation/tenant/actions";
import { ParametresPanel } from "@/presentation/tenant/components/parametres-panel";
import { ForbiddenError } from "@/domain/shared/errors";

export default async function ParametresPage() {
  try {
    await requirePatron();
  } catch (error) {
    if (error instanceof ForbiddenError) {
      redirect("/");
    }
    throw error;
  }

  const [settings, businessType] = await Promise.all([
    getTenantSettingsForEditAction(),
    getTenantBusinessTypeAction(),
  ]);
  return <ParametresPanel initialSettings={settings} initialBusinessType={businessType} />;
}
