import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RelanceSettingsForm } from "@/presentation/tenant/components/relance-settings-form";
import { DEFAULT_WHATSAPP_TEMPLATE } from "@/presentation/shared/components/whatsapp-link";
import { tenantSettingsLabels } from "@/presentation/shared/labels";

const updateTenantSettingsActionMock = vi.fn();

vi.mock("@/presentation/tenant/actions", () => ({
  updateTenantSettingsAction: (...args: unknown[]) => updateTenantSettingsActionMock(...args),
}));

beforeEach(() => {
  updateTenantSettingsActionMock.mockReset().mockResolvedValue(undefined);
});

describe("RelanceSettingsForm", () => {
  it("le champ délai respecte les bornes [1, 30]", () => {
    render(<RelanceSettingsForm reminderDays={7} whatsappTemplate={null} />);
    const input = screen.getByLabelText(tenantSettingsLabels.reminderDaysField);
    expect(input).toHaveAttribute("min", "1");
    expect(input).toHaveAttribute("max", "30");
  });

  it("affiche un aperçu du message qui se met à jour en direct", async () => {
    render(<RelanceSettingsForm reminderDays={7} whatsappTemplate={null} />);
    // Le template par défaut est prérempli quand aucun n'a été personnalisé.
    expect(screen.getByText(/petit rappel : CR-1042 de 15 000 FCFA/)).toBeInTheDocument();

    const textarea = screen.getByLabelText(tenantSettingsLabels.whatsappTemplateField);
    // userEvent.type interprète {xxx} comme des séquences clavier spéciales —
    // fireEvent.change pose la valeur brute pour tester des placeholders.
    fireEvent.change(textarea, {
      target: { value: "Coucou {client}, {reference} : {montant} FCFA" },
    });

    expect(screen.getByText("Coucou Awa Diop, CR-1042 : 15 000 FCFA")).toBeInTheDocument();
  });

  it("le bouton de réinitialisation restaure le modèle par défaut", async () => {
    render(
      <RelanceSettingsForm reminderDays={7} whatsappTemplate="Message personnalisé {client}" />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: tenantSettingsLabels.resetTemplateButtonLabel }),
    );

    expect(screen.getByLabelText(tenantSettingsLabels.whatsappTemplateField)).toHaveValue(
      DEFAULT_WHATSAPP_TEMPLATE,
    );
  });

  it("soumet le délai et le template modifiés", async () => {
    render(<RelanceSettingsForm reminderDays={7} whatsappTemplate={null} />);

    const daysInput = screen.getByLabelText(tenantSettingsLabels.reminderDaysField);
    await userEvent.clear(daysInput);
    await userEvent.type(daysInput, "10");

    await userEvent.click(
      screen.getByRole("button", { name: tenantSettingsLabels.saveButtonLabel }),
    );

    expect(updateTenantSettingsActionMock).toHaveBeenCalledWith({
      reminderDays: 10,
      whatsappTemplate: DEFAULT_WHATSAPP_TEMPLATE,
    });
  });
});
