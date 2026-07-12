"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { Button } from "@/presentation/shared/components/ui/button";
import { uploadTenantLogoAction } from "@/presentation/tenant/actions";
import { LOGO_ALLOWED_MIME_TYPES, LOGO_MAX_SIZE_BYTES } from "@/domain/tenant-settings/logo-file";
import { commonLabels, tenantSettingsLabels } from "@/presentation/shared/labels";

export function LogoUploadForm({ logoUrl: initialLogoUrl }: { logoUrl: string | null }) {
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl);
  const [error, setError] = useState<string | null>(null);
  const [uploading, startUpload] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function onFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setError(null);
    // Validation immédiate côté client, avant tout appel réseau — la
    // validation faisant foi reste côté serveur (validateLogoFile).
    if (!(LOGO_ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)) {
      setError("Format d'image non supporté (PNG, JPEG ou WEBP uniquement)");
      return;
    }
    if (file.size > LOGO_MAX_SIZE_BYTES) {
      setError("Le logo ne doit pas dépasser 2 Mo");
      return;
    }

    const formData = new FormData();
    formData.set("logo", file);
    startUpload(async () => {
      try {
        const updated = await uploadTenantLogoAction(formData);
        setLogoUrl(updated.logoUrl);
      } catch (err) {
        setError(err instanceof Error ? err.message : commonLabels.genericError);
      }
    });
  }

  return (
    <div className="space-y-3">
      <h2 className="text-foreground text-sm font-semibold">{tenantSettingsLabels.logoField}</h2>

      <div className="flex items-center gap-4">
        {logoUrl ? (
          <Image
            src={logoUrl}
            alt=""
            width={64}
            height={64}
            className="border-border size-16 rounded-lg border object-contain"
          />
        ) : (
          <div className="border-border bg-muted size-16 rounded-lg border" />
        )}

        <div className="space-y-1.5">
          <input
            ref={inputRef}
            type="file"
            accept={LOGO_ALLOWED_MIME_TYPES.join(",")}
            onChange={onFileSelected}
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading
              ? tenantSettingsLabels.logoUploadingButtonLabel
              : tenantSettingsLabels.logoUploadButtonLabel}
          </Button>
          <p className="text-muted-foreground text-sm">{tenantSettingsLabels.logoHelperText}</p>
        </div>
      </div>

      {error ? <p className="text-destructive text-sm">{error}</p> : null}
    </div>
  );
}
