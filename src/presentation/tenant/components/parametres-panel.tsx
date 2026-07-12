import type { TenantSettingsFull } from "@/application/tenant/tenant-settings.repository";
import { GeneralSettingsForm } from "@/presentation/tenant/components/general-settings-form";
import { RelanceSettingsForm } from "@/presentation/tenant/components/relance-settings-form";
import { BrandColorPicker } from "@/presentation/tenant/components/brand-color-picker";
import { LogoUploadForm } from "@/presentation/tenant/components/logo-upload-form";
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

      <div className="space-y-3">
        <h2 className="text-foreground text-sm font-semibold">
          {tenantSettingsLabels.appearanceSectionTitle}
        </h2>
        <BrandColorPicker brandColor={initialSettings.brandColor} />
        <LogoUploadForm logoUrl={initialSettings.logoUrl} />
      </div>
    </div>
  );
}
