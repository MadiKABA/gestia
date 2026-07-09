import { describe, expect, it } from "vitest";
import {
  DEFAULT_WHATSAPP_TEMPLATE,
  buildWhatsappUrl,
  renderWhatsappTemplate,
  toWhatsappDigits,
} from "@/presentation/shared/components/whatsapp-link";

describe("renderWhatsappTemplate", () => {
  it("remplace tous les placeholders", () => {
    const result = renderWhatsappTemplate("Bonjour {client}, {reference} : {montant} FCFA", {
      client: "Fatou Diop",
      montant: "15 000",
      reference: "CR-2026-00125",
    });
    expect(result).toBe("Bonjour Fatou Diop, CR-2026-00125 : 15 000 FCFA");
  });

  it("le gabarit par défaut contient bien les trois placeholders", () => {
    const result = renderWhatsappTemplate(DEFAULT_WHATSAPP_TEMPLATE, {
      client: "Fatou",
      montant: "1 000",
      reference: "CR-2026-00001",
    });
    expect(result).not.toContain("{client}");
    expect(result).not.toContain("{montant}");
    expect(result).not.toContain("{reference}");
    expect(result).toContain("Fatou");
    expect(result).toContain("1 000");
    expect(result).toContain("CR-2026-00001");
  });
});

describe("toWhatsappDigits", () => {
  it("retire le préfixe +, les espaces et les tirets", () => {
    expect(toWhatsappDigits("+221 77 123 45 67")).toBe("221771234567");
    expect(toWhatsappDigits("221-77-123-45-67")).toBe("221771234567");
  });
});

describe("buildWhatsappUrl", () => {
  it("construit un lien wa.me avec le message encodé", () => {
    const url = buildWhatsappUrl("+221771234567", "Bonjour, test");
    expect(url).toBe("https://wa.me/221771234567?text=Bonjour%2C%20test");
  });
});
