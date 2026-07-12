import type { TenantSettingsFull } from "@/application/tenant/tenant-settings.repository";
import { GeneralSettingsForm } from "@/presentation/tenant/components/general-settings-form";
import { RelanceSettingsForm } from "@/presentation/tenant/components/relance-settings-form";
import { tenantSettingsLabels } from "@/presentation/shared/labels";

/** Sections empilées, chacune avec son propre bouton "Enregistrer" —
 * sauvegarde granulaire par section, cohérente avec le fait que
 * updateTenantSettingsAction n'envoie que le sous-ensemble modifié. */
export function ParametresPanel({ initialSettings }: { initialSettings: TenantSettingsFull }) {
  return (
    <div className="mx-auto w-full max-w-md space-y-4 p-4 md:max-w-2xl">
      <h1 className="text-foreground text-lg font-semibold">{tenantSettingsLabels.pageTitle}</h1>

      <GeneralSettingsForm
        displayName={initialSettings.displayName}
        currency={initialSettings.currency}
      />

      <RelanceSettingsForm
        reminderDays={initialSettings.reminderDays}
        whatsappTemplate={initialSettings.whatsappTemplate}
      />
    </div>
  );
}
