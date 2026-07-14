"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/presentation/shared/components/ui/button";
import { Input } from "@/presentation/shared/components/ui/input";
import { Label } from "@/presentation/shared/components/ui/label";
import { Textarea } from "@/presentation/shared/components/ui/textarea";
import { updateTenantSettingsAction } from "@/presentation/tenant/actions";
import { WhatsappVariableBadges } from "@/presentation/tenant/components/whatsapp-variable-badges";
import { insertTokenAtCursor } from "@/presentation/tenant/insert-token-at-cursor";
import {
  DEFAULT_WHATSAPP_TEMPLATE,
  renderWhatsappTemplate,
} from "@/presentation/shared/components/whatsapp-link";
import { commonLabels, tenantSettingsLabels } from "@/presentation/shared/labels";
import { toastError, toastSuccess } from "@/presentation/shared/toast";

const REMINDER_DAYS_MIN = 1;
const REMINDER_DAYS_MAX = 30;

const TEMPLATE_VARIABLES = [
  "client",
  "boutique",
  "montantTotal",
  "montantRestant",
  "reference",
  "description",
  "date",
];

const PREVIEW_VARS = {
  client: "Awa Diop",
  montant: "15 000",
  montantRestant: "15 000",
  montantTotal: "25 000",
  reference: "CR-1042",
  boutique: "Boutique Awa",
  description: "3 sacs de riz",
  date: "12 juillet 2026",
};

export function RelanceSettingsForm({
  reminderDays: initialReminderDays,
  whatsappTemplate: initialTemplate,
}: {
  reminderDays: number;
  whatsappTemplate: string | null;
}) {
  const [reminderDays, setReminderDays] = useState(String(initialReminderDays));
  const [template, setTemplate] = useState(initialTemplate ?? DEFAULT_WHATSAPP_TEMPLATE);
  const [saving, startSaving] = useTransition();
  const templateRef = useRef<HTMLTextAreaElement>(null);

  const reminderDaysValue = Number(reminderDays);
  const isFormValid =
    reminderDays.trim() !== "" &&
    Number.isInteger(reminderDaysValue) &&
    reminderDaysValue >= REMINDER_DAYS_MIN &&
    reminderDaysValue <= REMINDER_DAYS_MAX &&
    template.trim() !== "";

  function insertVariable(token: string) {
    const el = templateRef.current;
    const start = el?.selectionStart ?? template.length;
    const end = el?.selectionEnd ?? template.length;
    const { value, cursor } = insertTokenAtCursor(template, token, start, end);
    setTemplate(value);
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
          reminderDays: Number(reminderDays),
          whatsappTemplate: template.trim(),
        });
        toastSuccess(tenantSettingsLabels.savedMessage);
      } catch (err) {
        toastError(err instanceof Error ? err.message : commonLabels.genericError);
      }
    });
  }

  function onCancel() {
    setReminderDays(String(initialReminderDays));
    setTemplate(initialTemplate ?? DEFAULT_WHATSAPP_TEMPLATE);
  }

  return (
    <form
      onSubmit={onSubmit}
      className="bg-card border-border space-y-4 rounded-xl border p-4 shadow-xs"
    >
      <h2 className="text-foreground text-sm font-semibold">
        {tenantSettingsLabels.relanceSectionTitle}
      </h2>

      <div className="space-y-4 lg:grid lg:grid-cols-[220px_1fr] lg:items-start lg:gap-4 lg:space-y-0">
        <div className="space-y-1.5">
          <Label htmlFor="reminderDays">{tenantSettingsLabels.reminderDaysField}</Label>
          <Input
            id="reminderDays"
            type="number"
            min={REMINDER_DAYS_MIN}
            max={REMINDER_DAYS_MAX}
            value={reminderDays}
            onValueChange={setReminderDays}
          />
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="whatsappTemplate">{tenantSettingsLabels.whatsappTemplateField}</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setTemplate(DEFAULT_WHATSAPP_TEMPLATE)}
              >
                {tenantSettingsLabels.resetTemplateButtonLabel}
              </Button>
            </div>
            <Textarea
              ref={templateRef}
              id="whatsappTemplate"
              value={template}
              onChange={(event) => setTemplate(event.target.value)}
              rows={4}
            />
            <WhatsappVariableBadges tokens={TEMPLATE_VARIABLES} onInsert={insertVariable} />
          </div>

          <div className="space-y-1.5">
            <p className="text-muted-foreground text-sm">
              {tenantSettingsLabels.whatsappPreviewLabel}
            </p>
            <p className="bg-muted rounded-lg p-3 text-sm">
              {renderWhatsappTemplate(template, PREVIEW_VARS)}
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
