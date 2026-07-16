import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SaleCreateForm } from "@/presentation/cash-movement/components/sale-create-form";
import {
  commonLabels,
  cashMovementLabels,
  paymentLabels,
  transactionLabels,
} from "@/presentation/shared/labels";
import type { CashMovement } from "@/domain/cash-movement/cash-movement.entity";

const createMock = vi.fn<(input: unknown) => Promise<CashMovement>>();
const pushMock = vi.fn();

/**
 * `createCashMovementOfflineRepository` et `SaleClientPicker` mockés : ce
 * test vérifie le câblage propre à cette page (ordre des champs, mode de
 * paiement par défaut, payload envoyé, redirection), pas la recherche/
 * création de client (déjà son propre composant) — même choix que
 * transaction-create-form.test.tsx.
 */
vi.mock("@/presentation/cash-movement/offline-repository", () => ({
  createCashMovementOfflineRepository: () => ({ create: createMock }),
}));

vi.mock("@/presentation/cash-movement/components/sale-client-picker", () => ({
  SaleClientPicker: ({
    onSelect,
  }: {
    onSelect: (party: { id: string; name: string } | null) => void;
  }) => (
    <button type="button" onClick={() => onSelect({ id: "party-1", name: "Fatou Diop" })}>
      sale-client-picker-stub
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

describe("SaleCreateForm", () => {
  it("propose un lien de retour explicite vers la caisse", () => {
    render(<SaleCreateForm tenantId="tenant-1" userId="user-1" currency="FCFA" />);

    expect(screen.getByRole("link", { name: commonLabels.back })).toHaveAttribute(
      "href",
      "/caisse",
    );
  });

  it("sélectionne Espèces (CASH) par défaut", () => {
    render(<SaleCreateForm tenantId="tenant-1" userId="user-1" currency="FCFA" />);

    expect(
      screen.getByRole("button", { name: new RegExp(paymentLabels.methodCash) }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("désactive le bouton d'enregistrement tant que la description ou le montant manquent", async () => {
    render(<SaleCreateForm tenantId="tenant-1" userId="user-1" currency="FCFA" />);
    const submitButton = screen.getByRole("button", { name: cashMovementLabels.saleSubmitLabel });
    expect(submitButton).toBeDisabled();

    await userEvent.type(
      screen.getByLabelText(cashMovementLabels.saleDescriptionField),
      "2 sacs de riz",
    );
    expect(submitButton).toBeDisabled();

    await userEvent.click(
      screen.getByRole("button", { name: transactionLabels.quickAmountAriaLabel(1000, "FCFA") }),
    );
    expect(submitButton).toBeEnabled();
  });

  it("n'exige jamais de client pour activer le bouton d'enregistrement", async () => {
    render(<SaleCreateForm tenantId="tenant-1" userId="user-1" currency="FCFA" />);

    await userEvent.type(
      screen.getByLabelText(cashMovementLabels.saleDescriptionField),
      "2 sacs de riz",
    );
    await userEvent.click(
      screen.getByRole("button", { name: transactionLabels.quickAmountAriaLabel(1000, "FCFA") }),
    );

    expect(screen.getByRole("button", { name: cashMovementLabels.saleSubmitLabel })).toBeEnabled();
  });

  it("enregistre et redirige vers /caisse avec le payload attendu (sans client, CASH par défaut)", async () => {
    createMock.mockResolvedValue({} as CashMovement);
    render(<SaleCreateForm tenantId="tenant-1" userId="user-1" currency="FCFA" />);

    await userEvent.type(
      screen.getByLabelText(cashMovementLabels.saleDescriptionField),
      "2 sacs de riz",
    );
    await userEvent.click(
      screen.getByRole("button", { name: transactionLabels.quickAmountAriaLabel(1000, "FCFA") }),
    );
    await userEvent.click(screen.getByRole("button", { name: cashMovementLabels.saleSubmitLabel }));

    expect(createMock).toHaveBeenCalledWith({
      type: "ENTREE",
      reason: "2 sacs de riz",
      amount: 1000,
      method: "CASH",
      partyId: null,
    });
    expect(pushMock).toHaveBeenCalledWith("/caisse");
  });

  it("transmet le partyId choisi et le mode de paiement sélectionné", async () => {
    createMock.mockResolvedValue({} as CashMovement);
    render(<SaleCreateForm tenantId="tenant-1" userId="user-1" currency="FCFA" />);

    await userEvent.type(
      screen.getByLabelText(cashMovementLabels.saleDescriptionField),
      "Coupe de cheveux",
    );
    await userEvent.click(
      screen.getByRole("button", { name: transactionLabels.quickAmountAriaLabel(500, "FCFA") }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: new RegExp(paymentLabels.methodWave) }),
    );
    await userEvent.click(screen.getByText("sale-client-picker-stub"));
    await userEvent.click(screen.getByRole("button", { name: cashMovementLabels.saleSubmitLabel }));

    expect(createMock).toHaveBeenCalledWith({
      type: "ENTREE",
      reason: "Coupe de cheveux",
      amount: 500,
      method: "WAVE",
      partyId: "party-1",
    });
  });
});
