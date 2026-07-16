import { describe, expect, it } from "vitest";
import { formatAmount } from "@/presentation/shared/format-amount";

// `toLocaleString("fr-FR")` sépare les milliers par une espace fine
// insécable (U+202F), pas une espace normale — reproduite via un échappement
// explicite plutôt qu'un caractère collé dans la source, visuellement
// indiscernable d'une espace normale.
const THIN_SPACE = " ";

describe("formatAmount", () => {
  it("formate un montant en FCFA avec séparateur de milliers", () => {
    expect(formatAmount(10000, "FCFA")).toBe(`10${THIN_SPACE}000 FCFA`);
  });

  it("formate un montant en GNF avec séparateur de milliers", () => {
    expect(formatAmount(10000, "GNF")).toBe(`10${THIN_SPACE}000 GNF`);
  });

  it("formate un montant nul", () => {
    expect(formatAmount(0, "FCFA")).toBe("0 FCFA");
  });

  it("ne convertit jamais un montant d'une devise à l'autre — seul le suffixe change", () => {
    const amount = 25000;
    expect(formatAmount(amount, "FCFA")).toBe(`25${THIN_SPACE}000 FCFA`);
    expect(formatAmount(amount, "GNF")).toBe(`25${THIN_SPACE}000 GNF`);
  });
});
