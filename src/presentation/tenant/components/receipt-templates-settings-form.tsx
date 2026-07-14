"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/presentation/shared/components/ui/button";
import { Label } from "@/presentation/shared/components/ui/label";
import { Textarea } from "@/presentation/shared/components/ui/textarea";
import { updateTenantSettingsAction } from "@/presentation/tenant/actions";
import { WhatsappVariableBadges } from "@/presentation/tenant/components/whatsapp-variable-badges";
import { insertTokenAtCursor } from "@/presentation/tenant/insert-token-at-cursor";
import {
  DEFAULT_WHATSAPP_RECEIPT_FINAL_TEMPLATE,
  DEFAULT_WHATSAPP_RECEIPT_PARTIAL_TEMPLATE,
  renderWhatsappTemplate,
} from "@/presentation/shared/components/whatsapp-link";
import { commonLabels, tenantSettingsLabels } from "@/presentation/shared/labels";
import { toastError, toastSuccess } from "@/presentation/shared/toast";
import { resolveErrorMessage } from "@/presentation/shared/error-messages";

const PARTIAL_TEMPLATE_VARIABLES = [
  "client",
  "boutique",
  "montantPaye",
  "modePaiement",
  "montantTotal",
  "montantRestant",
  "date",
];
const FINAL_TEMPLATE_VARIABLES = ["client", "boutique", "montantPaye", "montantTotal", "date"];

const PARTIAL_PREVIEW_VARS = {
  client: "Awa Diop",
  montantPaye: "5 000",
  modePaiement: "Wave",
  montantRestant: "10 000",
  montantTotal: "15 000",
  boutique: "Boutique Awa",
  date: "12 juillet 2026",
};
const FINAL_PREVIEW_VARS = {
  client: "Awa Diop",
  montantPaye: "15 000",
  montantTotal: "15 000",
  boutique: "Boutique Awa",
  date: "12 juillet 2026",
};

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
  const [saving, startSaving] = useTransition();
  const partialTemplateRef = useRef<HTMLTextAreaElement>(null);
  const finalTemplateRef = useRef<HTMLTextAreaElement>(null);

  const isFormValid = partialTemplate.trim() !== "" && finalTemplate.trim() !== "";

  function insertPartialVariable(token: string) {
    const el = partialTemplateRef.current;
    const start = el?.selectionStart ?? partialTemplate.length;
    const end = el?.selectionEnd ?? partialTemplate.length;
    const { value, cursor } = insertTokenAtCursor(partialTemplate, token, start, end);
    setPartialTemplate(value);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(cursor, cursor);
    });
  }

  function insertFinalVariable(token: string) {
    const el = finalTemplateRef.current;
    const start = el?.selectionStart ?? finalTemplate.length;
    const end = el?.selectionEnd ?? finalTemplate.length;
    const { value, cursor } = insertTokenAtCursor(finalTemplate, token, start, end);
    setFinalTemplate(value);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(cursor, cursor);
    });
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    startSaving(async () => {
      try {
        await updateTenantSettingsAction({
          whatsappReceiptPartialTemplate: partialTemplate.trim(),
          whatsappReceiptFinalTemplate: finalTemplate.trim(),
        });
        toastSuccess(tenantSettingsLabels.savedMessage);
      } catch (err) {
        toastError(resolveErrorMessage(err));
      }
    });
  }

  function onCancel() {
    setPartialTemplate(initialPartialTemplate ?? DEFAULT_WHATSAPP_RECEIPT_PARTIAL_TEMPLATE);
    setFinalTemplate(initialFinalTemplate ?? DEFAULT_WHATSAPP_RECEIPT_FINAL_TEMPLATE);
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
            ref={partialTemplateRef}
            id="whatsappReceiptPartialTemplate"
            value={partialTemplate}
            onChange={(event) => setPartialTemplate(event.target.value)}
            rows={4}
          />
          <WhatsappVariableBadges
            tokens={PARTIAL_TEMPLATE_VARIABLES}
            onInsert={insertPartialVariable}
          />
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
            ref={finalTemplateRef}
            id="whatsappReceiptFinalTemplate"
            value={finalTemplate}
            onChange={(event) => setFinalTemplate(event.target.value)}
            rows={4}
          />
          <WhatsappVariableBadges
            tokens={FINAL_TEMPLATE_VARIABLES}
            onInsert={insertFinalVariable}
          />
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
        <Button type="submit" disabled={saving || !isFormValid} className="w-full lg:w-auto">
          {saving ? tenantSettingsLabels.savingButtonLabel : tenantSettingsLabels.saveButtonLabel}
        </Button>
      </div>
    </form>
  );
}
