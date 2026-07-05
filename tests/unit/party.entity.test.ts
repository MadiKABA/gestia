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

  it("accepte un tiers avec un numéro WhatsApp", () => {
    expect(() =>
      validatePartyInput({
        name: "Fatou Diop",
        phone: "+221771234567",
        whatsappNumber: "+221771234567",
        type: "CLIENT",
      }),
    ).not.toThrow();
  });
});
