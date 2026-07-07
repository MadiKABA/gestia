import { describe, expect, it } from "vitest";
import { validateEmailFormat } from "@/domain/auth/email";
import { ValidationError } from "@/domain/shared/errors";

describe("validateEmailFormat", () => {
  it("accepte une adresse email valide", () => {
    expect(() => validateEmailFormat("awa@gestia.app")).not.toThrow();
  });

  it("rejette une adresse sans arobase", () => {
    expect(() => validateEmailFormat("awa-gestia.app")).toThrow(ValidationError);
  });

  it("rejette une adresse sans domaine", () => {
    expect(() => validateEmailFormat("awa@")).toThrow(ValidationError);
  });

  it("rejette une adresse avec des espaces", () => {
    expect(() => validateEmailFormat("awa @gestia.app")).toThrow(ValidationError);
  });
});
