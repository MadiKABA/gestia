import { BrandColorPicker } from "@/presentation/tenant/components/brand-color-picker";
import { LogoUploadForm } from "@/presentation/tenant/components/logo-upload-form";
import { tenantSettingsLabels } from "@/presentation/shared/labels";

export function AppearanceSettingsSection({
  brandColor,
  logoUrl,
}: {
  brandColor: string | null;
  logoUrl: string | null;
}) {
  return (
    <div className="bg-card border-border space-y-4 rounded-xl border p-4 shadow-xs">
      <h2 className="text-foreground text-sm font-semibold">
        {tenantSettingsLabels.appearanceSectionTitle}
      </h2>
      <div className="space-y-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-4 lg:space-y-0">
        <BrandColorPicker brandColor={brandColor} />
        <LogoUploadForm logoUrl={logoUrl} />
      </div>
    </div>
  );
}
