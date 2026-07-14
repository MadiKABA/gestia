import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PartyForm } from "@/presentation/party/components/party-form";
import { commonLabels, partyLabels } from "@/presentation/shared/labels";
import type { PartyWithBalance } from "@/application/party/party.repository";

const createMock = vi.fn<(input: unknown) => Promise<PartyWithBalance>>();
const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();
const toastQueuedOfflineMock = vi.fn();

/** `queueOffline` pilote si le repository mocké simule un repli hors ligne
 * (appelle `onOfflineFallback`) ou un succès en ligne direct — un seul mock
 * suffit à couvrir les 3 issues (succès/erreur/hors ligne) sans dupliquer le
 * moteur offline réel, déjà couvert ailleurs. */
let queueOffline = false;

vi.mock("@/presentation/party/offline-repository", () => ({
  createPartyOfflineRepository: (
    _tenantId: string,
    _userId: string,
    onOfflineFallback?: () => void,
  ) => ({
    create: async (input: unknown) => {
      const result = await createMock(input);
      if (queueOffline) onOfflineFallback?.();
      return result;
    },
    update: vi.fn(),
  }),
}));

vi.mock("@/presentation/shared/toast", () => ({
  toastSuccess: (...args: unknown[]) => toastSuccessMock(...args),
  toastError: (...args: unknown[]) => toastErrorMock(...args),
  toastQueuedOffline: (...args: unknown[]) => toastQueuedOfflineMock(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

beforeEach(() => {
  createMock.mockReset();
  toastSuccessMock.mockReset();
  toastErrorMock.mockReset();
  toastQueuedOfflineMock.mockReset();
  queueOffline = false;
});

async function fillValidForm() {
  await userEvent.type(screen.getByLabelText(partyLabels.nameField), "Fatou Diop");
  await userEvent.type(screen.getByLabelText(partyLabels.phoneField), "771234567");
}

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

    await fillValidForm();

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

  it("affiche un toast de succès quand la création réussit en ligne", async () => {
    createMock.mockResolvedValue({} as PartyWithBalance);
    render(
      <PartyForm mode="create" tenantId="tenant-1" userId="user-1" submitLabel="Enregistrer" />,
    );
    await fillValidForm();

    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    await vi.waitFor(() =>
      expect(toastSuccessMock).toHaveBeenCalledWith(partyLabels.createdToastMessage),
    );
    expect(toastQueuedOfflineMock).not.toHaveBeenCalled();
    expect(toastErrorMock).not.toHaveBeenCalled();
  });

  it("affiche un toast neutre de mise en attente quand la création retombe hors ligne", async () => {
    queueOffline = true;
    createMock.mockResolvedValue({} as PartyWithBalance);
    render(
      <PartyForm mode="create" tenantId="tenant-1" userId="user-1" submitLabel="Enregistrer" />,
    );
    await fillValidForm();

    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    await vi.waitFor(() => expect(toastQueuedOfflineMock).toHaveBeenCalledTimes(1));
    expect(toastSuccessMock).not.toHaveBeenCalled();
    expect(toastErrorMock).not.toHaveBeenCalled();
  });

  it("affiche un toast d'erreur quand la création échoue", async () => {
    createMock.mockRejectedValue(new Error("Échec réseau"));
    render(
      <PartyForm mode="create" tenantId="tenant-1" userId="user-1" submitLabel="Enregistrer" />,
    );
    await fillValidForm();

    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    await vi.waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith("Échec réseau"));
    expect(toastSuccessMock).not.toHaveBeenCalled();
    expect(toastQueuedOfflineMock).not.toHaveBeenCalled();
  });

  it("affiche le message générique de repli si l'erreur n'est pas une instance Error", async () => {
    createMock.mockRejectedValue("erreur brute");
    render(
      <PartyForm mode="create" tenantId="tenant-1" userId="user-1" submitLabel="Enregistrer" />,
    );
    await fillValidForm();

    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    await vi.waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith(commonLabels.genericError));
  });
});
