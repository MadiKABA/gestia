import { describe, expect, it } from "vitest";
import {
  buildAutoReason,
  deriveCashMovementTypeFromPaymentDirection,
} from "@/domain/cash-movement/cash-movement.entity";

describe("deriveCashMovementTypeFromPaymentDirection", () => {
  it("une entrée d'argent (IN) génère un mouvement ENTREE", () => {
    expect(deriveCashMovementTypeFromPaymentDirection("IN")).toBe("ENTREE");
  });

  it("une sortie d'argent (OUT) génère un mouvement SORTIE", () => {
    expect(deriveCashMovementTypeFromPaymentDirection("OUT")).toBe("SORTIE");
  });
});

describe("buildAutoReason", () => {
  it("utilise la référence quand elle est disponible", () => {
    expect(buildAutoReason({ reference: "CR-2026-00125", description: "Sac de riz" })).toBe(
      "Paiement — CR-2026-00125",
    );
  });

  it("retombe sur la description si la référence n'est pas encore synchronisée", () => {
    expect(buildAutoReason({ reference: null, description: "Sac de riz" })).toBe(
      "Paiement — Sac de riz",
    );
  });
});
