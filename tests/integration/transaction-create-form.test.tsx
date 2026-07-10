import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TransactionCreateForm } from "@/presentation/transaction/components/transaction-create-form";
import { commonLabels, transactionLabels } from "@/presentation/shared/labels";
import type { Transaction } from "@/domain/transaction/transaction.entity";

const createMock = vi.fn<(input: unknown) => Promise<Transaction>>();
const pushMock = vi.fn();

/**
 * `createTransactionOfflineRepository` et `PartyPickerStep` mockés : ce test
 * vérifie le câblage propre à cette page (ordre des champs, validation,
 * payload envoyé, redirection), pas la recherche/création de tiers
 * (déjà son propre composant, non re-testé ici) ni le moteur offline
 * (couvert par transaction-offline-sync.test.ts) — même choix que
 * payment-modal.test.tsx.
 */
vi.mock("@/presentation/transaction/offline-repository", () => ({
  createTransactionOfflineRepository: () => ({ create: createMock }),
}));

vi.mock("@/presentation/transaction/components/party-picker-step", () => ({
  PartyPickerStep: ({ onSelect }: { onSelect: (party: { id: string; name: string }) => void }) => (
    <button type="button" onClick={() => onSelect({ id: "party-1", name: "Fatou Diop" })}>
      party-picker-stub
    </button>
  ),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

beforeEach(() => {
  createMock.mockReset();
  pushMock.mockReset();
});

describe("TransactionCreateForm", () => {
  it("démarre sur 'On me doit' (créance) par défaut", () => {
    render(<TransactionCreateForm tenantId="tenant-1" userId="user-1" />);

    expect(screen.getByText(transactionLabels.newPageTitleCreance)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: transactionLabels.owedToMeLabel })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("propose un lien de retour explicite vers la liste des opérations", () => {
    render(<TransactionCreateForm tenantId="tenant-1" userId="user-1" />);

    expect(screen.getByRole("link", { name: commonLabels.back })).toHaveAttribute(
      "href",
      "/transactions",
    );
  });

  it("bascule sur 'Je dois' (dette) et réinitialise le tiers déjà choisi", async () => {
    render(<TransactionCreateForm tenantId="tenant-1" userId="user-1" />);

    await userEvent.click(screen.getByText("party-picker-stub"));
    await userEvent.click(screen.getByRole("button", { name: transactionLabels.owedByMeLabel }));

    expect(screen.getByText(transactionLabels.newPageTitleDette)).toBeInTheDocument();
    // Le tiers a été réinitialisé : le picker (stub) est de nouveau affiché.
    expect(screen.getByText("party-picker-stub")).toBeInTheDocument();
  });

  it("bloque l'enregistrement sans tiers sélectionné", async () => {
    render(<TransactionCreateForm tenantId="tenant-1" userId="user-1" />);

    await userEvent.click(
      screen.getByRole("button", { name: transactionLabels.createSubmitLabel }),
    );

    expect(await screen.findByText(transactionLabels.partyRequiredError)).toBeInTheDocument();
    expect(createMock).not.toHaveBeenCalled();
  });

  it("enregistre et redirige vers la liste avec le payload attendu (échéance optionnelle absente)", async () => {
    createMock.mockResolvedValue({} as Transaction);
    render(<TransactionCreateForm tenantId="tenant-1" userId="user-1" />);

    await userEvent.click(screen.getByText("party-picker-stub"));
    await userEvent.type(
      screen.getByLabelText(transactionLabels.descriptionField),
      "Sac de riz 50kg",
    );
    await userEvent.click(
      screen.getByRole("button", { name: transactionLabels.quickAmountAriaLabel(1000) }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: transactionLabels.createSubmitLabel }),
    );

    expect(createMock).toHaveBeenCalledWith({
      partyId: "party-1",
      type: "CREANCE",
      description: "Sac de riz 50kg",
      quantity: null,
      amount: 1000,
      dueDate: null,
    });
    expect(pushMock).toHaveBeenCalledWith("/transactions");
  });
});
