import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PaymentModal } from "@/presentation/payment/components/payment-modal";
import { paymentLabels, transactionLabels } from "@/presentation/shared/labels";
import type { Transaction } from "@/domain/transaction/transaction.entity";
import type { Payment } from "@/domain/payment/payment.entity";

/**
 * `createPaymentOfflineRepository` mocké plutôt que réel (contrairement aux
 * tests d'intégration payment-offline-sync.test.ts) : ce test vérifie le
 * câblage React (montant préempli, validation, appel du repository, callback
 * de succès), pas le moteur offline lui-même déjà couvert ailleurs — même
 * choix que sync-rate-limit.test.ts pour isoler ce qu'on veut vraiment
 * vérifier.
 */
const createMock = vi.fn<(input: unknown) => Promise<Payment>>();

vi.mock("@/presentation/payment/offline-repository", () => ({
  createPaymentOfflineRepository: () => ({ create: createMock }),
}));

function stubMatchMedia(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
}

const creance: Transaction = {
  id: "transaction-1",
  tenantId: "tenant-1",
  reference: "CR-2026-00001",
  partyId: "party-1",
  type: "CREANCE",
  description: "Sac de riz",
  quantity: null,
  amount: 10000,
  paidAmount: 4000,
  dueDate: null,
  status: "PARTIELLE",
  createdById: "user-1",
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => {
  stubMatchMedia(false);
  createMock.mockReset();
});

describe("PaymentModal", () => {
  it("préremplit le montant avec le solde restant et libelle le bouton 'Encaisser' pour une créance", () => {
    render(
      <PaymentModal
        transaction={creance}
        tenantId="tenant-1"
        userId="user-1"
        open={true}
        onOpenChange={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );

    expect(screen.getByLabelText(transactionLabels.amountField)).toHaveValue(6000);
    expect(
      screen.getByRole("button", { name: paymentLabels.payButtonLabel("CREANCE") }),
    ).toBeInTheDocument();
  });

  it("libelle le bouton 'Rembourser' pour une dette", () => {
    render(
      <PaymentModal
        transaction={{ ...creance, type: "DETTE" }}
        tenantId="tenant-1"
        userId="user-1"
        open={true}
        onOpenChange={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: paymentLabels.payButtonLabel("DETTE") }),
    ).toBeInTheDocument();
  });

  it("bloque un montant supérieur au solde restant sans jamais appeler le repository", async () => {
    render(
      <PaymentModal
        transaction={creance}
        tenantId="tenant-1"
        userId="user-1"
        open={true}
        onOpenChange={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );

    const amountInput = screen.getByLabelText(transactionLabels.amountField);
    await userEvent.clear(amountInput);
    await userEvent.type(amountInput, "6001");
    await userEvent.click(
      screen.getByRole("button", { name: paymentLabels.payButtonLabel("CREANCE") }),
    );

    expect(await screen.findByText(paymentLabels.amountExceedsRemainingError)).toBeInTheDocument();
    expect(createMock).not.toHaveBeenCalled();
  });

  it("soumet le paiement partiel avec le montant et le mode choisis, puis notifie le succès", async () => {
    const payment: Payment = {
      id: "payment-1",
      tenantId: "tenant-1",
      transactionId: creance.id,
      amount: 2000,
      method: "WAVE",
      direction: "IN",
      note: null,
      createdById: "user-1",
      createdAt: new Date(),
    };
    createMock.mockResolvedValue(payment);
    const onSuccess = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <PaymentModal
        transaction={creance}
        tenantId="tenant-1"
        userId="user-1"
        open={true}
        onOpenChange={onOpenChange}
        onSuccess={onSuccess}
      />,
    );

    const amountInput = screen.getByLabelText(transactionLabels.amountField);
    await userEvent.clear(amountInput);
    await userEvent.type(amountInput, "2000");
    await userEvent.click(
      screen.getByRole("button", { name: paymentLabels.payButtonLabel("CREANCE") }),
    );

    expect(createMock).toHaveBeenCalledWith({
      transactionId: creance.id,
      amount: 2000,
      method: "CASH",
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onSuccess).toHaveBeenCalledWith(payment);
  });

  it("réinitialise le montant au solde restant actuel à chaque réouverture, même si l'instance reste montée", () => {
    // Reproduit transaction-detail.tsx : la modale n'est jamais démontée
    // entre deux paiements (seul `open` change), contrairement à
    // transactions-list.tsx qui la démonte/remonte via un rendu conditionnel.
    const { rerender } = render(
      <PaymentModal
        transaction={creance}
        tenantId="tenant-1"
        userId="user-1"
        open={true}
        onOpenChange={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );
    expect(screen.getByLabelText(transactionLabels.amountField)).toHaveValue(6000);

    // Fermeture après un premier paiement partiel de 4000 (paidAmount passe
    // de 4000 à 8000), instance conservée.
    rerender(
      <PaymentModal
        transaction={{ ...creance, paidAmount: 8000 }}
        tenantId="tenant-1"
        userId="user-1"
        open={false}
        onOpenChange={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );

    // Réouverture pour un second paiement : le montant doit refléter le
    // nouveau solde restant (2000), pas la valeur de la toute première
    // ouverture (6000).
    rerender(
      <PaymentModal
        transaction={{ ...creance, paidAmount: 8000 }}
        tenantId="tenant-1"
        userId="user-1"
        open={true}
        onOpenChange={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );

    expect(screen.getByLabelText(transactionLabels.amountField)).toHaveValue(2000);
  });
});
