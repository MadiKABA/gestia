import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PartyPickerStep } from "@/presentation/transaction/components/party-picker-step";
import { partyLabels } from "@/presentation/shared/labels";

const createMock = vi.fn();
const listMock = vi.fn().mockResolvedValue([]);

vi.mock("@/presentation/party/offline-repository", () => ({
  createPartyOfflineRepository: () => ({ create: createMock, list: listMock }),
}));

beforeEach(() => {
  createMock.mockReset();
});

/**
 * Régression wa.me : ce formulaire n'avait jamais reçu le câblage
 * isValid/bouton désactivé posé sur les autres formulaires — le seul
 * moyen de contact possible ici est `phone` (whatsappNumber toujours null,
 * voir party-picker-step.tsx). Sans ce garde, ouvrir le sélecteur de pays
 * sans taper de chiffre produisait un indicatif seul ("+221") non bloqué
 * côté UI (juste une erreur inline après clic sur "Continuer").
 */
describe("PartyPickerStep — création rapide", () => {
  async function openCreationForm() {
    render(<PartyPickerStep tenantId="tenant-1" userId="user-1" onSelect={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: partyLabels.pickerCreateNewLabel }));
  }

  it("désactive le bouton Continuer tant qu'aucun numéro valide n'est saisi", async () => {
    await openCreationForm();
    await userEvent.type(screen.getByLabelText("Nom"), "Fatou Diop");

    expect(screen.getByRole("button", { name: partyLabels.pickerContinueLabel })).toBeDisabled();
  });

  it("reste désactivé si on ouvre le sélecteur de pays sans taper de chiffre local", async () => {
    await openCreationForm();
    await userEvent.type(screen.getByLabelText("Nom"), "Fatou Diop");

    await userEvent.click(screen.getByLabelText("Indicatif pays"));
    const options = await screen.findAllByRole("option", { name: /Sénégal/ });
    await userEvent.click(options[options.length - 1]);

    const continueButton = screen.getByRole("button", { name: partyLabels.pickerContinueLabel });
    expect(continueButton).toBeDisabled();
    expect(createMock).not.toHaveBeenCalled();
  });

  it("réactive le bouton une fois un numéro complet saisi", async () => {
    await openCreationForm();
    await userEvent.type(screen.getByLabelText("Nom"), "Fatou Diop");
    await userEvent.type(screen.getByLabelText("Téléphone"), "700000001");

    expect(screen.getByRole("button", { name: partyLabels.pickerContinueLabel })).toBeEnabled();
  });
});
