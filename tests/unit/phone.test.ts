import { describe, expect, it } from "vitest";
import { validatePhoneFormat } from "@/domain/auth/phone";
import { ValidationError } from "@/domain/shared/errors";

describe("validatePhoneFormat", () => {
  it("accepte un numéro au format international", () => {
    expect(() => validatePhoneFormat("+221771234567")).not.toThrow();
  });

  it("rejette un numéro sans indicatif international", () => {
    expect(() => validatePhoneFormat("0771234567")).toThrow(ValidationError);
  });

  it("rejette un numéro avec des caractères non numériques", () => {
    expect(() => validatePhoneFormat("+22177abc4567")).toThrow(ValidationError);
  });

  it("rejette un numéro trop court", () => {
    expect(() => validatePhoneFormat("+2217")).toThrow(ValidationError);
  });
});
