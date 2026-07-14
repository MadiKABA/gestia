import { describe, expect, it } from "vitest";
import { normalizePhoneToE164, validatePhoneFormat } from "@/domain/shared/phone";
import { ValidationError } from "@/domain/shared/errors";

describe("validatePhoneFormat", () => {
  it("accepte un numéro sénégalais valide", () => {
    expect(() => validatePhoneFormat("+221771234567")).not.toThrow();
  });

  it("accepte un numéro valide d'un autre pays desservi (Côte d'Ivoire)", () => {
    expect(() => validatePhoneFormat("+2250701234567")).not.toThrow();
  });

  it("accepte un numéro valide d'un autre pays desservi (Cameroun)", () => {
    expect(() => validatePhoneFormat("+237612345678")).not.toThrow();
  });

  it("rejette un numéro sans indicatif international", () => {
    expect(() => validatePhoneFormat("0771234567")).toThrow(ValidationError);
  });

  it("rejette un numéro avec des caractères non numériques", () => {
    expect(() => validatePhoneFormat("+22177abc4567")).toThrow(ValidationError);
  });

  it("rejette un numéro trop court pour son indicatif", () => {
    expect(() => validatePhoneFormat("+2217")).toThrow(ValidationError);
  });

  it("rejette un numéro sénégalais avec un nombre de chiffres incorrect", () => {
    expect(() => validatePhoneFormat("+22177123")).toThrow(ValidationError);
  });
});

describe("normalizePhoneToE164", () => {
  it("retourne le numéro déjà normalisé tel quel", () => {
    expect(normalizePhoneToE164("+221771234567")).toBe("+221771234567");
  });

  it("rejette un numéro invalide", () => {
    expect(() => normalizePhoneToE164("+2217")).toThrow(ValidationError);
  });
});
