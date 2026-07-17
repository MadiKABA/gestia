import { describe, expect, it } from "vitest";
import {
  BUSINESS_TYPE_CODES,
  BUSINESS_TYPE_CONFIG,
  DEFAULT_BUSINESS_TYPE,
  isBusinessTypeCode,
  SUPPORTED_BUSINESS_TYPES,
} from "@/domain/tenant/business-type";

describe("isBusinessTypeCode", () => {
  it("accepte les types de commerce de la liste fermée", () => {
    for (const code of BUSINESS_TYPE_CODES) {
      expect(isBusinessTypeCode(code)).toBe(true);
    }
  });

  it("rejette toute valeur hors de la liste fermée", () => {
    expect(isBusinessTypeCode("RESTAURANT")).toBe(false);
    expect(isBusinessTypeCode("")).toBe(false);
    expect(isBusinessTypeCode("alimentation_generale")).toBe(false);
  });
});

describe("DEFAULT_BUSINESS_TYPE", () => {
  it("vaut ALIMENTATION_GENERALE", () => {
    expect(DEFAULT_BUSINESS_TYPE).toBe("ALIMENTATION_GENERALE");
    expect(isBusinessTypeCode(DEFAULT_BUSINESS_TYPE)).toBe(true);
  });
});

describe("BUSINESS_TYPE_CONFIG", () => {
  it("définit un libellé, une icône et une catégorie pour chaque type, sans trou", () => {
    for (const code of BUSINESS_TYPE_CODES) {
      const config = BUSINESS_TYPE_CONFIG[code];
      expect(config).toBeDefined();
      expect(config.label.length).toBeGreaterThan(0);
      expect(config.icon.length).toBeGreaterThan(0);
      expect(["PRODUIT", "SERVICE"]).toContain(config.category);
    }
  });

  it("a exactement une entrée par type de commerce supporté, sans doublon", () => {
    expect(Object.keys(BUSINESS_TYPE_CONFIG).sort()).toEqual([...BUSINESS_TYPE_CODES].sort());
    expect(new Set(BUSINESS_TYPE_CODES).size).toBe(BUSINESS_TYPE_CODES.length);
  });

  it("classe Pressing et Salon de coiffure en SERVICE, le reste en PRODUIT", () => {
    expect(BUSINESS_TYPE_CONFIG.PRESSING.category).toBe("SERVICE");
    expect(BUSINESS_TYPE_CONFIG.SALON_COIFFURE.category).toBe("SERVICE");

    const serviceTypes = SUPPORTED_BUSINESS_TYPES.filter((type) => type.category === "SERVICE").map(
      (type) => type.code,
    );
    expect(serviceTypes.sort()).toEqual(["PRESSING", "SALON_COIFFURE"]);
  });
});
