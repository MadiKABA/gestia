import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PartyForm } from "@/presentation/party/components/party-form";
import { partyLabels } from "@/presentation/shared/labels";
import type { PartyWithBalance } from "@/application/party/party.repository";

const createMock = vi.fn<(input: unknown) => Promise<PartyWithBalance>>();

/**
 * `createPartyOfflineRepository` mocké — ce test vérifie uniquement le
 * câblage `formState.isValid` du formulaire RHF (bouton désactivé/réactivé),
 * pas le moteur offline (déjà couvert ailleurs).
 */
vi.mock("@/presentation/party/offline-repository", () => ({
  createPartyOfflineRepository: () => ({ create: createMock, update: vi.fn() }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

beforeEach(() => {
  createMock.mockReset();
});

describe("PartyForm", () => {
  it("désactive le bouton d'enregistrement tant que le nom et un moyen de contact ne sont pas remplis", async () => {
    render(
      <PartyForm mode="create" tenantId="tenant-1" userId="user-1" submitLabel="Enregistrer" />,
    );

    expect(screen.getByRole("button", { name: "Enregistrer" })).toBeDisabled();
  });

  it("réactive le bouton une fois le nom et un téléphone valides renseignés", async () => {
    render(
      <PartyForm mode="create" tenantId="tenant-1" userId="user-1" submitLabel="Enregistrer" />,
    );
    const submitButton = screen.getByRole("button", { name: "Enregistrer" });

    await userEvent.type(screen.getByLabelText(partyLabels.nameField), "Fatou Diop");
    await userEvent.type(screen.getByLabelText(partyLabels.phoneField), "771234567");

    expect(submitButton).toBeEnabled();
  });

  it("reste désactivé si le numéro de téléphone est invalide", async () => {
    render(
      <PartyForm mode="create" tenantId="tenant-1" userId="user-1" submitLabel="Enregistrer" />,
    );
    const submitButton = screen.getByRole("button", { name: "Enregistrer" });

    await userEvent.type(screen.getByLabelText(partyLabels.nameField), "Fatou Diop");
    await userEvent.type(screen.getByLabelText(partyLabels.phoneField), "7");

    expect(submitButton).toBeDisabled();
  });
});
