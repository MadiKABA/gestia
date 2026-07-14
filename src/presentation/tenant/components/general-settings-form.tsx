"use client";

import { useState, useTransition } from "react";
import { Button } from "@/presentation/shared/components/ui/button";
import { Input } from "@/presentation/shared/components/ui/input";
import { Label } from "@/presentation/shared/components/ui/label";
import { updateTenantSettingsAction } from "@/presentation/tenant/actions";
import { commonLabels, tenantSettingsLabels } from "@/presentation/shared/labels";
import { toastError, toastSuccess } from "@/presentation/shared/toast";
import { resolveErrorMessage } from "@/presentation/shared/error-messages";

/** Devise verrouillée en lecture seule en V1 (voir CLAUDE.md) : rien dans
 * l'app ne pilote de calcul monétaire sur cette valeur, la rendre modifiable
 * créerait un champ qui a l'air fonctionnel sans rien changer réellement. */
export function GeneralSettingsForm({
  displayName: initialDisplayName,
  currency,
}: {
  displayName: string | null;
  currency: string;
}) {
  const [displayName, setDisplayName] = useState(initialDisplayName ?? "");
  const [saving, startSaving] = useTransition();

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    startSaving(async () => {
      try {
        await updateTenantSettingsAction({ displayName: displayName.trim() || null });
        toastSuccess(tenantSettingsLabels.savedMessage);
      } catch (err) {
        toastError(resolveErrorMessage(err));
      }
    });
  }

  function onCancel() {
    setDisplayName(initialDisplayName ?? "");
  }

  return (
    <form
      onSubmit={onSubmit}
      className="bg-card border-border space-y-4 rounded-xl border p-4 shadow-xs"
    >
      <h2 className="text-foreground text-sm font-semibold">
        {tenantSettingsLabels.generalSectionTitle}
      </h2>

      <div className="space-y-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-4 lg:space-y-0">
        <div className="space-y-1.5">
          <Label htmlFor="displayName">{tenantSettingsLabels.displayNameField}</Label>
          <Input id="displayName" value={displayName} onValueChange={setDisplayName} />
          <p className="text-muted-foreground text-sm">
            {tenantSettingsLabels.displayNameHelperText}
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="currency">{tenantSettingsLabels.currencyField}</Label>
          <Input id="currency" value={currency} disabled />
          <p className="text-muted-foreground text-sm">
            {tenantSettingsLabels.currencyReadOnlyHelperText}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2 lg:flex-row lg:justify-end lg:gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={saving}
          className="hidden lg:inline-flex"
        >
          {commonLabels.cancel}
        </Button>
        <Button type="submit" disabled={saving} className="w-full lg:w-auto">
          {saving ? tenantSettingsLabels.savingButtonLabel : tenantSettingsLabels.saveButtonLabel}
        </Button>
      </div>
    </form>
  );
}
