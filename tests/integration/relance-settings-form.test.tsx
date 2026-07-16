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
    render(<RelanceSettingsForm reminderDays={7} whatsappTemplate={null} currency="FCFA" />);
    const input = screen.getByLabelText(tenantSettingsLabels.reminderDaysField);
    expect(input).toHaveAttribute("min", "1");
    expect(input).toHaveAttribute("max", "30");
  });

  it("affiche un aperçu du message qui se met à jour en direct", async () => {
    render(<RelanceSettingsForm reminderDays={7} whatsappTemplate={null} currency="FCFA" />);
    // Le template par défaut est prérempli quand aucun n'a été personnalisé,
    // avec toutes les nouvelles variables déjà résolues dans l'aperçu.
    expect(
      screen.getByText(
        "Salam Awa Diop, j'espère que tu vas bien. Ici Boutique Awa. Selon mon cahier du 12 juillet 2026, tu as pris 3 sacs de riz pour un total de 25 000 FCFA (réf. CR-1042). Il te reste 15 000 FCFA à régler. Merci et bonne journée !",
      ),
    ).toBeInTheDocument();

    const textarea = screen.getByLabelText(tenantSettingsLabels.whatsappTemplateField);
    // userEvent.type interprète {xxx} comme des séquences clavier spéciales —
    // fireEvent.change pose la valeur brute pour tester des placeholders.
    fireEvent.change(textarea, {
      target: {
        value: "Coucou {client} de {boutique}, {reference} : {montantTotal} FCFA le {date}",
      },
    });

    expect(
      screen.getByText("Coucou Awa Diop de Boutique Awa, CR-1042 : 25 000 FCFA le 12 juillet 2026"),
    ).toBeInTheDocument();
  });

  it("un clic sur une variable l'insère dans le champ à la position du curseur", async () => {
    render(
      <RelanceSettingsForm reminderDays={7} whatsappTemplate="Salam {client} !" currency="FCFA" />,
    );

    const textarea = screen.getByLabelText<HTMLTextAreaElement>(
      tenantSettingsLabels.whatsappTemplateField,
    );
    textarea.setSelectionRange(6, 6);

    await userEvent.click(screen.getByRole("button", { name: "{boutique}" }));

    expect(textarea).toHaveValue("Salam {boutique}{client} !");
  });

  it("le bouton de réinitialisation restaure le modèle par défaut", async () => {
    render(
      <RelanceSettingsForm
        reminderDays={7}
        whatsappTemplate="Message personnalisé {client}"
        currency="FCFA"
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: tenantSettingsLabels.resetTemplateButtonLabel }),
    );

    expect(screen.getByLabelText(tenantSettingsLabels.whatsappTemplateField)).toHaveValue(
      DEFAULT_WHATSAPP_TEMPLATE,
    );
  });

  it("soumet le délai et le template modifiés", async () => {
    render(<RelanceSettingsForm reminderDays={7} whatsappTemplate={null} currency="FCFA" />);

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

  it("un tenant en GNF affiche un aperçu du gabarit par défaut sans aucune trace de FCFA", () => {
    render(<RelanceSettingsForm reminderDays={7} whatsappTemplate={null} currency="GNF" />);

    expect(
      screen.getByText(
        "Salam Awa Diop, j'espère que tu vas bien. Ici Boutique Awa. Selon mon cahier du 12 juillet 2026, tu as pris 3 sacs de riz pour un total de 25 000 GNF (réf. CR-1042). Il te reste 15 000 GNF à régler. Merci et bonne journée !",
      ),
    ).toBeInTheDocument();
  });
});
