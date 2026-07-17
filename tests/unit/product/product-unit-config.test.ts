import { describe, expect, it } from "vitest";
import { PRODUCT_UNIT_CODES } from "@/domain/product/product.entity";
import { PRODUCT_UNIT_CONFIG } from "@/domain/product/product-unit";
import { PRODUCT_UNIT_ICONS } from "@/presentation/product/product-unit-icons";

/**
 * Verrouille l'exigence "chaque ProductUnit a une icône et un libellé" —
 * un trou dans un des deux mappings romprait silencieusement l'affichage
 * (ProductUnitSelector) pour la valeur manquante.
 */
describe("PRODUCT_UNIT_CONFIG / PRODUCT_UNIT_ICONS", () => {
  it("définit un libellé non vide pour chaque ProductUnit", () => {
    for (const code of PRODUCT_UNIT_CODES) {
      expect(PRODUCT_UNIT_CONFIG[code]).toBeDefined();
      expect(PRODUCT_UNIT_CONFIG[code].label.trim()).not.toBe("");
    }
  });

  it("résout une icône lucide-react réelle pour chaque ProductUnit", () => {
    for (const code of PRODUCT_UNIT_CODES) {
      const iconName = PRODUCT_UNIT_CONFIG[code].icon;
      expect(PRODUCT_UNIT_ICONS[iconName]).toBeDefined();
    }
  });

  it("ne contient aucun code hors de PRODUCT_UNIT_CODES", () => {
    const configKeys = Object.keys(PRODUCT_UNIT_CONFIG).sort();
    expect(configKeys).toEqual([...PRODUCT_UNIT_CODES].sort());
  });
});
