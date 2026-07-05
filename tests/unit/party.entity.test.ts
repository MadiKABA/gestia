import { describe, expect, it } from "vitest";
import { validatePartyInput } from "@/domain/party/party.entity";
import { ValidationError } from "@/domain/shared/errors";

describe("validatePartyInput", () => {
  it("accepte un tiers avec nom et téléphone", () => {
    expect(() =>
      validatePartyInput({ name: "Fatou Diop", phone: "+221771234567", type: "CLIENT" }),
    ).not.toThrow();
  });

  it("rejette un tiers sans nom", () => {
    expect(() =>
      validatePartyInput({ name: "  ", phone: "+221771234567", type: "CLIENT" }),
    ).toThrow(ValidationError);
  });

  it("rejette un tiers sans téléphone", () => {
    expect(() => validatePartyInput({ name: "Fatou Diop", type: "CLIENT" })).toThrow(
      ValidationError,
    );
  });

  it("rejette une entreprise sans raison sociale", () => {
    expect(() =>
      validatePartyInput({
        name: "Fatou Diop",
        phone: "+221771234567",
        type: "CLIENT",
        isCompany: true,
      }),
    ).toThrow(ValidationError);
  });

  it("accepte une entreprise avec raison sociale", () => {
    expect(() =>
      validatePartyInput({
        name: "Fatou Diop",
        phone: "+221771234567",
        type: "CLIENT",
        isCompany: true,
        companyName: "Diop & Fils",
      }),
    ).not.toThrow();
  });
});
