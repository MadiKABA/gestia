import { describe, expect, it } from "vitest";
import { derivePaymentDirection, validatePaymentAmount } from "@/domain/payment/payment.entity";
import { ValidationError } from "@/domain/shared/errors";

describe("derivePaymentDirection", () => {
  it("une créance encaissée fait entrer de l'argent", () => {
    expect(derivePaymentDirection("CREANCE")).toBe("IN");
  });

  it("une dette remboursée fait sortir de l'argent", () => {
    expect(derivePaymentDirection("DETTE")).toBe("OUT");
  });
});

describe("validatePaymentAmount", () => {
  it("accepte un montant strictement positif inférieur au solde restant", () => {
    expect(() => validatePaymentAmount(4000, 10000)).not.toThrow();
  });

  it("accepte un montant égal au solde restant (paiement total)", () => {
    expect(() => validatePaymentAmount(10000, 10000)).not.toThrow();
  });

  it("rejette un montant nul ou négatif", () => {
    expect(() => validatePaymentAmount(0, 10000)).toThrow(ValidationError);
    expect(() => validatePaymentAmount(-100, 10000)).toThrow(ValidationError);
  });

  it("rejette un montant supérieur au solde restant", () => {
    expect(() => validatePaymentAmount(10001, 10000)).toThrow(ValidationError);
  });
});
