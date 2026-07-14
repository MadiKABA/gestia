import { describe, expect, it } from "vitest";
import {
  DEFAULT_WHATSAPP_TEMPLATE,
  DEFAULT_WHATSAPP_RECEIPT_PARTIAL_TEMPLATE,
  DEFAULT_WHATSAPP_RECEIPT_FINAL_TEMPLATE,
  buildWhatsappUrl,
  renderWhatsappTemplate,
  resolveWhatsappNumber,
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

describe("buildWhatsappUrl", () => {
  it("construit un lien wa.me avec le message encodé", () => {
    const url = buildWhatsappUrl("+221771234567", "Bonjour, test");
    expect(url).toBe("https://wa.me/221771234567?text=Bonjour%2C%20test");
  });

  it("retire le + du numéro E.164 stocké en base — wa.me ne l'accepte pas", () => {
    const url = buildWhatsappUrl("+221771234567", "Salam");
    expect(url).toContain("wa.me/221771234567");
    expect(url).not.toContain("wa.me/+");
  });
});

describe("resolveWhatsappNumber", () => {
  it("préfère whatsappNumber quand il est renseigné et valide", () => {
    expect(resolveWhatsappNumber("+221771234567", "+221781112233")).toBe("+221781112233");
  });

  it("retombe sur phone quand whatsappNumber est absent", () => {
    expect(resolveWhatsappNumber("+221771234567", null)).toBe("+221771234567");
  });

  /** Régression : une ligne Party créée avant l'introduction de la
   * validation de téléphone (ou tout autre bug d'écriture) peut avoir un
   * whatsappNumber non-vide mais invalide (ex. "+221", un indicatif seul
   * historiquement produit par PhoneInput). Le préférer aveuglément au
   * phone correct produit un lien wa.me qui ne pointe vers aucun contact
   * réel — WhatsApp retombe alors sur la conversation de l'utilisateur
   * plutôt que d'ouvrir celle du client. */
  it("ignore whatsappNumber s'il est invalide et retombe sur phone", () => {
    expect(resolveWhatsappNumber("+221771234567", "+221")).toBe("+221771234567");
  });

  it("retourne null si ni phone ni whatsappNumber ne sont valides", () => {
    expect(resolveWhatsappNumber("+221", "+221")).toBeNull();
    expect(resolveWhatsappNumber(null, null)).toBeNull();
  });

  it("ne mélange jamais deux clients : chacun garde son propre numéro", () => {
    const clientA = { phone: "+221700000001", whatsappNumber: null };
    const clientB = { phone: "+221700000002", whatsappNumber: null };
    expect(resolveWhatsappNumber(clientA.phone, clientA.whatsappNumber)).toBe("+221700000001");
    expect(resolveWhatsappNumber(clientB.phone, clientB.whatsappNumber)).toBe("+221700000002");
  });
});
