import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TransactionsList } from "@/presentation/transaction/components/transactions-list";
import { paymentLabels } from "@/presentation/shared/labels";
import type { Transaction } from "@/domain/transaction/transaction.entity";
import type { Payment } from "@/domain/payment/payment.entity";

/**
 * Régression pour le gap d'audit "reçu WhatsApp absent du paiement rapide en
 * liste" : le paiement rapide depuis le tableau desktop (transactions-list.tsx)
 * doit proposer le même bouton de reçu WhatsApp que la fiche détail
 * (transaction-detail.tsx), avec la même condition d'affichage (créance
 * uniquement, jamais une dette).
 *
 * `createTransactionOfflineRepository`/`seedTransactionCache`/`PaymentModal`
 * mockés — même choix que transaction-detail.test.tsx : ce test vérifie le
 * câblage React de TransactionsList, pas le moteur offline lui-même.
 */
const listMock = vi.fn<() => Promise<Transaction[]>>();
const getByIdMock = vi.fn<(id: string) => Promise<Transaction | null>>();

vi.mock("@/presentation/transaction/offline-repository", () => ({
  createTransactionOfflineRepository: () => ({ list: listMock, getById: getByIdMock }),
  seedTransactionCache: vi.fn().mockResolvedValue(undefined),
}));

let paymentModalOnSuccess: ((payment: Payment) => void) | null = null;
let paymentModalTransaction: Transaction | null = null;

vi.mock("@/presentation/payment/components/payment-modal", () => ({
  PaymentModal: ({
    transaction,
    onSuccess,
  }: {
    transaction: Transaction;
    onSuccess: (payment: Payment) => void;
  }) => {
    paymentModalTransaction = transaction;
    paymentModalOnSuccess = onSuccess;
    return null;
  },
}));

function makeTransaction(overrides: Partial<Transaction>): Transaction {
  return {
    id: "transaction-1",
    tenantId: "tenant-1",
    reference: "CR-2026-00001",
    partyId: "party-1",
    type: "CREANCE",
    description: "Sac de riz 50kg",
    quantity: null,
    amount: 10000,
    paidAmount: 0,
    dueDate: null,
    status: "EN_COURS",
    createdById: "user-1",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

const party = {
  id: "party-1",
  name: "Awa Ndiaye",
  phone: "+221771234567",
  whatsappNumber: null,
};

const payment: Payment = {
  id: "payment-1",
  tenantId: "tenant-1",
  transactionId: "transaction-1",
  amount: 10000,
  method: "CASH",
  direction: "IN",
  note: null,
  createdById: "user-1",
  createdAt: new Date(),
};

const receiptTemplates = { partial: null, final: null };

beforeEach(() => {
  listMock.mockReset();
  getByIdMock.mockReset();
  paymentModalOnSuccess = null;
  paymentModalTransaction = null;
});

function renderList(transaction: Transaction) {
  render(
    <TransactionsList
      initialTransactions={[transaction]}
      tenantId="tenant-1"
      userId="user-1"
      parties={[party]}
      summary={{ owedToMe: 10000, owedByMe: 0 }}
      lastPaymentMethodByTransactionId={{}}
      whatsappReceiptTemplates={receiptTemplates}
      boutique="Boutique Awa"
      currency="FCFA"
      reminderDays={7}
    />,
  );
}

async function clickPay(transaction: Transaction) {
  const table = screen.getByRole("table");
  await userEvent.click(
    within(table).getByRole("button", { name: paymentLabels.payButtonLabel(transaction.type) }),
  );
}

describe("TransactionsList — reçu WhatsApp après paiement rapide", () => {
  it("propose le reçu WhatsApp après un paiement rapide qui règle une créance", async () => {
    const transaction = makeTransaction({ status: "EN_COURS", paidAmount: 0 });
    const updated = { ...transaction, status: "REGLEE" as const, paidAmount: 10000 };
    // `list()` doit retourner la transaction toujours présente : la resoudre
    // à `[]` ferait disparaître la ligne (et son bouton) sous le geste de
    // clic simulé par userEvent, avant même que le clic n'ait le temps
    // d'aboutir (l'effet de montage appelle `list()` en tâche de fond).
    listMock.mockResolvedValue([transaction]);
    getByIdMock.mockResolvedValue(updated);
    renderList(transaction);

    await clickPay(transaction);
    expect(paymentModalTransaction?.id).toBe(transaction.id);
    await paymentModalOnSuccess!(payment);

    expect(
      await screen.findByRole("button", { name: paymentLabels.sendReceiptButtonLabel }),
    ).toBeInTheDocument();
  });

  it("ne propose jamais de reçu WhatsApp après un paiement rapide sur une dette", async () => {
    const transaction = makeTransaction({ type: "DETTE", status: "EN_COURS", paidAmount: 0 });
    const updated = { ...transaction, status: "REGLEE" as const, paidAmount: 10000 };
    listMock.mockResolvedValue([transaction]);
    getByIdMock.mockResolvedValue(updated);
    renderList(transaction);

    await clickPay(transaction);
    await paymentModalOnSuccess!(payment);

    await vi.waitFor(() => {
      expect(listMock).toHaveBeenCalled();
    });
    expect(
      screen.queryByRole("button", { name: paymentLabels.sendReceiptButtonLabel }),
    ).not.toBeInTheDocument();
  });

  it("ne propose pas de reçu si le client n'a ni téléphone ni numéro WhatsApp", async () => {
    const transaction = makeTransaction({ status: "EN_COURS", paidAmount: 0 });
    const updated = { ...transaction, status: "REGLEE" as const, paidAmount: 10000 };
    listMock.mockResolvedValue([transaction]);
    getByIdMock.mockResolvedValue(updated);
    render(
      <TransactionsList
        initialTransactions={[transaction]}
        tenantId="tenant-1"
        userId="user-1"
        parties={[{ ...party, phone: null, whatsappNumber: null }]}
        summary={{ owedToMe: 10000, owedByMe: 0 }}
        lastPaymentMethodByTransactionId={{}}
        whatsappReceiptTemplates={receiptTemplates}
        boutique="Boutique Awa"
        currency="FCFA"
        reminderDays={7}
      />,
    );

    await clickPay(transaction);
    await paymentModalOnSuccess!(payment);

    await vi.waitFor(() => {
      expect(listMock).toHaveBeenCalled();
    });
    expect(
      screen.queryByRole("button", { name: paymentLabels.sendReceiptButtonLabel }),
    ).not.toBeInTheDocument();
  });
});
