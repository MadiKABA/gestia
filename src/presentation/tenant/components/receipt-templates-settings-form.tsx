"use client";

import { useState, useTransition } from "react";
import { Button } from "@/presentation/shared/components/ui/button";
import { Label } from "@/presentation/shared/components/ui/label";
import { Textarea } from "@/presentation/shared/components/ui/textarea";
import { updateTenantSettingsAction } from "@/presentation/tenant/actions";
import {
  DEFAULT_WHATSAPP_RECEIPT_FINAL_TEMPLATE,
  DEFAULT_WHATSAPP_RECEIPT_PARTIAL_TEMPLATE,
  renderWhatsappTemplate,
} from "@/presentation/shared/components/whatsapp-link";
import { commonLabels, tenantSettingsLabels } from "@/presentation/shared/labels";

const PARTIAL_PREVIEW_VARS = {
  client: "Awa Diop",
  montantPaye: "5 000",
  modePaiement: "Wave",
  montantRestant: "10 000",
};
const FINAL_PREVIEW_VARS = { client: "Awa Diop", montantPaye: "15 000" };

export function ReceiptTemplatesSettingsForm({
  whatsappReceiptPartialTemplate: initialPartialTemplate,
  whatsappReceiptFinalTemplate: initialFinalTemplate,
}: {
  whatsappReceiptPartialTemplate: string | null;
  whatsappReceiptFinalTemplate: string | null;
}) {
  const [partialTemplate, setPartialTemplate] = useState(
    initialPartialTemplate ?? DEFAULT_WHATSAPP_RECEIPT_PARTIAL_TEMPLATE,
  );
  const [finalTemplate, setFinalTemplate] = useState(
    initialFinalTemplate ?? DEFAULT_WHATSAPP_RECEIPT_FINAL_TEMPLATE,
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, startSaving] = useTransition();

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    startSaving(async () => {
      try {
        await updateTenantSettingsAction({
          whatsappReceiptPartialTemplate: partialTemplate.trim(),
          whatsappReceiptFinalTemplate: finalTemplate.trim(),
        });
        setSaved(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : commonLabels.genericError);
      }
    });
  }

  function onCancel() {
    setPartialTemplate(initialPartialTemplate ?? DEFAULT_WHATSAPP_RECEIPT_PARTIAL_TEMPLATE);
    setFinalTemplate(initialFinalTemplate ?? DEFAULT_WHATSAPP_RECEIPT_FINAL_TEMPLATE);
    setError(null);
    setSaved(false);
  }

  return (
    <form
      onSubmit={onSubmit}
      className="bg-card border-border space-y-4 rounded-xl border p-4 shadow-xs"
    >
      <h2 className="text-foreground text-sm font-semibold">
        {tenantSettingsLabels.whatsappReceiptsSectionTitle}
      </h2>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="whatsappReceiptPartialTemplate">
              {tenantSettingsLabels.whatsappReceiptPartialTemplateField}
            </Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setPartialTemplate(DEFAULT_WHATSAPP_RECEIPT_PARTIAL_TEMPLATE)}
            >
              {tenantSettingsLabels.resetTemplateButtonLabel}
            </Button>
          </div>
          <Textarea
            id="whatsappReceiptPartialTemplate"
            value={partialTemplate}
            onChange={(event) => setPartialTemplate(event.target.value)}
            rows={4}
          />
          <p className="text-muted-foreground text-sm">
            {tenantSettingsLabels.whatsappReceiptPartialPlaceholdersHelperText}
          </p>
          <div className="space-y-1.5">
            <p className="text-muted-foreground text-sm">
              {tenantSettingsLabels.whatsappPreviewLabel}
            </p>
            <p className="bg-muted rounded-lg p-3 text-sm">
              {renderWhatsappTemplate(partialTemplate, PARTIAL_PREVIEW_VARS)}
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="whatsappReceiptFinalTemplate">
              {tenantSettingsLabels.whatsappReceiptFinalTemplateField}
            </Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setFinalTemplate(DEFAULT_WHATSAPP_RECEIPT_FINAL_TEMPLATE)}
            >
              {tenantSettingsLabels.resetTemplateButtonLabel}
            </Button>
          </div>
          <Textarea
            id="whatsappReceiptFinalTemplate"
            value={finalTemplate}
            onChange={(event) => setFinalTemplate(event.target.value)}
            rows={4}
          />
          <p className="text-muted-foreground text-sm">
            {tenantSettingsLabels.whatsappReceiptFinalPlaceholdersHelperText}
          </p>
          <div className="space-y-1.5">
            <p className="text-muted-foreground text-sm">
              {tenantSettingsLabels.whatsappPreviewLabel}
            </p>
            <p className="bg-muted rounded-lg p-3 text-sm">
              {renderWhatsappTemplate(finalTemplate, FINAL_PREVIEW_VARS)}
            </p>
          </div>
        </div>
      </div>

      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      {saved ? <p className="text-success text-sm">{tenantSettingsLabels.savedMessage}</p> : null}
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
