import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { TransactionDetail } from "@/presentation/transaction/components/transaction-detail";
import { paymentLabels } from "@/presentation/shared/labels";
import type { Transaction } from "@/domain/transaction/transaction.entity";
import type { Payment } from "@/domain/payment/payment.entity";

/**
 * Régression pour le point "affichage fiable de la description et de
 * l'historique des paiements" : l'audit du composant n'a trouvé aucun bug
 * (description déjà affichée, historique mis à jour de façon optimiste dans
 * onPaymentSuccess sans dépendre du pull réseau) — le symptôme rapporté
 * s'expliquait entièrement par le trou de câblage sync corrigé pour Payment
 * dans les commits précédents. Ce test verrouille le comportement actuel :
 * pas de correctif de production, une garantie contre la régression.
 *
 * `createTransactionOfflineRepository`/`seedTransactionCache`/
 * `seedPaymentCache` mockés, et `PaymentModal` remplacé par un stub qui
 * déclenche `onSuccess` sur simple clic — même choix que
 * transaction-create-form.test.tsx/payment-modal.test.tsx : ce test vérifie
 * le câblage React de TransactionDetail, pas le moteur offline lui-même
 * (déjà couvert par transaction-offline-sync.test.ts/payment-offline-sync.test.ts).
 */
const getByIdMock = vi.fn<(id: string) => Promise<Transaction | null>>();

vi.mock("@/presentation/transaction/offline-repository", () => ({
  createTransactionOfflineRepository: () => ({ getById: getByIdMock }),
  seedTransactionCache: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/presentation/payment/offline-repository", () => ({
  seedPaymentCache: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

let paymentModalOnSuccess: ((payment: Payment) => void) | null = null;

vi.mock("@/presentation/payment/components/payment-modal", () => ({
  PaymentModal: ({ onSuccess }: { onSuccess: (payment: Payment) => void }) => {
    paymentModalOnSuccess = onSuccess;
    return null;
  },
}));

const transaction: Transaction = {
  id: "transaction-1",
  tenantId: "tenant-1",
  reference: "CR-2026-00001",
  partyId: "party-1",
  type: "CREANCE",
  description: "Sac de riz 50kg",
  quantity: null,
  amount: 10000,
  paidAmount: 4000,
  dueDate: null,
  status: "PARTIELLE",
  createdById: "user-1",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const firstPayment: Payment = {
  id: "payment-1",
  tenantId: "tenant-1",
  transactionId: transaction.id,
  amount: 4000,
  method: "WAVE",
  direction: "IN",
  note: null,
  createdById: "user-1",
  createdAt: new Date(),
};

const secondPayment: Payment = {
  id: "payment-2",
  tenantId: "tenant-1",
  transactionId: transaction.id,
  amount: 2000,
  method: "CASH",
  direction: "IN",
  note: null,
  createdById: "user-1",
  createdAt: new Date(),
};

beforeEach(() => {
  getByIdMock.mockReset();
  paymentModalOnSuccess = null;
});

const emptyReceiptTemplates = { partial: null, final: null };

describe("TransactionDetail", () => {
  it("affiche la description saisie à la création", () => {
    render(
      <TransactionDetail
        transaction={transaction}
        party={{ name: "Fatou Diop", phone: "+221771234567", whatsappNumber: null }}
        whatsappTemplate={null}
        whatsappReceiptTemplates={emptyReceiptTemplates}
        boutique="Boutique Awa"
        reminderDays={7}
        tenantId="tenant-1"
        userId="user-1"
        canDelete={true}
        initialPayments={[firstPayment]}
      />,
    );

    expect(screen.getByText("Sac de riz 50kg")).toBeInTheDocument();
  });

  it("n'affiche pas l'historique pour un seul versement (règle métier), mais l'affiche immédiatement après un deuxième paiement, sans refresh", async () => {
    getByIdMock.mockResolvedValue({
      ...transaction,
      paidAmount: 6000,
      status: "PARTIELLE",
    });

    render(
      <TransactionDetail
        transaction={transaction}
        party={{ name: "Fatou Diop", phone: "+221771234567", whatsappNumber: null }}
        whatsappTemplate={null}
        whatsappReceiptTemplates={emptyReceiptTemplates}
        boutique="Boutique Awa"
        reminderDays={7}
        tenantId="tenant-1"
        userId="user-1"
        canDelete={true}
        initialPayments={[firstPayment]}
      />,
    );

    expect(screen.queryByText(paymentLabels.historyTitle)).not.toBeInTheDocument();

    expect(paymentModalOnSuccess).not.toBeNull();
    await act(async () => {
      paymentModalOnSuccess?.(secondPayment);
      await Promise.resolve();
    });

    expect(await screen.findByText(paymentLabels.historyTitle)).toBeInTheDocument();
  });

  it("propose l'envoi d'un reçu partiel après un paiement laissant un solde restant", async () => {
    getByIdMock.mockResolvedValue({
      ...transaction,
      paidAmount: 6000,
      status: "PARTIELLE",
    });

    render(
      <TransactionDetail
        transaction={transaction}
        party={{ name: "Fatou Diop", phone: "+221771234567", whatsappNumber: null }}
        whatsappTemplate={null}
        whatsappReceiptTemplates={emptyReceiptTemplates}
        boutique="Boutique Awa"
        reminderDays={7}
        tenantId="tenant-1"
        userId="user-1"
        canDelete={true}
        initialPayments={[firstPayment]}
      />,
    );

    expect(
      screen.queryByRole("button", { name: paymentLabels.sendReceiptButtonLabel }),
    ).not.toBeInTheDocument();

    await act(async () => {
      paymentModalOnSuccess?.(secondPayment);
      await Promise.resolve();
    });

    expect(
      await screen.findByRole("button", { name: paymentLabels.sendReceiptButtonLabel }),
    ).toBeInTheDocument();
  });

  it("propose l'envoi d'un reçu final (Safi) après un paiement qui solde la créance", async () => {
    getByIdMock.mockResolvedValue({
      ...transaction,
      paidAmount: 10000,
      status: "REGLEE",
    });

    render(
      <TransactionDetail
        transaction={transaction}
        party={{ name: "Fatou Diop", phone: "+221771234567", whatsappNumber: null }}
        whatsappTemplate={null}
        whatsappReceiptTemplates={emptyReceiptTemplates}
        boutique="Boutique Awa"
        reminderDays={7}
        tenantId="tenant-1"
        userId="user-1"
        canDelete={true}
        initialPayments={[firstPayment]}
      />,
    );

    await act(async () => {
      paymentModalOnSuccess?.(secondPayment);
      await Promise.resolve();
    });

    const receiptButton = await screen.findByRole("button", {
      name: paymentLabels.sendReceiptButtonLabel,
    });
    expect(receiptButton).toBeInTheDocument();
    expect(screen.getByText(/Safi/)).toBeInTheDocument();
  });

  it("n'affiche jamais le reçu WhatsApp pour une dette, même après un paiement", async () => {
    const dette: Transaction = { ...transaction, type: "DETTE" };
    getByIdMock.mockResolvedValue({ ...dette, paidAmount: 10000, status: "REGLEE" });

    render(
      <TransactionDetail
        transaction={dette}
        party={{ name: "Fatou Diop", phone: "+221771234567", whatsappNumber: null }}
        whatsappTemplate={null}
        whatsappReceiptTemplates={emptyReceiptTemplates}
        boutique="Boutique Awa"
        reminderDays={7}
        tenantId="tenant-1"
        userId="user-1"
        canDelete={true}
        initialPayments={[firstPayment]}
      />,
    );

    await act(async () => {
      paymentModalOnSuccess?.(secondPayment);
      await Promise.resolve();
    });

    expect(
      screen.queryByRole("button", { name: paymentLabels.sendReceiptButtonLabel }),
    ).not.toBeInTheDocument();
  });

  it("masque relance et reçu si le tiers n'a ni téléphone ni whatsapp", async () => {
    getByIdMock.mockResolvedValue({ ...transaction, paidAmount: 6000, status: "PARTIELLE" });

    render(
      <TransactionDetail
        transaction={transaction}
        party={{ name: "Fatou Diop", phone: null, whatsappNumber: null }}
        whatsappTemplate={null}
        whatsappReceiptTemplates={emptyReceiptTemplates}
        boutique="Boutique Awa"
        reminderDays={7}
        tenantId="tenant-1"
        userId="user-1"
        canDelete={true}
        initialPayments={[firstPayment]}
      />,
    );

    await act(async () => {
      paymentModalOnSuccess?.(secondPayment);
      await Promise.resolve();
    });

    expect(
      screen.queryByRole("button", { name: paymentLabels.sendReceiptButtonLabel }),
    ).not.toBeInTheDocument();
  });
});
