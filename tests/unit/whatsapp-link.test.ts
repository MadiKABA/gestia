import { describe, expect, it } from "vitest";
import {
  DEFAULT_WHATSAPP_TEMPLATE,
  DEFAULT_WHATSAPP_RECEIPT_PARTIAL_TEMPLATE,
  DEFAULT_WHATSAPP_RECEIPT_FINAL_TEMPLATE,
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

  it("le gabarit de relance par défaut remplace toutes ses variables, y compris boutique/montant total/date", () => {
    const result = renderWhatsappTemplate(DEFAULT_WHATSAPP_TEMPLATE, {
      client: "Fatou",
      montant: "1 000",
      montantRestant: "1 000",
      montantTotal: "5 000",
      reference: "CR-2026-00001",
      boutique: "Boutique Awa",
      description: "3 sacs de riz",
      date: "12 juillet 2026",
    });
    expect(result).not.toMatch(/\{[a-zA-Z]+\}/);
    expect(result).toContain("Fatou");
    expect(result).toContain("1 000");
    expect(result).toContain("5 000");
    expect(result).toContain("CR-2026-00001");
    expect(result).toContain("Boutique Awa");
    expect(result).toContain("3 sacs de riz");
    expect(result).toContain("12 juillet 2026");
  });

  it("remplace des clés arbitraires (gabarit reçu partiel), y compris boutique/montant total/date", () => {
    const result = renderWhatsappTemplate(DEFAULT_WHATSAPP_RECEIPT_PARTIAL_TEMPLATE, {
      client: "Fatou",
      montantPaye: "5 000",
      modePaiement: "Wave",
      montantRestant: "10 000",
      montantTotal: "15 000",
      boutique: "Boutique Awa",
      date: "12 juillet 2026",
    });
    expect(result).not.toMatch(/\{[a-zA-Z]+\}/);
    expect(result).toContain("Fatou");
    expect(result).toContain("5 000");
    expect(result).toContain("Wave");
    expect(result).toContain("10 000");
    expect(result).toContain("15 000");
    expect(result).toContain("Boutique Awa");
    expect(result).toContain("12 juillet 2026");
  });

  it("remplace des clés arbitraires (gabarit reçu final), y compris boutique/montant total/date", () => {
    const result = renderWhatsappTemplate(DEFAULT_WHATSAPP_RECEIPT_FINAL_TEMPLATE, {
      client: "Fatou",
      montantPaye: "15 000",
      montantTotal: "15 000",
      boutique: "Boutique Awa",
      date: "12 juillet 2026",
    });
    expect(result).not.toMatch(/\{[a-zA-Z]+\}/);
    expect(result).toContain("Fatou");
    expect(result).toContain("15 000");
    expect(result).toContain("Boutique Awa");
    expect(result).toContain("12 juillet 2026");
    expect(result).toContain("Safi");
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
