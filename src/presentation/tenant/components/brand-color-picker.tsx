"use client";

import { useState, useTransition } from "react";
import { BRAND_PRESETS } from "@/config/brand-presets";
import { updateTenantSettingsAction } from "@/presentation/tenant/actions";
import { commonLabels, tenantSettingsLabels } from "@/presentation/shared/labels";

/** Sélection = sauvegarde immédiate, pas de bouton "Enregistrer" séparé :
 * rien à saisir, juste à cliquer sur l'une des couleurs pré-validées
 * (jamais de color picker RGB libre, cahier des charges §5). */
export function BrandColorPicker({ brandColor: initialBrandColor }: { brandColor: string | null }) {
  const [brandColor, setBrandColor] = useState(initialBrandColor);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  function onSelect(value: string) {
    setError(null);
    startSaving(async () => {
      try {
        await updateTenantSettingsAction({ brandColor: value });
        setBrandColor(value);
      } catch (err) {
        setError(err instanceof Error ? err.message : commonLabels.genericError);
      }
    });
  }

  return (
    <div className="bg-card border-border space-y-3 rounded-xl border p-4 shadow-xs">
      <h2 className="text-foreground text-sm font-semibold">
        {tenantSettingsLabels.brandColorField}
      </h2>
      <div className="flex flex-wrap gap-3">
        {BRAND_PRESETS.map((preset) => (
          <button
            key={preset.value}
            type="button"
            aria-label={preset.label}
            aria-pressed={brandColor === preset.value}
            disabled={saving}
            onClick={() => onSelect(preset.value)}
            className="ring-offset-background focus-visible:ring-ring size-9 rounded-full border shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              backgroundColor: preset.value,
              boxShadow:
                brandColor === preset.value
                  ? "0 0 0 2px var(--background), 0 0 0 4px " + preset.value
                  : undefined,
            }}
          />
        ))}
      </div>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
    </div>
  );
}
