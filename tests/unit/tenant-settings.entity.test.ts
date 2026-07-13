import { describe, expect, it } from "vitest";
import { validateTenantSettingsInput } from "@/domain/tenant-settings/tenant-settings.entity";
import { ValidationError } from "@/domain/shared/errors";

describe("validateTenantSettingsInput", () => {
  it("accepte un objet vide (aucun champ envoyé, update partiel)", () => {
    expect(() => validateTenantSettingsInput({})).not.toThrow();
  });

  it("accepte reminderDays dans la plage autorisée", () => {
    expect(() => validateTenantSettingsInput({ reminderDays: 1 })).not.toThrow();
    expect(() => validateTenantSettingsInput({ reminderDays: 30 })).not.toThrow();
  });

  it("rejette reminderDays hors de la plage [1, 30]", () => {
    expect(() => validateTenantSettingsInput({ reminderDays: 0 })).toThrow(ValidationError);
    expect(() => validateTenantSettingsInput({ reminderDays: 31 })).toThrow(ValidationError);
  });

  it("rejette reminderDays non entier", () => {
    expect(() => validateTenantSettingsInput({ reminderDays: 7.5 })).toThrow(ValidationError);
  });

  it("accepte brandColor faisant partie des presets", () => {
    expect(() => validateTenantSettingsInput({ brandColor: "#0F2A4A" })).not.toThrow();
  });

  it("rejette brandColor hors des presets", () => {
    expect(() => validateTenantSettingsInput({ brandColor: "#FFFFFF" })).toThrow(ValidationError);
  });

  it("accepte brandColor null (remise à la valeur par défaut)", () => {
    expect(() => validateTenantSettingsInput({ brandColor: null })).not.toThrow();
  });

  it("accepte whatsappTemplate contenant les trois placeholders", () => {
    expect(() =>
      validateTenantSettingsInput({
        whatsappTemplate: "Bonjour {client}, {reference} de {montantRestant} FCFA est en attente.",
      }),
    ).not.toThrow();
  });

  it("rejette whatsappTemplate sans les placeholders attendus", () => {
    expect(() =>
      validateTenantSettingsInput({ whatsappTemplate: "Merci de régulariser votre dette." }),
    ).toThrow(ValidationError);
  });

  it("accepte whatsappTemplate null (remise au modèle par défaut)", () => {
    expect(() => validateTenantSettingsInput({ whatsappTemplate: null })).not.toThrow();
  });

  it("accepte whatsappReceiptPartialTemplate contenant les quatre placeholders", () => {
    expect(() =>
      validateTenantSettingsInput({
        whatsappReceiptPartialTemplate:
          "Salam {client}, paiement de {montantPaye} par {modePaiement}, reste {montantRestant} FCFA.",
      }),
    ).not.toThrow();
  });

  it("rejette whatsappReceiptPartialTemplate sans les placeholders attendus", () => {
    expect(() =>
      validateTenantSettingsInput({ whatsappReceiptPartialTemplate: "Merci pour le paiement." }),
    ).toThrow(ValidationError);
  });

  it("accepte whatsappReceiptPartialTemplate null (remise au modèle par défaut)", () => {
    expect(() =>
      validateTenantSettingsInput({ whatsappReceiptPartialTemplate: null }),
    ).not.toThrow();
  });

  it("rejette whatsappReceiptPartialTemplate trop long", () => {
    expect(() =>
      validateTenantSettingsInput({
        whatsappReceiptPartialTemplate:
          "{client} {montantPaye} {modePaiement} {montantRestant} " + "x".repeat(500),
      }),
    ).toThrow(ValidationError);
  });

  it("accepte whatsappReceiptFinalTemplate contenant les deux placeholders", () => {
    expect(() =>
      validateTenantSettingsInput({
        whatsappReceiptFinalTemplate: "Salam {client}, merci pour {montantPaye} FCFA. Safi !",
      }),
    ).not.toThrow();
  });

  it("rejette whatsappReceiptFinalTemplate sans les placeholders attendus", () => {
    expect(() =>
      validateTenantSettingsInput({ whatsappReceiptFinalTemplate: "Compte soldé, merci !" }),
    ).toThrow(ValidationError);
  });

  it("accepte whatsappReceiptFinalTemplate null (remise au modèle par défaut)", () => {
    expect(() => validateTenantSettingsInput({ whatsappReceiptFinalTemplate: null })).not.toThrow();
  });

  it("rejette displayName vide", () => {
    expect(() => validateTenantSettingsInput({ displayName: "   " })).toThrow(ValidationError);
  });

  it("accepte displayName null (remise au nom légal)", () => {
    expect(() => validateTenantSettingsInput({ displayName: null })).not.toThrow();
  });

  it("rejette currency vide", () => {
    expect(() => validateTenantSettingsInput({ currency: "  " })).toThrow(ValidationError);
  });
});
