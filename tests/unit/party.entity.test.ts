import { describe, expect, it } from "vitest";
import { normalizePartyInput, validatePartyInput } from "@/domain/party/party.entity";
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

  it("rejette un tiers sans aucun moyen de contact", () => {
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

  it("accepte un tiers avec uniquement un numéro WhatsApp (pas de téléphone)", () => {
    expect(() =>
      validatePartyInput({
        name: "Fatou Diop",
        whatsappNumber: "+221771234567",
        type: "CLIENT",
      }),
    ).not.toThrow();
  });

  it("accepte un tiers entreprise sans companyName (recommandé, non bloquant)", () => {
    expect(() =>
      validatePartyInput({
        name: "Fatou Diop",
        phone: "+221771234567",
        type: "CLIENT",
        isCompany: true,
      }),
    ).not.toThrow();
  });

  it("rejette un numéro de téléphone au format invalide", () => {
    expect(() =>
      validatePartyInput({ name: "Fatou Diop", phone: "+2217", type: "CLIENT" }),
    ).toThrow(ValidationError);
  });

  it("rejette un numéro WhatsApp au format invalide", () => {
    expect(() =>
      validatePartyInput({
        name: "Fatou Diop",
        whatsappNumber: "0771234567",
        type: "CLIENT",
      }),
    ).toThrow(ValidationError);
  });

  // contactOptional (vente au comptant, sale-client-picker.tsx uniquement) :
  // jamais fourni par party-picker-step.tsx, comportement par défaut inchangé.
  it("accepte un tiers sans aucun contact quand contactOptional est true", () => {
    expect(() =>
      validatePartyInput({ name: "Fatou Diop", type: "CLIENT", contactOptional: true }),
    ).not.toThrow();
  });

  it("rejette toujours un tiers sans contact quand contactOptional est absent (non-régression)", () => {
    expect(() => validatePartyInput({ name: "Fatou Diop", type: "CLIENT" })).toThrow(
      ValidationError,
    );
  });

  it("rejette toujours un tiers sans contact quand contactOptional vaut explicitement false", () => {
    expect(() =>
      validatePartyInput({ name: "Fatou Diop", type: "CLIENT", contactOptional: false }),
    ).toThrow(ValidationError);
  });

  it("valide quand même le format du téléphone si contactOptional est true mais un numéro est fourni", () => {
    expect(() =>
      validatePartyInput({
        name: "Fatou Diop",
        phone: "+2217",
        type: "CLIENT",
        contactOptional: true,
      }),
    ).toThrow(ValidationError);
  });
});

describe("normalizePartyInput", () => {
  it("laisse un numéro déjà en E.164 inchangé", () => {
    expect(
      normalizePartyInput({ name: "Fatou Diop", phone: "+221771234567", type: "CLIENT" }).phone,
    ).toBe("+221771234567");
  });

  it("ne touche pas aux champs de contact vides", () => {
    const result = normalizePartyInput({
      name: "Fatou Diop",
      whatsappNumber: "+221771234567",
      type: "CLIENT",
    });
    expect(result.phone).toBeUndefined();
    expect(result.whatsappNumber).toBe("+221771234567");
  });
});
