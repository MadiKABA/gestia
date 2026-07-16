import { describe, expect, it } from "vitest";
import { isCurrencyCode, SUPPORTED_CURRENCIES, CURRENCY_CODES } from "@/config/currencies";
import { updateTenantSettingsSchema } from "@/presentation/tenant/schemas";

describe("isCurrencyCode", () => {
  it("accepte les devises de la liste fermée", () => {
    expect(isCurrencyCode("FCFA")).toBe(true);
    expect(isCurrencyCode("GNF")).toBe(true);
  });

  it("rejette toute valeur hors de la liste fermée", () => {
    expect(isCurrencyCode("USD")).toBe(false);
    expect(isCurrencyCode("XOF")).toBe(false);
    expect(isCurrencyCode("")).toBe(false);
  });

  it("la liste fermée reste FCFA et GNF, dans cet ordre", () => {
    expect(CURRENCY_CODES).toEqual(["FCFA", "GNF"]);
    expect(SUPPORTED_CURRENCIES.map((currency) => currency.code)).toEqual(["FCFA", "GNF"]);
  });
});

describe("updateTenantSettingsSchema — champ currency", () => {
  it("accepte les devises de la liste fermée", () => {
    expect(updateTenantSettingsSchema.safeParse({ currency: "FCFA" }).success).toBe(true);
    expect(updateTenantSettingsSchema.safeParse({ currency: "GNF" }).success).toBe(true);
  });

  it("accepte l'absence de currency (update partiel)", () => {
    expect(updateTenantSettingsSchema.safeParse({}).success).toBe(true);
  });

  it("rejette toute valeur hors de la liste fermée", () => {
    expect(updateTenantSettingsSchema.safeParse({ currency: "USD" }).success).toBe(false);
    expect(updateTenantSettingsSchema.safeParse({ currency: "" }).success).toBe(false);
    expect(updateTenantSettingsSchema.safeParse({ currency: "fcfa" }).success).toBe(false);
  });
});
