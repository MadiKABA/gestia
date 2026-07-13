"use client";

import { tenantSettingsLabels } from "@/presentation/shared/labels";

/**
 * Badges cliquables listant les variables disponibles pour un gabarit
 * WhatsApp donné — insère `{token}` dans le textarea associé au clic (voir
 * `onInsert`, câblé par l'appelant sur la position du curseur).
 */
export function WhatsappVariableBadges({
  tokens,
  onInsert,
}: {
  tokens: string[];
  onInsert: (token: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-muted-foreground text-sm">
        {tenantSettingsLabels.whatsappVariablesHelperLabel}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {tokens.map((token) => (
          <button
            key={token}
            type="button"
            onClick={() => onInsert(token)}
            title={tenantSettingsLabels.whatsappVariableDescriptions[token]}
            className="bg-muted hover:bg-muted/80 text-foreground border-border rounded-full border px-2.5 py-1 text-xs font-medium transition-colors"
          >
            {`{${token}}`}
          </button>
        ))}
      </div>
    </div>
  );
}
