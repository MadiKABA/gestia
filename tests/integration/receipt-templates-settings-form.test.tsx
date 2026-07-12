import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReceiptTemplatesSettingsForm } from "@/presentation/tenant/components/receipt-templates-settings-form";
import {
  DEFAULT_WHATSAPP_RECEIPT_FINAL_TEMPLATE,
  DEFAULT_WHATSAPP_RECEIPT_PARTIAL_TEMPLATE,
} from "@/presentation/shared/components/whatsapp-link";
import { tenantSettingsLabels } from "@/presentation/shared/labels";

const updateTenantSettingsActionMock = vi.fn();

vi.mock("@/presentation/tenant/actions", () => ({
  updateTenantSettingsAction: (...args: unknown[]) => updateTenantSettingsActionMock(...args),
}));

beforeEach(() => {
  updateTenantSettingsActionMock.mockReset().mockResolvedValue(undefined);
});

describe("ReceiptTemplatesSettingsForm", () => {
  it("préremplit les deux gabarits personnalisés du tenant", () => {
    render(
      <ReceiptTemplatesSettingsForm
        whatsappReceiptPartialTemplate="Merci {client}, reste {montantRestant} FCFA par {modePaiement}"
        whatsappReceiptFinalTemplate="Merci {client}, Safi pour {montantPaye} FCFA"
      />,
    );

    expect(
      screen.getByLabelText(tenantSettingsLabels.whatsappReceiptPartialTemplateField),
    ).toHaveValue("Merci {client}, reste {montantRestant} FCFA par {modePaiement}");
    expect(
      screen.getByLabelText(tenantSettingsLabels.whatsappReceiptFinalTemplateField),
    ).toHaveValue("Merci {client}, Safi pour {montantPaye} FCFA");
  });

  it("préremplit les gabarits par défaut quand le tenant n'a rien personnalisé", () => {
    render(
      <ReceiptTemplatesSettingsForm
        whatsappReceiptPartialTemplate={null}
        whatsappReceiptFinalTemplate={null}
      />,
    );

    expect(
      screen.getByLabelText(tenantSettingsLabels.whatsappReceiptPartialTemplateField),
    ).toHaveValue(DEFAULT_WHATSAPP_RECEIPT_PARTIAL_TEMPLATE);
    expect(
      screen.getByLabelText(tenantSettingsLabels.whatsappReceiptFinalTemplateField),
    ).toHaveValue(DEFAULT_WHATSAPP_RECEIPT_FINAL_TEMPLATE);
  });

  it("affiche un aperçu de chaque gabarit qui se met à jour en direct", () => {
    render(
      <ReceiptTemplatesSettingsForm
        whatsappReceiptPartialTemplate={null}
        whatsappReceiptFinalTemplate={null}
      />,
    );

    const partialTextarea = screen.getByLabelText(
      tenantSettingsLabels.whatsappReceiptPartialTemplateField,
    );
    fireEvent.change(partialTextarea, {
      target: { value: "Coucou {client}, reste {montantRestant} FCFA" },
    });
    expect(screen.getByText("Coucou Awa Diop, reste 10 000 FCFA")).toBeInTheDocument();
  });

  it("chaque bouton de réinitialisation restaure son propre modèle par défaut, sans toucher à l'autre", async () => {
    render(
      <ReceiptTemplatesSettingsForm
        whatsappReceiptPartialTemplate="Message partiel personnalisé {client}"
        whatsappReceiptFinalTemplate="Message final personnalisé {client}"
      />,
    );

    const [resetPartial] = screen.getAllByRole("button", {
      name: tenantSettingsLabels.resetTemplateButtonLabel,
    });
    await userEvent.click(resetPartial);

    expect(
      screen.getByLabelText(tenantSettingsLabels.whatsappReceiptPartialTemplateField),
    ).toHaveValue(DEFAULT_WHATSAPP_RECEIPT_PARTIAL_TEMPLATE);
    expect(
      screen.getByLabelText(tenantSettingsLabels.whatsappReceiptFinalTemplateField),
    ).toHaveValue("Message final personnalisé {client}");
  });

  it("soumet les deux gabarits modifiés", async () => {
    render(
      <ReceiptTemplatesSettingsForm
        whatsappReceiptPartialTemplate={null}
        whatsappReceiptFinalTemplate={null}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: tenantSettingsLabels.saveButtonLabel }),
    );

    expect(updateTenantSettingsActionMock).toHaveBeenCalledWith({
      whatsappReceiptPartialTemplate: DEFAULT_WHATSAPP_RECEIPT_PARTIAL_TEMPLATE,
      whatsappReceiptFinalTemplate: DEFAULT_WHATSAPP_RECEIPT_FINAL_TEMPLATE,
    });
  });

  it("affiche une erreur si la sauvegarde échoue", async () => {
    updateTenantSettingsActionMock.mockRejectedValueOnce(new Error("Gabarit invalide"));

    render(
      <ReceiptTemplatesSettingsForm
        whatsappReceiptPartialTemplate={null}
        whatsappReceiptFinalTemplate={null}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: tenantSettingsLabels.saveButtonLabel }),
    );

    expect(await screen.findByText("Gabarit invalide")).toBeInTheDocument();
  });
});
