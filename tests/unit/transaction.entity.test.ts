import { describe, expect, it } from "vitest";
import {
  computePartyBalance,
  deriveTransactionStatus,
  formatReference,
  isEligibleForReminder,
  transactionBalanceContribution,
  validateTransactionInput,
} from "@/domain/transaction/transaction.entity";
import { ValidationError } from "@/domain/shared/errors";

describe("validateTransactionInput", () => {
  it("accepte une transaction valide", () => {
    expect(() =>
      validateTransactionInput({
        type: "CREANCE",
        description: "Sac de riz 50kg",
        amount: 15000,
      }),
    ).not.toThrow();
  });

  it("rejette une description vide", () => {
    expect(() =>
      validateTransactionInput({
        type: "CREANCE",
        description: "  ",
        amount: 15000,
      }),
    ).toThrow(ValidationError);
  });

  it("rejette un montant nul ou négatif", () => {
    expect(() =>
      validateTransactionInput({
        type: "CREANCE",
        description: "Sac de riz",
        amount: 0,
      }),
    ).toThrow(ValidationError);
    expect(() =>
      validateTransactionInput({
        type: "CREANCE",
        description: "Sac de riz",
        amount: -100,
      }),
    ).toThrow(ValidationError);
  });

  it("rejette une quantité nulle ou négative si renseignée", () => {
    expect(() =>
      validateTransactionInput({
        type: "CREANCE",
        description: "Sac de riz",
        amount: 15000,
        quantity: 0,
      }),
    ).toThrow(ValidationError);
  });

  it("accepte l'absence de quantité", () => {
    expect(() =>
      validateTransactionInput({
        type: "DETTE",
        description: "Service de transport",
        amount: 5000,
        quantity: null,
      }),
    ).not.toThrow();
  });
});

describe("deriveTransactionStatus", () => {
  it("EN_COURS quand rien n'est payé", () => {
    expect(deriveTransactionStatus(10000, 0)).toBe("EN_COURS");
  });

  it("PARTIELLE quand une partie est payée", () => {
    expect(deriveTransactionStatus(10000, 4000)).toBe("PARTIELLE");
  });

  it("REGLEE quand le montant payé atteint le montant dû", () => {
    expect(deriveTransactionStatus(10000, 10000)).toBe("REGLEE");
  });

  it("REGLEE même si le payé dépasse le dû (jamais négatif)", () => {
    expect(deriveTransactionStatus(10000, 12000)).toBe("REGLEE");
  });
});

describe("formatReference", () => {
  it("formate une créance avec le préfixe CR et le compteur sur 5 chiffres", () => {
    expect(formatReference("CREANCE", 2026, 125)).toBe("CR-2026-00125");
  });

  it("formate une dette avec le préfixe DT", () => {
    expect(formatReference("DETTE", 2026, 45)).toBe("DT-2026-00045");
  });

  it("ne tronque pas un compteur dépassant 5 chiffres", () => {
    expect(formatReference("CREANCE", 2026, 123456)).toBe("CR-2026-123456");
  });
});

describe("transactionBalanceContribution / computePartyBalance", () => {
  it("une CREANCE non soldée contribue positivement", () => {
    expect(transactionBalanceContribution("CREANCE", 10000, 0)).toBe(10000);
  });

  it("une DETTE non soldée contribue négativement", () => {
    expect(transactionBalanceContribution("DETTE", 10000, 0)).toBe(-10000);
  });

  it("une transaction réglée contribue toujours 0, quel que soit le type", () => {
    expect(transactionBalanceContribution("CREANCE", 10000, 10000)).toBe(0);
    expect(transactionBalanceContribution("DETTE", 10000, 10000)).toBe(0);
  });

  it("agrège un mélange de créances et dettes en solde net", () => {
    const balance = computePartyBalance([
      { type: "CREANCE", amount: 20000, paidAmount: 0 },
      { type: "DETTE", amount: 5000, paidAmount: 0 },
      { type: "CREANCE", amount: 8000, paidAmount: 8000 },
    ]);
    expect(balance).toBe(15000);
  });

  it("retourne 0 pour une liste vide", () => {
    expect(computePartyBalance([])).toBe(0);
  });
});

describe("isEligibleForReminder", () => {
  const now = new Date("2026-07-12T00:00:00.000Z");

  it("n'est jamais éligible pour une transaction réglée, même très ancienne", () => {
    expect(
      isEligibleForReminder(
        { status: "REGLEE", dueDate: null, createdAt: new Date("2026-01-01T00:00:00.000Z") },
        7,
        now,
      ),
    ).toBe(false);
  });

  it("n'est pas éligible tant que le seuil n'est pas atteint", () => {
    expect(
      isEligibleForReminder(
        { status: "EN_COURS", dueDate: null, createdAt: new Date("2026-07-10T00:00:00.000Z") },
        7,
        now,
      ),
    ).toBe(false);
  });

  it("devient éligible dès que le seuil est atteint, en se basant sur createdAt à défaut de dueDate", () => {
    expect(
      isEligibleForReminder(
        { status: "PARTIELLE", dueDate: null, createdAt: new Date("2026-07-05T00:00:00.000Z") },
        7,
        now,
      ),
    ).toBe(true);
  });

  it("privilégie dueDate sur createdAt quand les deux sont renseignées", () => {
    // createdAt très ancien (aurait déclenché le badge) mais dueDate encore
    // loin dans le futur : l'échéance explicite doit l'emporter.
    expect(
      isEligibleForReminder(
        {
          status: "EN_COURS",
          dueDate: new Date("2026-08-01T00:00:00.000Z"),
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        },
        7,
        now,
      ),
    ).toBe(false);

    // dueDate dépassée depuis plus de reminderDays jours, createdAt récent :
    // toujours l'échéance qui doit décider.
    expect(
      isEligibleForReminder(
        {
          status: "EN_COURS",
          dueDate: new Date("2026-07-01T00:00:00.000Z"),
          createdAt: new Date("2026-07-11T00:00:00.000Z"),
        },
        7,
        now,
      ),
    ).toBe(true);
  });
});
