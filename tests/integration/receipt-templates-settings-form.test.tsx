import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReceiptTemplatesSettingsForm } from "@/presentation/tenant/components/receipt-templates-settings-form";
import {
  DEFAULT_WHATSAPP_RECEIPT_FINAL_TEMPLATE,
  DEFAULT_WHATSAPP_RECEIPT_PARTIAL_TEMPLATE,
} from "@/presentation/shared/components/whatsapp-link";
import { commonLabels, tenantSettingsLabels } from "@/presentation/shared/labels";

const updateTenantSettingsActionMock = vi.fn();
const toastErrorMock = vi.fn();

vi.mock("@/presentation/tenant/actions", () => ({
  updateTenantSettingsAction: (...args: unknown[]) => updateTenantSettingsActionMock(...args),
}));

vi.mock("@/presentation/shared/toast", () => ({
  toastSuccess: vi.fn(),
  toastError: (...args: unknown[]) => toastErrorMock(...args),
}));

beforeEach(() => {
  updateTenantSettingsActionMock.mockReset().mockResolvedValue(undefined);
  toastErrorMock.mockReset();
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

  it("affiche un aperçu de chaque gabarit qui se met à jour en direct, y compris boutique/montant total/date", () => {
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
      target: {
        value:
          "Coucou {client} de {boutique}, reste {montantRestant} sur {montantTotal} FCFA le {date}",
      },
    });
    expect(
      screen.getByText(
        "Coucou Awa Diop de Boutique Awa, reste 10 000 sur 15 000 FCFA le 12 juillet 2026",
      ),
    ).toBeInTheDocument();

    const finalTextarea = screen.getByLabelText(
      tenantSettingsLabels.whatsappReceiptFinalTemplateField,
    );
    fireEvent.change(finalTextarea, {
      target: { value: "Merci {client} de {boutique}, {montantTotal} FCFA soldé le {date}" },
    });
    expect(
      screen.getByText("Merci Awa Diop de Boutique Awa, 15 000 FCFA soldé le 12 juillet 2026"),
    ).toBeInTheDocument();
  });

  it("un clic sur une variable l'insère dans le bon champ à la position du curseur", async () => {
    render(
      <ReceiptTemplatesSettingsForm
        whatsappReceiptPartialTemplate="Salam {client} !"
        whatsappReceiptFinalTemplate="Safi {client} !"
      />,
    );

    const finalTextarea = screen.getByLabelText<HTMLTextAreaElement>(
      tenantSettingsLabels.whatsappReceiptFinalTemplateField,
    );
    finalTextarea.setSelectionRange(5, 5);

    const [, insertBoutiqueInFinal] = screen.getAllByRole("button", { name: "{boutique}" });
    await userEvent.click(insertBoutiqueInFinal);

    expect(finalTextarea).toHaveValue("Safi {boutique}{client} !");
    expect(
      screen.getByLabelText(tenantSettingsLabels.whatsappReceiptPartialTemplateField),
    ).toHaveValue("Salam {client} !");
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

  it("notifie le message générique si la sauvegarde échoue (jamais le message brut du serveur)", async () => {
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

    await vi.waitFor(() =>
      expect(toastErrorMock).toHaveBeenCalledWith(commonLabels.genericErrorToastMessage),
    );
  });
});
