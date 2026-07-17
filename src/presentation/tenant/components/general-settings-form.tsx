"use client";

import { useState, useTransition } from "react";
import { Button } from "@/presentation/shared/components/ui/button";
import { Input } from "@/presentation/shared/components/ui/input";
import { Label } from "@/presentation/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/presentation/shared/components/ui/select";
import {
  updateTenantSettingsAction,
  updateBusinessTypeAction,
} from "@/presentation/tenant/actions";
import { commonLabels, tenantSettingsLabels } from "@/presentation/shared/labels";
import { toastError, toastSuccess } from "@/presentation/shared/toast";
import { resolveErrorMessage } from "@/presentation/shared/error-messages";
import { SUPPORTED_CURRENCIES, type CurrencyCode } from "@/config/currencies";
import type { BusinessTypeCode } from "@/domain/tenant/business-type";
import { BusinessTypeSelector } from "@/presentation/shared/components/business-type-selector";

export function GeneralSettingsForm({
  displayName: initialDisplayName,
  currency: initialCurrency,
  businessType: initialBusinessType,
}: {
  displayName: string | null;
  currency: CurrencyCode;
  businessType: BusinessTypeCode;
}) {
  const [displayName, setDisplayName] = useState(initialDisplayName ?? "");
  const [currency, setCurrency] = useState<CurrencyCode>(initialCurrency);
  const [businessType, setBusinessType] = useState<BusinessTypeCode>(initialBusinessType);
  const [saving, startSaving] = useTransition();

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    startSaving(async () => {
      try {
        await Promise.all([
          updateTenantSettingsAction({ displayName: displayName.trim() || null, currency }),
          updateBusinessTypeAction({ businessType }),
        ]);
        toastSuccess(tenantSettingsLabels.savedMessage);
      } catch (err) {
        toastError(resolveErrorMessage(err));
      }
    });
  }

  function onCancel() {
    setDisplayName(initialDisplayName ?? "");
    setCurrency(initialCurrency);
    setBusinessType(initialBusinessType);
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
          <Select value={currency} onValueChange={(value) => setCurrency(value as CurrencyCode)}>
            <SelectTrigger id="currency" className="w-full">
              <SelectValue>
                {(value: string) =>
                  SUPPORTED_CURRENCIES.find((option) => option.code === value)?.label ?? value
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {SUPPORTED_CURRENCIES.map((option) => (
                <SelectItem key={option.code} value={option.code}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-muted-foreground text-sm">{tenantSettingsLabels.currencyHelperText}</p>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>{tenantSettingsLabels.businessTypeField}</Label>
        <BusinessTypeSelector value={businessType} onChange={setBusinessType} disabled={saving} />
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
