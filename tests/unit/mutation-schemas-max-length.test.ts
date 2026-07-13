import { describe, expect, it } from "vitest";
import { partySyncPayloadSchema } from "@/infrastructure/party/party-mutation.schema";
import { transactionSyncPayloadSchema } from "@/infrastructure/transaction/transaction-mutation.schema";
import { paymentSyncPayloadSchema } from "@/infrastructure/payment/payment-mutation.schema";
import { cashMovementSyncPayloadSchema } from "@/infrastructure/cash-movement/cash-movement-mutation.schema";

/**
 * Régression pour le gap d'audit "pas de longueur maximale sur les champs
 * texte libre des mutations offline" — ces payloads transitent par la queue
 * de sync sans limite HTML native (contrairement à un champ de formulaire),
 * un client pourrait envoyer une valeur arbitrairement longue.
 */
describe("Longueur maximale des champs texte libre — mutations offline", () => {
  it("partySyncPayloadSchema rejette name/companyName/contactName au-delà de 200 caractères", () => {
    const base = {
      phone: "+221771234567",
      type: "CLIENT" as const,
    };
    expect(partySyncPayloadSchema.safeParse({ ...base, name: "a".repeat(200) }).success).toBe(true);
    expect(partySyncPayloadSchema.safeParse({ ...base, name: "a".repeat(201) }).success).toBe(
      false,
    );
    expect(
      partySyncPayloadSchema.safeParse({ ...base, name: "Awa", companyName: "a".repeat(201) })
        .success,
    ).toBe(false);
    expect(
      partySyncPayloadSchema.safeParse({ ...base, name: "Awa", contactName: "a".repeat(201) })
        .success,
    ).toBe(false);
  });

  it("partySyncPayloadSchema rejette note au-delà de 1000 caractères", () => {
    expect(
      partySyncPayloadSchema.safeParse({
        name: "Awa",
        phone: "+221771234567",
        type: "CLIENT",
        note: "a".repeat(1000),
      }).success,
    ).toBe(true);
    expect(
      partySyncPayloadSchema.safeParse({
        name: "Awa",
        phone: "+221771234567",
        type: "CLIENT",
        note: "a".repeat(1001),
      }).success,
    ).toBe(false);
  });

  it("transactionSyncPayloadSchema rejette description au-delà de 1000 caractères", () => {
    const base = { partyId: "party-1", type: "CREANCE" as const, amount: 1000 };
    expect(
      transactionSyncPayloadSchema.safeParse({ ...base, description: "a".repeat(1000) }).success,
    ).toBe(true);
    expect(
      transactionSyncPayloadSchema.safeParse({ ...base, description: "a".repeat(1001) }).success,
    ).toBe(false);
  });

  it("paymentSyncPayloadSchema rejette note au-delà de 1000 caractères", () => {
    const base = { transactionId: "transaction-1", amount: 1000, method: "CASH" as const };
    expect(paymentSyncPayloadSchema.safeParse({ ...base, note: "a".repeat(1000) }).success).toBe(
      true,
    );
    expect(paymentSyncPayloadSchema.safeParse({ ...base, note: "a".repeat(1001) }).success).toBe(
      false,
    );
  });

  it("cashMovementSyncPayloadSchema rejette reason au-delà de 1000 caractères", () => {
    const base = { type: "ENTREE" as const, amount: 1000 };
    expect(
      cashMovementSyncPayloadSchema.safeParse({ ...base, reason: "a".repeat(1000) }).success,
    ).toBe(true);
    expect(
      cashMovementSyncPayloadSchema.safeParse({ ...base, reason: "a".repeat(1001) }).success,
    ).toBe(false);
  });
});
